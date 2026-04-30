"""CLI entry points for the installed package."""

from __future__ import annotations

import os
import sys
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "vertex"
ENV_FILE = CONFIG_DIR / ".env"
VERTEX_CLI_CONFIG_DIR = Path.home() / ".vertex"
VERTEX_CLI_SETTINGS_FILE = VERTEX_CLI_CONFIG_DIR / "settings.json"


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


def _ensure_vertex_cli_settings(port: str) -> None:
    """Create default Vertex CLI settings without overwriting user settings."""
    if VERTEX_CLI_SETTINGS_FILE.exists():
        return

    import json

    VERTEX_CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    settings = {
        "env": {
            "ANTHROPIC_BASE_URL": f"http://127.0.0.1:{port}",
            "ANTHROPIC_AUTH_TOKEN": "freecc",
            "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek/deepseek-v4-pro",
            "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": "DeepSeek V4 Pro",
            "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek/deepseek-v4-flash",
            "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": "DeepSeek V4 Flash",
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek/deepseek-v4-flash",
            "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME": "DeepSeek V4 Flash",
        },
        "skipDangerousModePermissionPrompt": True,
        "model": "deepseek/deepseek-v4-pro",
    }
    VERTEX_CLI_SETTINGS_FILE.write_text(
        json.dumps(settings, indent=2) + "\n", encoding="utf-8"
    )


def _vertex_cli_bin() -> Path:
    """Return the vendored Vertex CLI launcher path."""
    if override := os.environ.get("VERTEX_CLI_BIN"):
        return Path(override).expanduser()
    return (
        Path(__file__).resolve().parents[1] / "vendor" / "vertex-cli" / "bin" / "vertex"
    )


def _node_bin() -> str | None:
    """Find a Node.js executable for the vendored CLI runtime."""
    import shutil

    if node := shutil.which("node"):
        return node

    nvm_root = Path.home() / ".nvm" / "versions" / "node"
    candidates = sorted(nvm_root.glob("*/bin/node"), reverse=True)
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return None


def _start_proxy() -> bool:
    """Start the Vertex proxy in background. Returns True if ready."""
    import subprocess
    import time
    import urllib.request

    # Determine port from settings or env
    port = os.environ.get("VERTEX_PORT", "8083")
    health_url = f"http://127.0.0.1:{port}/health"

    try:
        urllib.request.urlopen(health_url, timeout=1)
        return True  # Already running
    except Exception:
        pass

    print("Starting Vertex proxy...")
    subprocess.Popen(
        [
            sys.executable,
            "-m",
            "vertex_proxy",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    for _ in range(15):
        time.sleep(1)
        try:
            urllib.request.urlopen(health_url, timeout=1)
            return True
        except Exception:
            continue

    print(f"Warning: Proxy may not have started on port {port}.")
    return False


def cli() -> None:
    """Launch Vertex CLI: ensure proxy is running, open the vendored CLI runtime."""
    import subprocess

    _run_wizard_if_needed()

    # Handle logout
    if "--logout" in sys.argv or "/logout" in sys.argv:
        if ENV_FILE.exists():
            from cli.setup_wizard import run_setup_wizard

            run_setup_wizard(ENV_FILE)
            print("API key updated.")
            return
        print("No config found. Run: vertex-init")
        return

    vertex_cli = _vertex_cli_bin()
    if not vertex_cli.is_file():
        print(f"Error: Vertex CLI runtime not found at {vertex_cli}")
        print(
            "Reinstall Vertex or rebuild the package with vendor/vertex-cli included."
        )
        sys.exit(1)
    node_bin = _node_bin()
    if node_bin is None:
        print("Error: Node.js is required to run the Vertex CLI runtime.")
        print("Install Node.js 20+ and run vertex again.")
        sys.exit(1)

    port = os.environ.get("VERTEX_PORT", "8083")

    # Start proxy
    _start_proxy()

    _ensure_vertex_cli_settings(port)

    # Set env vars for Vertex to use the proxy.
    env = os.environ.copy()
    env["ANTHROPIC_BASE_URL"] = f"http://127.0.0.1:{port}"
    env["ANTHROPIC_AUTH_TOKEN"] = "freecc"

    # Launch Vertex CLI
    print("Launching Vertex CLI...")
    try:
        proc = subprocess.run([node_bin, str(vertex_cli), *sys.argv[1:]], env=env)
        sys.exit(proc.returncode)
    except FileNotFoundError:
        print(f"Error: Vertex CLI runtime not found at {vertex_cli}")
        sys.exit(1)


def serve() -> None:
    """Start the FastAPI server (registered as `vertex-proxy` script)."""
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
