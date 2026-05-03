"""Request builder and DeepSeek native Anthropic compatibility sanitizer."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from loguru import logger

from config.constants import ANTHROPIC_DEFAULT_MAX_OUTPUT_TOKENS
from core.anthropic.native_messages_request import dump_raw_messages_request
from providers.exceptions import InvalidRequestError

# Block types not supported on DeepSeek partial Anthropic-compatible API.
_UNSUPPORTED_MESSAGE_BLOCK_TYPES = frozenset(
    {
        "image",
        "document",
        "server_tool_use",
        "web_search_tool_result",
        "web_fetch_tool_result",
    }
)
_ALLOWED_DEEPSEEK_TOOL_KEYS = frozenset(
    {
        "name",
        "description",
        "input_schema",
        "cache_control",
    }
)
_EMPTY_INPUT_SCHEMA: dict[str, Any] = {"type": "object", "properties": {}}


def _is_server_listed_tool(tool: Mapping[str, Any]) -> bool:
    """True for Anthropic web_search / web_fetch-style tool definitions (listed tools)."""
    name = (tool.get("name") or "").strip()
    if name in ("web_search", "web_fetch"):
        return True
    typ = tool.get("type")
    if isinstance(typ, str):
        return typ.startswith("web_search") or typ.startswith("web_fetch")
    return False


def _walk_block_list_for_unsupported(blocks: Any, *, where: str) -> None:
    if not isinstance(blocks, list):
        return
    for block in blocks:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype in _UNSUPPORTED_MESSAGE_BLOCK_TYPES:
            raise InvalidRequestError(
                f"DeepSeek native does not support {btype!r} blocks ({where})."
            )
        if btype == "tool_result" and "content" in block:
            _walk_block_list_for_unsupported(
                block["content"], where=f"{where} (tool_result content)"
            )


def _validate_deepseek_native_request_dict(data: dict[str, Any]) -> None:
    mcp = data.get("mcp_servers")
    if mcp:
        raise InvalidRequestError(
            "DeepSeek native does not support mcp_servers on requests."
        )

    for tool in data.get("tools") or ():
        if not isinstance(tool, dict):
            continue
        if _is_server_listed_tool(tool):
            raise InvalidRequestError(
                "DeepSeek native does not support listed Anthropic server tools "
                "(web_search / web_fetch). Remove them or use a different provider."
            )

    for i, message in enumerate(data.get("messages") or ()):
        if not isinstance(message, dict):
            continue
        c = message.get("content")
        if isinstance(c, list):
            _walk_block_list_for_unsupported(c, where=f"messages[{i}].content")
        if isinstance(c, str) and "<think>" in c:
            # Unusual, but block encoded redacted content — treat as unsafe for DeepSeek.
            pass

    system = data.get("system")
    if isinstance(system, list):
        _walk_block_list_for_unsupported(system, where="system")


def _strip_additional_properties(schema: Any) -> Any:
    if isinstance(schema, dict):
        new_schema = {}
        for k, v in schema.items():
            if k == "additionalProperties":
                continue
            new_schema[k] = _strip_additional_properties(v)
        return new_schema
    if isinstance(schema, list):
        return [_strip_additional_properties(v) for v in schema]
    return schema


def _normalize_deepseek_input_schema(schema: Any) -> Any:
    """DeepSeek requires custom tool schemas to be JSON objects or booleans."""
    if schema is None:
        return dict(_EMPTY_INPUT_SCHEMA)
    if isinstance(schema, bool):
        return schema
    if isinstance(schema, dict):
        normalized = _strip_additional_properties(schema)
        return normalized or dict(_EMPTY_INPUT_SCHEMA)
    return dict(_EMPTY_INPUT_SCHEMA)


def _sanitize_deepseek_custom_tool(tool: dict[str, Any]) -> dict[str, Any]:
    sanitized = {
        key: value
        for key, value in tool.items()
        if key in _ALLOWED_DEEPSEEK_TOOL_KEYS and value is not None
    }
    sanitized["input_schema"] = _normalize_deepseek_input_schema(
        sanitized.get("input_schema")
    )
    return sanitized


def sanitize_deepseek_tools_for_native(tools: Any) -> Any:
    """Keep custom tools in the subset accepted by DeepSeek's Anthropic endpoint."""
    if not isinstance(tools, list):
        return tools

    sanitized: list[Any] = []
    for tool in tools:
        if not isinstance(tool, dict) or _is_server_listed_tool(tool):
            sanitized.append(tool)
            continue
        sanitized.append(_sanitize_deepseek_custom_tool(tool))
    return sanitized


def sanitize_deepseek_messages_for_native(
    messages: Any, *, thinking_enabled: bool
) -> Any:
    """Filter message content for DeepSeek native Anthropic compatibility."""
    if not isinstance(messages, list):
        return messages

    sanitized: list[Any] = []
    for message in messages:
        if not isinstance(message, dict):
            sanitized.append(message)
            continue
        message = _sanitize_deepseek_tool_result_message(message)
        if message.get("role") != "assistant":
            sanitized.append(message)
            continue
        content = message.get("content")
        if not isinstance(content, list):
            sanitized.append(message)
            continue

        if not thinking_enabled:
            filtered = [
                block
                for block in content
                if not (
                    isinstance(block, dict)
                    and block.get("type") in ("thinking", "redacted_thinking")
                )
            ]
        else:
            filtered = [
                block
                for block in content
                if not (
                    isinstance(block, dict) and block.get("type") == "redacted_thinking"
                )
            ]
        new_msg = dict(message)
        new_msg["content"] = filtered or ""
        sanitized.append(new_msg)
    return sanitized


def _sanitize_deepseek_tool_result_message(message: dict[str, Any]) -> dict[str, Any]:
    content = message.get("content")
    if not isinstance(content, list):
        return message

    tool_results: list[Any] = []
    other_blocks: list[Any] = []
    changed = False
    for block in content:
        if not isinstance(block, dict) or block.get("type") != "tool_result":
            other_blocks.append(block)
            continue
        block_content = block.get("content")
        if isinstance(block_content, dict):
            new_block = dict(block)
            new_block["content"] = json.dumps(
                block_content,
                ensure_ascii=True,
                sort_keys=True,
            )
            tool_results.append(new_block)
            changed = True
            continue

        if isinstance(block_content, list) and any(
            not isinstance(item, dict) for item in block_content
        ):
            new_block = dict(block)
            new_block["content"] = json.dumps(
                block_content,
                ensure_ascii=True,
            )
            tool_results.append(new_block)
            changed = True
            continue

        tool_results.append(block)

    if tool_results and content[: len(tool_results)] != tool_results:
        changed = True

    if not changed:
        return message

    new_message = dict(message)
    new_message["content"] = [*tool_results, *other_blocks]
    return new_message


def _strip_reasoning_content_when_native(messages: Any) -> Any:
    """``reasoning_content`` is OpenAI-helper metadata; not part of native Anthropic body."""
    if not isinstance(messages, list):
        return messages
    out: list[Any] = []
    for m in messages:
        if not isinstance(m, dict):
            out.append(m)
            continue
        msg = {k: v for k, v in m.items() if k != "reasoning_content"}
        out.append(msg)
    return out


def build_request_body(request_data: Any, *, thinking_enabled: bool) -> dict:
    """Build a DeepSeek ``/v1/messages`` JSON body (Anthropic format)."""
    logger.debug(
        "DEEPSEEK_REQUEST: native build model={} msgs={}",
        getattr(request_data, "model", "?"),
        len(getattr(request_data, "messages", [])),
    )

    data = dump_raw_messages_request(request_data)
    _validate_deepseek_native_request_dict(data)
    data.pop("extra_body", None)
    data.pop("context_management", None)
    data.pop("output_config", None)
    if "tools" in data:
        data["tools"] = sanitize_deepseek_tools_for_native(data["tools"])

    thinking_cfg = data.pop("thinking", None)
    if thinking_enabled and isinstance(thinking_cfg, dict):
        thinking_payload: dict[str, Any] = {"type": "enabled"}
        budget_tokens = thinking_cfg.get("budget_tokens")
        if isinstance(budget_tokens, int):
            thinking_payload["budget_tokens"] = budget_tokens
        data["thinking"] = thinking_payload

    if "messages" in data:
        data["messages"] = _strip_reasoning_content_when_native(
            sanitize_deepseek_messages_for_native(
                data["messages"],
                thinking_enabled=thinking_enabled,
            )
        )
    if "max_tokens" not in data or data.get("max_tokens") is None:
        data["max_tokens"] = ANTHROPIC_DEFAULT_MAX_OUTPUT_TOKENS

    data["stream"] = True

    logger.debug(
        "DEEPSEEK_REQUEST: build done model={} msgs={} tools={}",
        data.get("model"),
        len(data.get("messages", [])),
        len(data.get("tools", [])),
    )
    return data
