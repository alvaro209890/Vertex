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


def _apply_theme(openclaude_bin: str) -> None:
    """Apply Vertex theme to OpenClaude CLI if not already patched."""
    import subprocess

    cli_mjs = Path(openclaude_bin).resolve().parent.parent / "dist" / "cli.mjs"
    if not cli_mjs.exists():
        # Try common npm paths
        for p in [
            "/usr/local/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs",
            "/usr/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs",
        ]:
            if Path(p).exists():
                cli_mjs = Path(p)
                break
        else:
            return  # Can't find the file, skip theme

    # Check if already patched (look for green ACCENT value)
    content = cli_mjs.read_text(encoding="utf-8")
    if "ACCENT = [0, 255, 136]" in content:
        return  # Already patched

    # Run the theme script
    script_url = (
        "https://raw.githubusercontent.com/alvaro209890/Vertex/main/"
        "scripts/apply-vertex-theme.sh"
    )
    try:
        subprocess.run(
            ["bash", "-c", f"curl -fsSL {script_url} | bash"],
            capture_output=True,
            timeout=30,
        )
        print("  ✓ Vertex theme applied to CLI")
    except Exception:
        print("  Warning: Could not auto-apply theme. Run the installer script.")


def _start_proxy() -> bool:
    """Start the Vertex proxy in background. Returns True if ready."""
    import subprocess
    import time
    import urllib.request

    try:
        urllib.request.urlopen("http://127.0.0.1:8082/health", timeout=1)
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
            urllib.request.urlopen("http://127.0.0.1:8082/health", timeout=1)
            return True
        except Exception:
            continue

    print("Warning: Proxy may not have started on port 8082.")
    return False


def cli() -> None:
    """Launch Vertex CLI: ensure proxy is running, apply theme, open OpenClaude."""
    import shutil
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

    # Find openclaude binary
    openclaude_bin = shutil.which("openclaude")
    if not openclaude_bin:
        print("Error: OpenClaude CLI not found.")
        print("Install: npm install -g @gitlawb/openclaude")
        print()
        print("Or use the one-command installer:")
        print(
            "  curl -fsSL https://raw.githubusercontent.com/alvaro209890/"
            "Vertex/main/scripts/install-vertex.sh | bash"
        )
        sys.exit(1)

    # Apply Vertex theme to OpenClaude
    _apply_theme(openclaude_bin)

    # Start proxy
    _start_proxy()

    # Set env vars for OpenClaude to use the proxy
    env = os.environ.copy()
    env["ANTHROPIC_BASE_URL"] = "http://127.0.0.1:8082"
    env["ANTHROPIC_AUTH_TOKEN"] = "freecc"

    # Launch OpenClaude CLI
    print("Launching Vertex CLI...")
    try:
        proc = subprocess.run([openclaude_bin, *sys.argv[1:]], env=env)
        sys.exit(proc.returncode)
    except FileNotFoundError:
        print(f"Error: OpenClaude binary not found at {openclaude_bin}")
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
