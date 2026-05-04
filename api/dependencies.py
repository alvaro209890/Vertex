"""Dependency injection for FastAPI."""

import os
import secrets

from fastapi import Depends, HTTPException, Request
from loguru import logger
from starlette.applications import Starlette

from config.settings import Settings
from config.settings import get_settings as _get_settings
from core.anthropic import get_user_facing_error_message
from providers.base import BaseProvider
from providers.exceptions import (
    AuthenticationError,
    ServiceUnavailableError,
    UnknownProviderTypeError,
)
from providers.registry import PROVIDER_DESCRIPTORS, ProviderRegistry

# Flag de ambiente: VERTEX_REMOTE=1 quando rodando no servidor
_IS_REMOTE = os.environ.get("VERTEX_REMOTE") == "1"

# Process-level cache: only for :func:`get_provider_for_type` / :func:`get_provider`
# when there is no ``Request``/``app`` (unit tests, scripts). HTTP handlers must pass
# ``app`` to :func:`resolve_provider` so the app-scoped registry is used.
_providers: dict[str, BaseProvider] = {}


def get_settings() -> Settings:
    """Return cached :class:`~config.settings.Settings` (FastAPI-friendly alias)."""
    return _get_settings()


def resolve_provider(
    provider_type: str,
    *,
    app: Starlette | None,
    settings: Settings,
) -> BaseProvider:
    """Resolve a provider using the app-scoped registry when ``app`` is set.

    When ``app`` is not ``None``, the app-owned :attr:`app.state.provider_registry`
    must exist (installed by :class:`~api.runtime.AppRuntime` during startup).
    Callers that construct a bare ``FastAPI`` without lifespan must set
    ``app.state.provider_registry`` explicitly.

    When ``app`` is ``None`` (no HTTP context), uses the process-level
    :data:`_providers` cache only.
    """
    if app is not None:
        reg = getattr(app.state, "provider_registry", None)
        if reg is None:
            raise ServiceUnavailableError(
                "Provider registry is not configured. Ensure AppRuntime startup ran "
                "or assign app.state.provider_registry for test apps."
            )
        return _resolve_with_registry(reg, provider_type, settings)
    return _resolve_with_registry(ProviderRegistry(_providers), provider_type, settings)


def _resolve_with_registry(
    registry: ProviderRegistry, provider_type: str, settings: Settings
) -> BaseProvider:
    should_log_init = not registry.is_cached(provider_type)
    try:
        provider = registry.get(provider_type, settings)
    except AuthenticationError as e:
        # Provider :class:`~providers.exceptions.AuthenticationError` messages are
        # curated configuration hints (env var names, docs links), not upstream noise.
        detail = str(e).strip() or get_user_facing_error_message(e)
        raise HTTPException(status_code=503, detail=detail) from e
    except UnknownProviderTypeError:
        logger.error(
            "Unknown provider_type: '{}'. Supported: {}",
            provider_type,
            ", ".join(f"'{key}'" for key in PROVIDER_DESCRIPTORS),
        )
        raise
    if should_log_init:
        logger.info("Provider initialized: {}", provider_type)
    return provider


def get_provider_for_type(provider_type: str) -> BaseProvider:
    """Get or create a provider in the process-level cache (no ``app``/Request).

    HTTP route handlers should call :func:`resolve_provider` with the active
    :attr:`request.app` (via :class:`~api.runtime.AppRuntime`) instead of this
    process-wide cache.
    """
    return resolve_provider(provider_type, app=None, settings=get_settings())


def require_api_key(
    request: Request, settings: Settings = Depends(get_settings)
) -> None:
    """Require a server API key (Anthropic-style).

    Checks `x-api-key` header or `Authorization: Bearer ...` against
    `Settings.anthropic_auth_token`. If `ANTHROPIC_AUTH_TOKEN` is empty, this is a no-op.
    """
    anthropic_auth_token = settings.anthropic_auth_token
    if not anthropic_auth_token:
        # No API key configured -> allow
        return

    header = (
        request.headers.get("x-api-key")
        or request.headers.get("authorization")
        or request.headers.get("anthropic-auth-token")
    )
    if not header:
        raise HTTPException(status_code=401, detail="Missing API key")

    # Support both raw key in X-API-Key and Bearer token in Authorization
    token = header
    if header.lower().startswith("bearer "):
        token = header.split(" ", 1)[1]

    # Strip anything after the first colon to handle tokens with appended model names
    if token and ":" in token:
        token = token.split(":", 1)[0]

    # Constant-time comparison to avoid leaking the configured token via
    # response-time differences on a per-byte mismatch (CWE-208).
    if not secrets.compare_digest(
        token.encode("utf-8"), anthropic_auth_token.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Invalid API key")


def get_provider() -> BaseProvider:
    """Get or create the default provider (``MODEL`` / ``provider_type``).

    Process-cache helper for scripts, unit tests, and non-FastAPI callers. HTTP
    handlers must use :func:`resolve_provider` with :attr:`request.app` so the
    app-scoped :class:`~providers.registry.ProviderRegistry` is used.
    """
    return get_provider_for_type(get_settings().provider_type)


async def cleanup_provider():
    """Cleanup all provider resources."""
    global _providers
    await ProviderRegistry(_providers).cleanup()
    _providers = {}
    logger.debug("Provider cleanup completed")


# =============================================================================
# Firebase Auth (modo remoto / servidor)
# =============================================================================


def _get_firebase_user_from_request(request: Request) -> object | None:
    """Retorna o usuário Firebase do state, se já autenticado."""
    return getattr(request.state, "firebase_user", None)


def require_firebase_auth(
    request: Request,
) -> None:
    """Valida Firebase JWT token do header Authorization.

    Usado APENAS quando VERTEX_REMOTE=1 (modo servidor).
    Substitui require_api_key() no servidor.

    Aceita dois tipos de token:
      1. Firebase JWT: `Authorization: Bearer <firebase_jwt>` — validado contra JWKS
      2. API key local: `x-api-key: freecc` ou `Authorization: Bearer freecc` —
         aceito para compatibilidade com CLI legado

    Extrai o usuário Firebase JWT em `request.state.firebase_user` quando aplicável.

    Raises:
        HTTPException(401): token ausente ou inválido
        HTTPException(403): conta bloqueada
    """
    if not _IS_REMOTE:
        return

    auth_header = request.headers.get("authorization")
    api_key_header = request.headers.get("x-api-key")

    # Tenta x-api-key primeiro
    token = api_key_header or ""
    if not token and auth_header:
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1]
        else:
            token = auth_header

    if not token:
        raise HTTPException(status_code=401, detail="Token de autenticacao ausente")

    # Aceita o token freecc legado como fallback simples
    settings = get_settings()
    if settings.anthropic_auth_token and secrets.compare_digest(
        token.encode("utf-8"), settings.anthropic_auth_token.encode("utf-8")
    ):
        logger.debug("Autenticado via API key legada (freecc)")
        return

    # Tenta validar como Firebase JWT
    try:
        from api.firebase_auth import verify_token

        user = verify_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    # Armazena no state da request
    request.state.firebase_user = user

    # Verifica se o usuário não está bloqueado
    _check_user_not_blocked(user)


def _check_user_not_blocked(user: object) -> None:
    """Verifica se o usuário não está bloqueado.

    Consulta o backend Express local. Falhas silenciosas (timeout, erro)
    permitem a passagem para não bloquear usuários legítimos em caso
    de problema temporário no backend.
    """
    try:
        import json as _json
        import urllib.error as _urllib_error
        import urllib.request as _urllib

        from api.firebase_auth import FirebaseUser

        if not isinstance(user, FirebaseUser):
            return

        req = _urllib.Request(
            f"http://127.0.0.1:4000/admin/users/{user.uid}",
            method="GET",
        )
        try:
            with _urllib.urlopen(req, timeout=3) as resp:
                data = _json.loads(resp.read().decode("utf-8"))
                if isinstance(data, dict) and data.get("blocked"):
                    raise HTTPException(
                        status_code=403,
                        detail="Conta bloqueada. Fale com o suporte.",
                    )
        except HTTPException:
            raise
        except _urllib_error.HTTPError as exc:
            if exc.code == 404:
                # Usuário não encontrado no backend local -> permitir
                # (o backend Express cria profile automaticamente no primeiro acesso)
                pass
            else:
                logger.warning(
                    "Falha ao verificar block status (HTTP {}): {}",
                    exc.code,
                    exc.reason,
                )
        except Exception as exc:
            logger.warning("Falha ao verificar block status: {}", exc)
    except ImportError:
        pass
