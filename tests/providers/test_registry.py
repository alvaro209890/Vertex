import subprocess
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from config.provider_ids import SUPPORTED_PROVIDER_IDS
from providers.deepseek import DeepSeekProvider
from providers.exceptions import UnknownProviderTypeError
from providers.registry import (
    PROVIDER_DESCRIPTORS,
    ProviderRegistry,
    create_provider,
)


def _make_settings(**overrides):
    mock = MagicMock()
    mock.deepseek_api_key = "test_deepseek_key"
    mock.provider_rate_limit = 40
    mock.provider_rate_window = 60
    mock.provider_max_concurrency = 5
    mock.http_read_timeout = 300.0
    mock.http_write_timeout = 10.0
    mock.http_connect_timeout = 10.0
    mock.enable_model_thinking = True
    for key, value in overrides.items():
        setattr(mock, key, value)
    return mock


def test_importing_registry_does_not_eager_load_other_adapters() -> None:
    """Registry metadata must not import every provider adapter up front."""
    code = "import sys\nimport providers.registry\n"
    proc = subprocess.run(
        [sys.executable, "-c", code],
        check=False,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout


def test_descriptors_cover_advertised_provider_ids():
    assert set(PROVIDER_DESCRIPTORS) == set(SUPPORTED_PROVIDER_IDS)
    for descriptor in PROVIDER_DESCRIPTORS.values():
        assert descriptor.provider_id
        assert descriptor.transport_type == "anthropic_messages"
        assert descriptor.capabilities


def test_create_provider_instantiates_deepseek():
    with patch("httpx.AsyncClient"):
        provider = create_provider("deepseek", _make_settings())

    assert isinstance(provider, DeepSeekProvider)
    assert provider._base_url == "https://api.deepseek.com/anthropic"


def test_provider_registry_caches_by_provider_id():
    registry = ProviderRegistry()
    settings = _make_settings()

    with patch("httpx.AsyncClient"):
        first = registry.get("deepseek", settings)
        second = registry.get("deepseek", settings)

    assert first is second


def test_unknown_provider_raises_unknown_provider_type_error():
    with pytest.raises(UnknownProviderTypeError, match="Unknown provider_type"):
        create_provider("unknown", _make_settings())


@pytest.mark.asyncio
async def test_provider_registry_cleanup_runs_all_even_if_one_fails() -> None:
    """Every provider gets cleanup; cache is cleared even when one raises."""
    reg = ProviderRegistry()
    p1 = MagicMock()
    p1.cleanup = AsyncMock(side_effect=RuntimeError("first"))
    p2 = MagicMock()
    p2.cleanup = AsyncMock()
    reg._providers["a"] = p1
    reg._providers["b"] = p2
    with pytest.raises(RuntimeError, match="first"):
        await reg.cleanup()
    p1.cleanup.assert_awaited_once()
    p2.cleanup.assert_awaited_once()
    assert reg._providers == {}


@pytest.mark.asyncio
async def test_provider_registry_cleanup_exceptiongroup_on_multiple_failures() -> None:
    reg = ProviderRegistry()
    p1 = MagicMock()
    p1.cleanup = AsyncMock(side_effect=RuntimeError("a"))
    p2 = MagicMock()
    p2.cleanup = AsyncMock(side_effect=RuntimeError("b"))
    reg._providers["x"] = p1
    reg._providers["y"] = p2
    with pytest.raises(ExceptionGroup) as exc_info:
        await reg.cleanup()
    assert len(exc_info.value.exceptions) == 2
    assert reg._providers == {}
