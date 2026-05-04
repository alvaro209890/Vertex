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
        "source": "vertex-proxy",
    }
