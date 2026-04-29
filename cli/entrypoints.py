"""CLI entry points for the installed package."""

from __future__ import annotations

import os
import sys
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "vertex"
ENV_FILE = CONFIG_DIR / ".env"


def _load_env_template() -> str:
    """Load the canonical root env template from package resources or source."""
    import importlib.resources

    packaged = importlib.resources.files("cli").joinpath("env.example")
    if packaged.is_file():
        return packaged.read_text("utf-8")

    source_template = Path(__file__).resolve().parents[1] / ".env.example"
    if source_template.is_file():
        return source_template.read_text(encoding="utf-8")

    raise FileNotFoundError("Could not find bundled or source .env.example template.")


def _needs_api_key() -> bool:
    """Check whether DEEPSEEK_API_KEY is missing or empty."""
    from dotenv import dotenv_values

    if os.environ.get("DEEPSEEK_API_KEY", "").strip():
        return False
    if ENV_FILE.is_file():
        values = dotenv_values(ENV_FILE)
        if values.get("DEEPSEEK_API_KEY", "").strip():
            return False
    return True


def _run_wizard_if_needed() -> None:
    """Run the setup wizard when DEEPSEEK_API_KEY is not configured."""
    if not _needs_api_key():
        return
    from cli.setup_wizard import run_setup_wizard

    run_setup_wizard(ENV_FILE)


def serve() -> None:
    """Start the FastAPI server (registered as `vertex` script)."""
    # Handle logout / re-login request
    if "--logout" in sys.argv or "/logout" in sys.argv:
        if ENV_FILE.exists():
            from cli.setup_wizard import run_setup_wizard

            run_setup_wizard(ENV_FILE)
            print("API key updated. Restart Vertex to apply changes.")
            return
        print("No config found. Run: vertex-init")
        return

    import uvicorn

    from cli.process_registry import kill_all_best_effort
    from config.settings import get_settings

    _run_wizard_if_needed()

    settings = get_settings()
    try:
        uvicorn.run(
            "api.app:create_app",
            factory=True,
            host=settings.host,
            port=settings.port,
            log_level="debug",
            timeout_graceful_shutdown=5,
        )
    finally:
        kill_all_best_effort()


def init() -> None:
    """Scaffold config at ~/.config/vertex/.env (registered as `vertex-init`)."""
    if ENV_FILE.exists():
        print(f"Config already exists at {ENV_FILE}")
        print("Delete it first if you want to reset to defaults.")
        return

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    template = _load_env_template()
    ENV_FILE.write_text(template, encoding="utf-8")
    print(f"Config created at {ENV_FILE}")

    from cli.setup_wizard import prompt_deepseek_api_key, save_key_to_env

    answer = input("Set your DeepSeek API key now? [Y/n]: ").strip().lower()
    if answer in ("", "y", "yes"):
        key = prompt_deepseek_api_key()
        save_key_to_env(ENV_FILE, key)
        print("\n✓ API key saved. Run: vertex")
    else:
        print("\nEdit the file later to set DEEPSEEK_API_KEY, then run: vertex")
