from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from starlette.applications import Starlette
from starlette.datastructures import State

from api.dependencies import (
    cleanup_provider,
    get_provider,
    get_provider_for_type,
    get_settings,
    resolve_provider,
)
from providers.deepseek import DeepSeekProvider
from providers.exceptions import ServiceUnavailableError, UnknownProviderTypeError
from providers.registry import ProviderRegistry


def _make_mock_settings(**overrides):
    """Create a mock settings object with all required fields for get_provider()."""
    mock = MagicMock()
    mock.model = "deepseek/deepseek-v4-flash"
    mock.provider_type = "deepseek"
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


@pytest.fixture(autouse=True)
def reset_provider():
    """Reset the global _providers registry between tests."""
    import api.dependencies

    saved = api.dependencies._providers
    api.dependencies._providers = {}
    yield
    api.dependencies._providers = saved


@pytest.mark.asyncio
async def test_get_provider_singleton():
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings()

        p1 = get_provider()
        p2 = get_provider()

        assert isinstance(p1, DeepSeekProvider)
        assert p1 is p2


@pytest.mark.asyncio
async def test_get_settings():
    settings = get_settings()
    assert settings is not None
    # Verify it calls the internal _get_settings
    with patch("api.dependencies._get_settings") as mock_get:
        get_settings()
        mock_get.assert_called_once()


@pytest.mark.asyncio
async def test_cleanup_provider():
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings()

        provider = get_provider()
        assert isinstance(provider, DeepSeekProvider)
        provider._client = AsyncMock()

        await cleanup_provider()

        provider._client.aclose.assert_called_once()


@pytest.mark.asyncio
async def test_cleanup_provider_no_client():
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings()

        provider = get_provider()
        if hasattr(provider, "_client"):
            del provider._client

        await cleanup_provider()
        # Should not raise


@pytest.mark.asyncio
async def test_get_provider_deepseek():
    """Test that provider_type=deepseek returns DeepSeekProvider."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings(provider_type="deepseek")

        provider = get_provider()

        assert isinstance(provider, DeepSeekProvider)
        assert provider._base_url == "https://api.deepseek.com/anthropic"
        assert provider._api_key == "test_deepseek_key"
        assert provider._config.enable_thinking is True


@pytest.mark.asyncio
async def test_get_provider_deepseek_uses_fixed_base_url():
    """DeepSeek provider always uses the fixed provider base URL."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings(
            provider_type="deepseek",
        )

        provider = get_provider()

        assert isinstance(provider, DeepSeekProvider)
        assert provider._base_url == "https://api.deepseek.com/anthropic"


@pytest.mark.asyncio
async def test_get_provider_deepseek_passes_enable_model_thinking():
    """DeepSeek provider receives the fallback thinking toggle."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings(
            provider_type="deepseek",
            enable_model_thinking=False,
        )

        provider = get_provider()

        assert isinstance(provider, DeepSeekProvider)
        assert provider._config.enable_thinking is False


@pytest.mark.asyncio
async def test_get_provider_deepseek_missing_api_key():
    """DeepSeek with empty API key raises HTTPException 503."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings(
            provider_type="deepseek",
            deepseek_api_key="",
        )

        with pytest.raises(HTTPException) as exc_info:
            get_provider()

        assert exc_info.value.status_code == 503
        assert "DEEPSEEK_API_KEY" in exc_info.value.detail
        assert "platform.deepseek.com" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_provider_unknown_type():
    """Unknown ``provider_type`` raises :exc:`~providers.exceptions.UnknownProviderTypeError`."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings(provider_type="unknown")

        with pytest.raises(UnknownProviderTypeError, match="Unknown provider_type"):
            get_provider()


@pytest.mark.asyncio
async def test_cleanup_provider_aclose_raises():
    """cleanup_provider handles aclose() raising an exception."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings()

        provider = get_provider()
        assert isinstance(provider, DeepSeekProvider)
        provider._client = AsyncMock()
        provider._client.aclose = AsyncMock(side_effect=RuntimeError("cleanup failed"))

        # Should propagate the error
        with pytest.raises(RuntimeError, match="cleanup failed"):
            await cleanup_provider()


# --- Provider Registry Tests ---


@pytest.mark.asyncio
async def test_get_provider_for_type_caches():
    """get_provider_for_type returns cached provider on second call."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings()

        p1 = get_provider_for_type("deepseek")
        p2 = get_provider_for_type("deepseek")

        assert p1 is p2
        assert isinstance(p1, DeepSeekProvider)


@pytest.mark.asyncio
async def test_cleanup_provider_cleans_all():
    """cleanup_provider cleans up all providers in the registry."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings()

        provider = get_provider_for_type("deepseek")
        assert isinstance(provider, DeepSeekProvider)
        provider._client = AsyncMock()

        await cleanup_provider()

        provider._client.aclose.assert_called_once()


def test_resolve_provider_per_app_uses_separate_registries() -> None:
    """With app set, each app gets its own provider cache (not process _providers)."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings()
        settings = _make_mock_settings()
        app1 = SimpleNamespace(state=State())
        app2 = SimpleNamespace(state=State())
        app1.state.provider_registry = ProviderRegistry()
        app2.state.provider_registry = ProviderRegistry()
        p1 = resolve_provider("deepseek", app=cast(Starlette, app1), settings=settings)
        p2 = resolve_provider("deepseek", app=cast(Starlette, app2), settings=settings)
        assert isinstance(p1, DeepSeekProvider)
        assert isinstance(p2, DeepSeekProvider)
        assert p1 is not p2


def test_resolve_provider_missing_registry_raises_service_unavailable() -> None:
    """HTTP apps must install app.state.provider_registry (e.g. via AppRuntime)."""
    with patch("api.dependencies.get_settings") as mock_settings:
        mock_settings.return_value = _make_mock_settings()
        settings = _make_mock_settings()
        app = SimpleNamespace(state=State())
        assert getattr(app.state, "provider_registry", None) is None
        with pytest.raises(
            ServiceUnavailableError, match="Provider registry is not configured"
        ):
            resolve_provider("deepseek", app=cast(Starlette, app), settings=settings)


def test_resolve_provider_unrelated_value_error_is_not_unknown_provider_log() -> None:
    """Only :exc:`~providers.exceptions.UnknownProviderTypeError` logs unknown provider."""
    import api.dependencies as deps

    with (
        patch.object(deps, "get_settings", return_value=_make_mock_settings()),
        patch.object(
            ProviderRegistry,
            "get",
            side_effect=ValueError("unrelated config"),
        ),
        patch.object(deps.logger, "error") as log_err,
        pytest.raises(ValueError, match="unrelated config"),
    ):
        deps.resolve_provider("deepseek", app=None, settings=_make_mock_settings())
    log_err.assert_not_called()
