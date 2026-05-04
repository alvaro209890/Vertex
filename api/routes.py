"""FastAPI route handlers."""

import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from loguru import logger

from api.metrics import metrics_store
from config.settings import Settings
from core.anthropic import get_token_count

from . import dependencies
from .dependencies import get_settings, require_api_key, require_firebase_auth
from .models.anthropic import MessagesRequest, TokenCountRequest
from .models.responses import ModelResponse, ModelsListResponse
from .services import ClaudeProxyService

router = APIRouter()
PACKAGE_NAME = "vertex-deepseek"

# Escolhe o auth dependency baseado no ambiente
# VERTEX_REMOTE=1 no servidor usa Firebase JWT; local usa API key
_USE_FIREBASE_AUTH = os.environ.get("VERTEX_REMOTE") == "1"
_auth_dependency = require_firebase_auth if _USE_FIREBASE_AUTH else require_api_key


AVAILABLE_MODEL_OPTIONS = [
    ModelResponse(
        id="claude-opus-4-20250514",
        display_name="Claude Opus 4",
        created_at="2025-05-14T00:00:00Z",
    ),
    ModelResponse(
        id="claude-sonnet-4-20250514",
        display_name="Claude Sonnet 4",
        created_at="2025-05-14T00:00:00Z",
    ),
    ModelResponse(
        id="claude-3-5-haiku-20241022",
        display_name="Claude 3.5 Haiku",
        created_at="2024-10-22T00:00:00Z",
    ),
    ModelResponse(
        id="deepseek/deepseek-v4-flash",
        display_name="DeepSeek V4 Flash",
        created_at="2026-04-29T00:00:00Z",
    ),
    ModelResponse(
        id="deepseek/deepseek-v4-pro",
        display_name="DeepSeek V4 Pro",
        created_at="2026-04-29T00:00:00Z",
    ),
]


def get_proxy_service(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> ClaudeProxyService:
    """Build the request service for route handlers."""
    return ClaudeProxyService(
        settings,
        provider_getter=lambda provider_type: dependencies.resolve_provider(
            provider_type, app=request.app, settings=settings
        ),
        token_counter=get_token_count,
    )


def _probe_response(allow: str) -> Response:
    """Return an empty success response for compatibility probes."""
    return Response(status_code=204, headers={"Allow": allow})


def _installed_vertex_version() -> str:
    """Return the installed Vertex package version for launcher health checks."""
    from importlib.metadata import PackageNotFoundError, version

    try:
        return version(PACKAGE_NAME)
    except PackageNotFoundError:
        return "unknown"


def _settings_fingerprint(settings: Settings) -> str:
    """Return a non-secret fingerprint for launcher/proxy config freshness checks."""
    import hashlib
    import json

    payload = {
        "model": settings.model,
        "model_opus": settings.model_opus,
        "model_sonnet": settings.model_sonnet,
        "model_haiku": settings.model_haiku,
        "enable_model_thinking": settings.enable_model_thinking,
        "enable_opus_thinking": settings.enable_opus_thinking,
        "enable_sonnet_thinking": settings.enable_sonnet_thinking,
        "enable_haiku_thinking": settings.enable_haiku_thinking,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


# =============================================================================
# Routes
# =============================================================================
@router.post("/v1/messages")
async def create_message(
    request_data: MessagesRequest,
    service: ClaudeProxyService = Depends(get_proxy_service),
    _auth=Depends(_auth_dependency),
):
    """Create a message (always streaming)."""
    return service.create_message(request_data)


@router.api_route("/v1/messages", methods=["HEAD", "OPTIONS"])
async def probe_messages(_auth=Depends(_auth_dependency)):
    """Respond to Claude compatibility probes for the messages endpoint."""
    return _probe_response("POST, HEAD, OPTIONS")


@router.post("/v1/messages/count_tokens")
async def count_tokens(
    request_data: TokenCountRequest,
    service: ClaudeProxyService = Depends(get_proxy_service),
    _auth=Depends(_auth_dependency),
):
    """Count tokens for a request."""
    return service.count_tokens(request_data)


@router.api_route("/v1/messages/count_tokens", methods=["HEAD", "OPTIONS"])
async def probe_count_tokens(_auth=Depends(_auth_dependency)):
    """Respond to Claude compatibility probes for the token count endpoint."""
    return _probe_response("POST, HEAD, OPTIONS")


@router.get("/")
async def root(
    settings: Settings = Depends(get_settings), _auth=Depends(_auth_dependency)
):
    """Root endpoint."""
    return {
        "status": "ok",
        "provider": settings.provider_type,
        "model": settings.model,
    }


@router.api_route("/", methods=["HEAD", "OPTIONS"])
async def probe_root(_auth=Depends(_auth_dependency)):
    """Respond to compatibility probes for the root endpoint."""
    return _probe_response("GET, HEAD, OPTIONS")


@router.get("/health")
async def health(
    request: Request,
    settings: Settings = Depends(get_settings),
):
    """Health check endpoint."""
    result = {
        "status": "healthy",
        "version": _installed_vertex_version(),
        "settings_fingerprint": _settings_fingerprint(settings),
    }
    dp = getattr(request.app.state, "dashboard_port", None)
    if dp is not None:
        result["dashboard_url"] = f"http://localhost:{dp}"
    return result


@router.api_route("/health", methods=["HEAD", "OPTIONS"])
async def probe_health():
    """Respond to compatibility probes for the health endpoint."""
    return _probe_response("GET, HEAD, OPTIONS")


@router.get("/v1/models", response_model=ModelsListResponse)
async def list_models(_auth=Depends(_auth_dependency)):
    """List model ids this proxy can route."""
    return ModelsListResponse(
        data=AVAILABLE_MODEL_OPTIONS,
        first_id=AVAILABLE_MODEL_OPTIONS[0].id if AVAILABLE_MODEL_OPTIONS else None,
        has_more=False,
        last_id=AVAILABLE_MODEL_OPTIONS[-1].id if AVAILABLE_MODEL_OPTIONS else None,
    )


@router.post("/stop")
async def stop_cli(request: Request, _auth=Depends(_auth_dependency)):
    """Stop all CLI sessions and pending tasks."""
    handler = getattr(request.app.state, "message_handler", None)
    if not handler:
        # Fallback if messaging not initialized
        cli_manager = getattr(request.app.state, "cli_manager", None)
        if cli_manager:
            await cli_manager.stop_all()
            logger.info("STOP_CLI: source=cli_manager cancelled_count=N/A")
            return {"status": "stopped", "source": "cli_manager"}
        raise HTTPException(status_code=503, detail="Messaging system not initialized")

    count = await handler.stop_all_tasks()
    logger.info("STOP_CLI: source=handler cancelled_count={}", count)
    return {"status": "stopped", "cancelled_count": count}


@router.get("/api/metrics")
async def get_metrics():
    """Get request and token metrics."""
    return metrics_store.get_metrics()
