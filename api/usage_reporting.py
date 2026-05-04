"""Report completed Vertex proxy usage to the hosted dashboard API."""

from __future__ import annotations

import asyncio
import os
import uuid
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
        self.input_tokens = 0
        self.output_tokens = 0
        self.cache_read_input_tokens = 0
        self.cache_creation_input_tokens = 0
        self.completed = False
        self._buf = ""
        self._reported_input_tokens = 0
        self._reported_output_tokens = 0
        self._reported_cache_read_input_tokens = 0
        self._reported_cache_creation_input_tokens = 0

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
        prompt_cache_hit_tokens = _positive_int(
            usage.get("prompt_cache_hit_tokens")
        )
        prompt_cache_miss_tokens = _positive_int(
            usage.get("prompt_cache_miss_tokens")
        )
        completion_tokens = _positive_int(usage.get("completion_tokens"))

        self.input_tokens = max(
            self.input_tokens,
            _positive_int(usage.get("input_tokens")),
            prompt_cache_miss_tokens,
        )
        self.output_tokens = max(
            self.output_tokens,
            _positive_int(usage.get("output_tokens")),
            completion_tokens,
        )
        self.cache_read_input_tokens = max(
            self.cache_read_input_tokens,
            _positive_int(usage.get("cache_read_input_tokens")),
            prompt_cache_hit_tokens,
        )
        self.cache_creation_input_tokens = max(
            self.cache_creation_input_tokens,
            _positive_int(usage.get("cache_creation_input_tokens")),
        )

    def delta_payload(self, *, request_id: str) -> dict[str, Any] | None:
        """Return only newly observed counters since the last report."""
        input_delta = self.input_tokens - self._reported_input_tokens
        output_delta = self.output_tokens - self._reported_output_tokens
        cache_read_delta = (
            self.cache_read_input_tokens - self._reported_cache_read_input_tokens
        )
        cache_creation_delta = (
            self.cache_creation_input_tokens
            - self._reported_cache_creation_input_tokens
        )
        total = input_delta + output_delta + cache_read_delta + cache_creation_delta
        if total <= 0:
            return None

        self._reported_input_tokens = self.input_tokens
        self._reported_output_tokens = self.output_tokens
        self._reported_cache_read_input_tokens = self.cache_read_input_tokens
        self._reported_cache_creation_input_tokens = self.cache_creation_input_tokens

        prompt_cache_miss_tokens = input_delta + cache_creation_delta
        return {
            "model": self.model,
            "requestId": request_id,
            "inputTokens": input_delta,
            "outputTokens": output_delta,
            "cacheReadInputTokens": cache_read_delta,
            "cacheCreationInputTokens": cache_creation_delta,
            "promptCacheHitTokens": cache_read_delta,
            "promptCacheMissTokens": prompt_cache_miss_tokens,
            "completionTokens": output_delta,
            "prompt_cache_hit_tokens": cache_read_delta,
            "prompt_cache_miss_tokens": prompt_cache_miss_tokens,
            "completion_tokens": output_delta,
            "source": "vertex-proxy",
        }

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
            "promptCacheHitTokens": self.cache_read_input_tokens,
            "promptCacheMissTokens": self.input_tokens
            + self.cache_creation_input_tokens,
            "completionTokens": self.output_tokens,
            "prompt_cache_hit_tokens": self.cache_read_input_tokens,
            "prompt_cache_miss_tokens": self.input_tokens
            + self.cache_creation_input_tokens,
            "completion_tokens": self.output_tokens,
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
    request_id: str | None = None,
) -> AsyncIterator[str]:
    # `input_tokens` here is the proxy's local token count. Billing must only use
    # counters emitted by the upstream API response, so the accumulator starts at
    # zero and records usage exclusively from streamed SSE usage objects.
    accumulator = UsageAccumulator(model=model)
    usage_request_id = request_id or f"usage_{uuid.uuid4().hex[:12]}"
    try:
        async for chunk in body:
            accumulator.feed(chunk)
            payload = accumulator.delta_payload(request_id=usage_request_id)
            if payload is not None:
                await asyncio.to_thread(_post_usage, payload)
            yield chunk
    finally:
        payload = (
            accumulator.delta_payload(request_id=usage_request_id)
            if accumulator.completed
            else None
        )
        if payload is not None:
            await asyncio.to_thread(_post_usage, payload)
