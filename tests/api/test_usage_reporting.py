from api.usage_reporting import UsageAccumulator
from core.anthropic.sse import format_sse_event


def test_usage_accumulator_collects_final_sse_usage() -> None:
    acc = UsageAccumulator(model="deepseek/deepseek-v4-flash", input_tokens=10)

    acc.feed(
        format_sse_event(
            "message_start",
            {
                "type": "message_start",
                "message": {
                    "id": "msg_1",
                    "type": "message",
                    "role": "assistant",
                    "content": [],
                    "model": "deepseek-v4-flash",
                    "usage": {"input_tokens": 12, "output_tokens": 1},
                },
            },
        )
    )
    acc.feed(
        format_sse_event(
            "message_delta",
            {
                "type": "message_delta",
                "delta": {"stop_reason": "end_turn", "stop_sequence": None},
                "usage": {
                    "input_tokens": 12,
                    "output_tokens": 7,
                    "cache_read_input_tokens": 3,
                },
            },
        )
    )
    acc.feed(format_sse_event("message_stop", {"type": "message_stop"}))

    assert acc.completed
    assert acc.payload() == {
        "model": "deepseek/deepseek-v4-flash",
        "inputTokens": 12,
        "outputTokens": 7,
        "cacheReadInputTokens": 3,
        "cacheCreationInputTokens": 0,
        "promptCacheHitTokens": 3,
        "promptCacheMissTokens": 12,
        "completionTokens": 7,
        "prompt_cache_hit_tokens": 3,
        "prompt_cache_miss_tokens": 12,
        "completion_tokens": 7,
        "source": "vertex-proxy",
    }


def test_usage_accumulator_extracts_deepseek_exact_token_fields() -> None:
    acc = UsageAccumulator(model="deepseek/deepseek-v4-flash")

    acc.feed(
        format_sse_event(
            "message_delta",
            {
                "type": "message_delta",
                "delta": {"stop_reason": "end_turn", "stop_sequence": None},
                "usage": {
                    "prompt_cache_hit_tokens": 30,
                    "prompt_cache_miss_tokens": 12,
                    "completion_tokens": 7,
                },
            },
        )
    )

    assert acc.payload() == {
        "model": "deepseek/deepseek-v4-flash",
        "inputTokens": 12,
        "outputTokens": 7,
        "cacheReadInputTokens": 30,
        "cacheCreationInputTokens": 0,
        "promptCacheHitTokens": 30,
        "promptCacheMissTokens": 12,
        "completionTokens": 7,
        "prompt_cache_hit_tokens": 30,
        "prompt_cache_miss_tokens": 12,
        "completion_tokens": 7,
        "source": "vertex-proxy",
    }


def test_usage_delta_payload_reports_only_new_api_counters() -> None:
    acc = UsageAccumulator(model="deepseek/deepseek-v4-flash", input_tokens=99)

    assert acc.delta_payload(request_id="req_1") is None

    acc.feed(
        format_sse_event(
            "message_delta",
            {
                "type": "message_delta",
                "delta": {"stop_reason": "end_turn", "stop_sequence": None},
                "usage": {
                    "prompt_cache_hit_tokens": 10,
                    "prompt_cache_miss_tokens": 5,
                    "completion_tokens": 2,
                },
            },
        )
    )

    first = acc.delta_payload(request_id="req_1")
    assert first is not None
    assert first["requestId"] == "req_1"
    assert first["prompt_cache_hit_tokens"] == 10
    assert first["prompt_cache_miss_tokens"] == 5
    assert first["completion_tokens"] == 2
    assert acc.delta_payload(request_id="req_1") is None
