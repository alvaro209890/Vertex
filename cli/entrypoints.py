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
DEEPSEEK_ONLY_DEFAULT_MODEL = DEFAULT_MODEL
MANAGED_VERTEX_CLI_ENV_BASE = {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:{port}",
    "ANTHROPIC_AUTH_TOKEN": "freecc",
    "DISABLE_LOGIN_COMMAND": "1",
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


def _load_runtime_env_values() -> dict[str, str]:
    """Load env values in the same order used by Settings."""
    from dotenv import dotenv_values

    files = [ENV_FILE, Path(".env")]
    if explicit := os.environ.get("VERTEX_ENV_FILE"):
        files.append(Path(explicit))

    values: dict[str, str] = {}
    for env_file in files:
        if env_file.is_file():
            for key, value in dotenv_values(env_file).items():
                values[key] = "" if value is None else value

    return {**values, **os.environ}


def _configured_model_values() -> dict[str, str]:
    """Return model defaults that the vendored CLI should advertise."""
    values = _load_runtime_env_values()
    fallback = _deepseek_model_or_default(values.get("MODEL"))
    return {
        "default": fallback,
        "opus": _deepseek_model_or_default(values.get("MODEL_OPUS"), fallback),
        "sonnet": _deepseek_model_or_default(values.get("MODEL_SONNET"), fallback),
        "haiku": _deepseek_model_or_default(values.get("MODEL_HAIKU"), fallback),
    }


def _deepseek_model_or_default(
    model_ref: str | None, default: str = DEEPSEEK_ONLY_DEFAULT_MODEL
) -> str:
    """Return a DeepSeek model ref; ignore any non-DeepSeek provider config."""
    if model_ref and model_ref.startswith("deepseek/"):
        return model_ref
    return default


def _display_model_name(model_ref: str) -> str:
    """Return a compact model display name for vendored CLI settings."""
    if "/" not in model_ref:
        return model_ref
    provider, model_name = model_ref.split("/", 1)
    return f"{provider}: {model_name}"


def _credential_env_for_model(model_ref: str) -> str | None:
    """Return the credential env var required by Vertex's DeepSeek-only mode."""
    return "DEEPSEEK_API_KEY"


def _needs_api_key() -> bool:
    """Check whether the configured provider credential is missing or empty."""
    values = _load_runtime_env_values()
    model_ref = _deepseek_model_or_default(values.get("MODEL"))
    credential_env = _credential_env_for_model(model_ref)
    if credential_env is None:
        return False
    return not _env_value_is_set(values.get(credential_env))


def _run_wizard_if_needed() -> None:
    """Run the setup wizard when the configured provider key is not configured."""
    if not _needs_api_key():
        return
    from cli.setup_wizard import run_setup_wizard

    run_setup_wizard(ENV_FILE)


def _is_api_key_setup_request(argv: list[str] | None = None) -> bool:
    """Return whether CLI args request provider API key setup."""
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
    """Handle login/logout aliases with provider API-key setup."""
    if not _is_api_key_setup_request():
        return False

    from cli.setup_wizard import run_setup_wizard

    run_setup_wizard(ENV_FILE)
    if restart_message:
        print("Provider API key updated. Restart Vertex to apply changes.")
    else:
        print("Provider API key updated.")
    return True


def _handle_disabled_anthropic_token_setup() -> bool:
    """Block Anthropic OAuth token setup from the Vertex entrypoint."""
    if not _is_anthropic_token_setup_request():
        return False
    print("Anthropic account login is disabled in Vertex.")
    print("Use `vertex /logout` or `vertex auth login` to set a provider API key.")
    return True


def _handle_api_key_status_request() -> bool:
    """Report configured provider API-key status without invoking Anthropic auth status."""
    if not _is_api_key_status_request():
        return False

    values = _load_runtime_env_values()
    model_ref = _deepseek_model_or_default(values.get("MODEL"))
    provider_id = "deepseek"
    credential_env = _credential_env_for_model(model_ref)
    configured = credential_env is None or _env_value_is_set(values.get(credential_env))

    if "--json" in sys.argv:
        import json

        print(
            json.dumps(
                {
                    "loggedIn": configured,
                    "authMethod": "provider_api_key" if configured else "none",
                    "apiProvider": provider_id,
                    "credentialEnv": credential_env,
                },
                indent=2,
            )
        )
    elif configured:
        if credential_env is None:
            print(f"{provider_id} provider: no API key required")
        else:
            print(f"{credential_env}: configured")
    else:
        print(f"{credential_env}: not configured")
        print("Run `vertex auth login` to set a provider API key.")
    return True


def _managed_vertex_cli_env(port: str) -> dict[str, str]:
    """Return environment values that force the vendored CLI through Vertex."""
    models = _configured_model_values()
    env = {
        key: value.format(port=port)
        for key, value in MANAGED_VERTEX_CLI_ENV_BASE.items()
    }
    env.update(
        {
            "ANTHROPIC_DEFAULT_OPUS_MODEL": models["opus"],
            "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": _display_model_name(models["opus"]),
            "ANTHROPIC_DEFAULT_SONNET_MODEL": models["sonnet"],
            "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": _display_model_name(
                models["sonnet"]
            ),
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": models["haiku"],
            "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME": _display_model_name(models["haiku"]),
        }
    )
    return env


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
    for key in (
        "CLAUDE_CODE_USE_OPENAI",
        "CLAUDE_CODE_USE_GEMINI",
        "CLAUDE_CODE_USE_MISTRAL",
        "CLAUDE_CODE_USE_GITHUB",
        "CLAUDE_CODE_USE_BEDROCK",
        "CLAUDE_CODE_USE_VERTEX",
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "OPENAI_API_BASE",
        "OPENAI_MODEL",
    ):
        env.pop(key, None)
    env.update(_managed_vertex_cli_env(port))
    models = _configured_model_values()
    settings.update(
        {
            "env": env,
            "skipDangerousModePermissionPrompt": True,
            "model": models["default"],
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

    from cli.setup_wizard import run_setup_wizard

    answer = input("Set a provider API key now? [Y/n]: ").strip().lower()
    if answer in ("", "y", "yes"):
        run_setup_wizard(ENV_FILE)
        print("\n✓ API key saved. Run: vertex")
    else:
        print("\nEdit the file later to set provider API credentials, then run: vertex")
