"""Inicia o proxy FastAPI no servidor.

Este script é usado APENAS no servidor (`VERTEX_REMOTE=1`).
Escuta em 127.0.0.1:4001 (só local), atrás do Express que faz proxy reverso
de /v1/* para cá.

Uso:
    python web/backend/proxy_server.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _ensure_repo_root_on_path() -> None:
    """Adiciona a raiz do repo ao sys.path para importar os pacotes."""
    repo_root = Path(__file__).resolve().parents[2]
    root_str = str(repo_root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)


def main() -> None:
    _ensure_repo_root_on_path()

    from config.logging_config import configure_logging
    from config.settings import get_settings

    # Garante que estamos em modo servidor
    os.environ.setdefault("VERTEX_REMOTE", "1")

    settings = get_settings()

    configure_logging(
        settings.log_file,
        verbose_third_party=settings.log_raw_api_payloads,
    )

    import uvicorn

    uvicorn.run(
        "api.app:create_app",
        factory=True,
        host="127.0.0.1",
        port=4001,
        log_level="info",
        timeout_graceful_shutdown=5,
        reload=False,
    )


if __name__ == "__main__":
    main()
