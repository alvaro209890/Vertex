"""Report completed Vertex proxy usage to the hosted dashboard API."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from typing import Any

import httpx
from loguru import logger

from core.anthropic.stream_contracts import SSEEvent, parse_sse_lines

VERTEX_API_URL = os.environ.get("VERTEX_API_URL", "https://vertex-api.cursar.space")


def _positive_int(value: Any) -> int:
    return value if isinstance(value, int) and value > 0 else 0


class UsageAccumulator:
    """Collect final token counters from Anthropic SSE chunks."""

    def __init__(self, *, model: str, input_tokens: int = 0) -> None:
        self.model = model
        self.input_tokens = _positive_int(input_tokens)
        self.output_tokens = 0
        self.cache_read_input_tokens = 0
        self.cache_creation_input_tokens = 0
        self.completed = False
        self._buf = ""

    def feed(self, chunk: str) -> None:
        self._buf += chunk
        while True:
            sep = self._buf.find("\n\n")
            if sep < 0:
                break
            frame = self._buf[:sep]
            self._buf = self._buf[sep + 2 :]
            if frame.strip():
                for event in parse_sse_lines(frame.splitlines()):
                    self._observe(event)

    def _observe(self, event: SSEEvent) -> None:
        if event.event == "message_start":
            message = event.data.get("message")
            if isinstance(message, dict):
                usage = message.get("usage")
                if isinstance(usage, dict):
                    self._update_usage(usage)
            return

        if event.event == "message_delta":
            usage = event.data.get("usage")
            if isinstance(usage, dict):
                self._update_usage(usage)
            return

        if event.event == "message_stop":
            self.completed = True

    def _update_usage(self, usage: dict[str, Any]) -> None:
        self.input_tokens = max(self.input_tokens, _positive_int(usage.get("input_tokens")))
        self.output_tokens = max(self.output_tokens, _positive_int(usage.get("output_tokens")))
        self.cache_read_input_tokens = max(
            self.cache_read_input_tokens,
            _positive_int(usage.get("cache_read_input_tokens")),
        )
        self.cache_creation_input_tokens = max(
            self.cache_creation_input_tokens,
            _positive_int(usage.get("cache_creation_input_tokens")),
        )

    def payload(self) -> dict[str, Any] | None:
        total = (
            self.input_tokens
            + self.output_tokens
            + self.cache_read_input_tokens
            + self.cache_creation_input_tokens
        )
        if total <= 0:
            return None
        return {
            "model": self.model,
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "cacheReadInputTokens": self.cache_read_input_tokens,
            "cacheCreationInputTokens": self.cache_creation_input_tokens,
            "source": "vertex-proxy",
        }


def _post_usage(payload: dict[str, Any]) -> None:
    if os.environ.get("VERTEX_USAGE_REPORTING_DISABLED") == "1":
        return

    try:
        from vertex_auth import get_valid_token

        token = get_valid_token()
        if not token:
            return

        response = httpx.post(
            f"{VERTEX_API_URL}/usage",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        if response.status_code >= 400:
            logger.warning(
                "USAGE_REPORT: failed status={} model={} tokens={}",
                response.status_code,
                payload.get("model"),
                sum(
                    int(payload.get(key) or 0)
                    for key in (
                        "inputTokens",
                        "outputTokens",
                        "cacheReadInputTokens",
                        "cacheCreationInputTokens",
                    )
                ),
            )
    except Exception as exc:
        logger.debug("USAGE_REPORT: skipped exc_type={}", type(exc).__name__)


async def stream_with_usage_reporting(
    body: AsyncIterator[str],
    *,
    model: str,
    input_tokens: int,
) -> AsyncIterator[str]:
    accumulator = UsageAccumulator(model=model, input_tokens=input_tokens)
    try:
        async for chunk in body:
            accumulator.feed(chunk)
            yield chunk
    finally:
        payload = accumulator.payload() if accumulator.completed else None
        if payload is not None:
            await asyncio.to_thread(_post_usage, payload)
