"""CLI entry points for the installed package."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / ".config" / "vertex"
ENV_FILE = CONFIG_DIR / ".env"
VERTEX_CLI_CONFIG_DIR = Path.home() / ".vertex"
VERTEX_CLI_SETTINGS_FILE = VERTEX_CLI_CONFIG_DIR / "settings.json"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
MANAGED_VERTEX_CLI_ENV = {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:{port}",
    "ANTHROPIC_AUTH_TOKEN": "freecc",
    "DISABLE_LOGIN_COMMAND": "1",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek/deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": "DeepSeek V4 Flash",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek/deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": "DeepSeek V4 Flash",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek/deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME": "DeepSeek V4 Flash",
}
API_AUTH_COMMANDS = {
    ("auth", "login"),
    ("auth", "logout"),
    ("login",),
    ("logout",),
}
API_AUTH_FLAGS = {"/login", "/logout", "--login", "--logout"}


def _env_value_is_set(value: str | None) -> bool:
    """Return whether a dotenv value contains non-whitespace text."""
    return bool((value or "").strip())


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

    if ENV_FILE.is_file():
        values = dotenv_values(ENV_FILE)
        if _env_value_is_set(values.get("DEEPSEEK_API_KEY")):
            return False
    return True


def _run_wizard_if_needed() -> None:
    """Run the setup wizard when DEEPSEEK_API_KEY is not configured."""
    if not _needs_api_key():
        return
    from cli.setup_wizard import run_setup_wizard

    run_setup_wizard(ENV_FILE)


def _is_api_key_setup_request(argv: list[str] | None = None) -> bool:
    """Return whether CLI args request DeepSeek API key setup."""
    args = list(sys.argv[1:] if argv is None else argv[1:])
    lowered = [arg.lower() for arg in args]
    if any(arg in API_AUTH_FLAGS for arg in lowered):
        return True
    return (
        tuple(lowered[:2]) in API_AUTH_COMMANDS
        or tuple(lowered[:1]) in API_AUTH_COMMANDS
    )


def _is_anthropic_token_setup_request(argv: list[str] | None = None) -> bool:
    """Return whether args request an Anthropic-only token flow."""
    args = list(sys.argv[1:] if argv is None else argv[1:])
    return bool(args and args[0].lower() == "setup-token")


def _is_api_key_status_request(argv: list[str] | None = None) -> bool:
    """Return whether CLI args request auth status."""
    args = list(sys.argv[1:] if argv is None else argv[1:])
    lowered = [arg.lower() for arg in args]
    return tuple(lowered[:2]) == ("auth", "status")


def _handle_api_key_setup_request(*, restart_message: bool) -> bool:
    """Handle login/logout aliases with the only supported login: DeepSeek API key."""
    if not _is_api_key_setup_request():
        return False

    from cli.setup_wizard import run_setup_wizard

    run_setup_wizard(ENV_FILE)
    if restart_message:
        print("DeepSeek API key updated. Restart Vertex to apply changes.")
    else:
        print("DeepSeek API key updated.")
    return True


def _handle_disabled_anthropic_token_setup() -> bool:
    """Block Anthropic OAuth token setup from the Vertex entrypoint."""
    if not _is_anthropic_token_setup_request():
        return False
    print("Anthropic account login is disabled in Vertex.")
    print("Use `vertex /logout` or `vertex auth login` to set a DeepSeek API key.")
    return True


def _handle_api_key_status_request() -> bool:
    """Report DeepSeek API key status without invoking Anthropic auth status."""
    if not _is_api_key_status_request():
        return False

    from dotenv import dotenv_values

    configured = False
    if ENV_FILE.is_file():
        configured = _env_value_is_set(dotenv_values(ENV_FILE).get("DEEPSEEK_API_KEY"))

    if "--json" in sys.argv:
        import json

        print(
            json.dumps(
                {
                    "loggedIn": configured,
                    "authMethod": "deepseek_api_key" if configured else "none",
                    "apiProvider": "deepseek",
                },
                indent=2,
            )
        )
    elif configured:
        print("DeepSeek API key: configured")
    else:
        print("DeepSeek API key: not configured")
        print("Run `vertex auth login` to set a DeepSeek API key.")
    return True


def _ensure_vertex_cli_settings(port: str) -> None:
    """Create/update Vertex CLI settings owned by this wrapper."""
    import json

    VERTEX_CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    settings: dict[str, Any] = {}
    if VERTEX_CLI_SETTINGS_FILE.exists():
        try:
            raw_settings = json.loads(VERTEX_CLI_SETTINGS_FILE.read_text("utf-8"))
            if isinstance(raw_settings, dict):
                settings = raw_settings
        except json.JSONDecodeError:
            settings = {}

    raw_env = settings.get("env")
    env: dict[str, Any] = dict(raw_env) if isinstance(raw_env, dict) else {}
    env.update(
        {key: value.format(port=port) for key, value in MANAGED_VERTEX_CLI_ENV.items()}
    )
    settings.update(
        {
            "env": env,
            "skipDangerousModePermissionPrompt": True,
            "model": DEFAULT_MODEL,
        }
    )
    for key in (
        "provider",
        "providerProfile",
        "provider_profile",
        "apiProvider",
    ):
        settings.pop(key, None)
    VERTEX_CLI_SETTINGS_FILE.write_text(
        json.dumps(settings, indent=2) + "\n", encoding="utf-8"
    )


def _managed_vertex_cli_env(port: str) -> dict[str, str]:
    """Return environment values that force the vendored CLI through Vertex."""
    return {
        key: value.format(port=port) for key, value in MANAGED_VERTEX_CLI_ENV.items()
    }


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

    if _handle_api_key_setup_request(restart_message=False):
        return
    if _handle_api_key_status_request():
        return
    if _handle_disabled_anthropic_token_setup():
        return

    _run_wizard_if_needed()

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
    _ensure_vertex_cli_settings(port)

    # Start proxy
    _start_proxy()

    # Set env vars for Vertex to use the proxy.
    env = os.environ.copy()
    for key in (
        "CLAUDE_CODE_USE_OPENAI",
        "CLAUDE_CODE_USE_GEMINI",
        "CLAUDE_CODE_USE_MISTRAL",
        "CLAUDE_CODE_USE_GITHUB",
        "CLAUDE_CODE_USE_BEDROCK",
        "CLAUDE_CODE_USE_VERTEX",
        "OPENAI_API_BASE",
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "OPENAI_MODEL",
        "OPENCLAUDE_EXTRA_MODEL_OPTIONS",
    ):
        env.pop(key, None)
    env["CLAUDE_CONFIG_DIR"] = str(VERTEX_CLI_CONFIG_DIR)
    env.update(_managed_vertex_cli_env(port))

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
    if _handle_api_key_setup_request(restart_message=True):
        return
    if _handle_api_key_status_request():
        return
    if _handle_disabled_anthropic_token_setup():
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
