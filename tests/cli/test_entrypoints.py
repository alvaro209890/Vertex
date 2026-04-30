"""Tests for cli/entrypoints.py — vertex entrypoint logic."""

import os
from contextlib import suppress
from pathlib import Path
from unittest.mock import patch


def _run_init(tmp_home: Path) -> tuple[str, Path]:
    """Run init() with home directory redirected to tmp_home. Returns (printed output, env_file path)."""
    from cli import entrypoints

    config_dir = tmp_home / ".config" / "vertex"
    env_file = tmp_home / ".config" / "vertex" / ".env"
    printed: list[str] = []

    with (
        patch.object(entrypoints, "CONFIG_DIR", config_dir),
        patch.object(entrypoints, "ENV_FILE", env_file),
        patch(
            "builtins.print",
            side_effect=lambda *a: printed.append(" ".join(str(x) for x in a)),
        ),
        patch("builtins.input", return_value="n"),
    ):
        entrypoints.init()

    return "\n".join(printed), env_file


def test_init_creates_env_file(tmp_path: Path) -> None:
    """init() creates .env from the bundled template when it doesn't exist yet."""
    output, env_file = _run_init(tmp_path)

    assert env_file.exists()
    assert env_file.stat().st_size > 0
    assert str(env_file) in output


def test_init_copies_template_content(tmp_path: Path) -> None:
    """init() writes the canonical root env.example content, not an empty file."""
    template = (Path(__file__).resolve().parents[2] / ".env.example").read_text(
        encoding="utf-8"
    )
    _, env_file = _run_init(tmp_path)

    assert env_file.read_text("utf-8") == template


def test_env_template_loader_uses_root_template_in_source_checkout() -> None:
    """Source checkout fallback uses the root .env.example as the single source."""
    from cli.entrypoints import _load_env_template

    template = (Path(__file__).resolve().parents[2] / ".env.example").read_text(
        encoding="utf-8"
    )

    assert _load_env_template() == template


def test_init_creates_parent_directories(tmp_path: Path) -> None:
    """init() creates ~/.config/vertex/ even if it doesn't exist."""
    config_dir = tmp_path / ".config" / "vertex"
    assert not config_dir.exists()

    _run_init(tmp_path)

    assert config_dir.is_dir()


def test_init_skips_if_env_already_exists(tmp_path: Path) -> None:
    """init() does not overwrite an existing .env and prints a warning."""
    # Create it first
    _run_init(tmp_path)

    env_file = tmp_path / ".config" / "vertex" / ".env"
    env_file.write_text("existing content", encoding="utf-8")

    output, _ = _run_init(tmp_path)

    assert env_file.read_text("utf-8") == "existing content"
    assert "already exists" in output


def test_init_prints_next_step_hint(tmp_path: Path) -> None:
    """init() tells the user to run vertex after editing .env."""
    output, _ = _run_init(tmp_path)

    assert "vertex" in output


def test_vertex_cli_bin_defaults_to_vendored_runtime() -> None:
    """vertex resolves its own vendored CLI runtime, not an openclaude binary."""
    from cli.entrypoints import _vertex_cli_bin

    with patch.dict(os.environ, {}, clear=True):
        assert _vertex_cli_bin().as_posix().endswith("vendor/vertex-cli/bin/vertex")


def test_vertex_cli_bin_allows_explicit_override(tmp_path: Path) -> None:
    """VERTEX_CLI_BIN can point tests or custom installs at another runtime."""
    from cli.entrypoints import _vertex_cli_bin

    override = tmp_path / "vertex"
    with patch.dict(os.environ, {"VERTEX_CLI_BIN": str(override)}):
        assert _vertex_cli_bin() == override


def test_cli_launches_vendored_vertex_runtime(tmp_path: Path) -> None:
    """cli() launches the configured Vertex runtime without resolving openclaude."""
    import sys

    from cli import entrypoints

    vertex_bin = tmp_path / "vertex"
    vertex_bin.write_text("#!/usr/bin/env node\n", encoding="utf-8")
    node_bin = tmp_path / "node"
    node_bin.write_text("", encoding="utf-8")

    with (
        patch.object(entrypoints, "_run_wizard_if_needed"),
        patch.object(entrypoints, "_start_proxy", return_value=True),
        patch.object(entrypoints, "_node_bin", return_value=str(node_bin)),
        patch.dict(os.environ, {"VERTEX_CLI_BIN": str(vertex_bin)}, clear=False),
        patch.object(sys, "argv", ["vertex", "--version"]),
        patch("subprocess.run") as run,
        patch("sys.exit", side_effect=SystemExit) as exit_,
    ):
        run.return_value.returncode = 7
        with suppress(SystemExit):
            entrypoints.cli()

    run.assert_called_once()
    assert run.call_args.args[0] == [str(node_bin), str(vertex_bin), "--version"]
    assert run.call_args.kwargs["env"]["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:8083"
    exit_.assert_called_once_with(7)


def test_cli_creates_default_vertex_settings(tmp_path: Path) -> None:
    """cli() creates ~/.vertex/settings.json defaults when missing."""
    import json
    import sys

    from cli import entrypoints

    vertex_bin = tmp_path / "vertex"
    vertex_bin.write_text("#!/usr/bin/env node\n", encoding="utf-8")
    node_bin = tmp_path / "node"
    node_bin.write_text("", encoding="utf-8")
    settings_file = tmp_path / ".vertex" / "settings.json"

    with (
        patch.object(entrypoints, "_run_wizard_if_needed"),
        patch.object(entrypoints, "_start_proxy", return_value=True),
        patch.object(entrypoints, "_node_bin", return_value=str(node_bin)),
        patch.object(entrypoints, "VERTEX_CLI_CONFIG_DIR", settings_file.parent),
        patch.object(entrypoints, "VERTEX_CLI_SETTINGS_FILE", settings_file),
        patch.dict(os.environ, {"VERTEX_CLI_BIN": str(vertex_bin)}, clear=False),
        patch.object(sys, "argv", ["vertex", "--version"]),
        patch("subprocess.run") as run,
        patch("sys.exit", side_effect=SystemExit),
        suppress(SystemExit),
    ):
        run.return_value.returncode = 0
        entrypoints.cli()

    settings = json.loads(settings_file.read_text(encoding="utf-8"))
    assert settings["env"]["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:8083"
    assert settings["env"]["ANTHROPIC_AUTH_TOKEN"] == "freecc"
    assert settings["env"]["DISABLE_LOGIN_COMMAND"] == "1"
    assert settings["skipDangerousModePermissionPrompt"] is True


def test_cli_overwrites_stale_openclaude_settings(tmp_path: Path) -> None:
    """cli() forces managed Vertex/DeepSeek settings over stale provider config."""
    import json
    import sys

    from cli import entrypoints

    vertex_bin = tmp_path / "vertex"
    vertex_bin.write_text("#!/usr/bin/env node\n", encoding="utf-8")
    node_bin = tmp_path / "node"
    node_bin.write_text("", encoding="utf-8")
    settings_file = tmp_path / ".vertex" / "settings.json"
    settings_file.parent.mkdir(parents=True)
    settings_file.write_text(
        json.dumps(
            {
                "env": {
                    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
                    "OPENAI_API_KEY": "old-openai-key",
                },
                "model": "nvidia_nim/z-ai/glm4.7",
                "provider": "openclaude",
                "customSetting": True,
            }
        ),
        encoding="utf-8",
    )

    with (
        patch.object(entrypoints, "_run_wizard_if_needed"),
        patch.object(entrypoints, "_start_proxy", return_value=True),
        patch.object(entrypoints, "_node_bin", return_value=str(node_bin)),
        patch.object(entrypoints, "VERTEX_CLI_CONFIG_DIR", settings_file.parent),
        patch.object(entrypoints, "VERTEX_CLI_SETTINGS_FILE", settings_file),
        patch.dict(os.environ, {"VERTEX_CLI_BIN": str(vertex_bin)}, clear=False),
        patch.object(sys, "argv", ["vertex", "--version"]),
        patch("subprocess.run") as run,
        patch("sys.exit", side_effect=SystemExit),
        suppress(SystemExit),
    ):
        run.return_value.returncode = 0
        entrypoints.cli()

    settings = json.loads(settings_file.read_text(encoding="utf-8"))
    assert settings["env"]["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:8083"
    assert settings["env"]["ANTHROPIC_AUTH_TOKEN"] == "freecc"
    assert settings["env"]["DISABLE_LOGIN_COMMAND"] == "1"
    assert settings["env"]["OPENAI_API_KEY"] == "old-openai-key"
    assert settings["model"] == "deepseek/deepseek-v4-flash"
    assert settings["customSetting"] is True
    assert "provider" not in settings


def test_cli_logout_updates_deepseek_key_before_auto_wizard(tmp_path: Path) -> None:
    """`vertex /logout` updates the DeepSeek key even when the old key is empty."""
    import sys

    from cli import entrypoints

    env_file = tmp_path / ".config" / "vertex" / ".env"
    env_file.parent.mkdir(parents=True)
    env_file.write_text('DEEPSEEK_API_KEY=""\n', encoding="utf-8")
    printed: list[str] = []

    with (
        patch.object(entrypoints, "ENV_FILE", env_file),
        patch.object(sys, "argv", ["vertex", "/logout"]),
        patch("builtins.input", return_value="sk-new-deepseek"),
        patch(
            "builtins.print",
            side_effect=lambda *a: printed.append(" ".join(str(x) for x in a)),
        ),
        patch("subprocess.run") as run,
    ):
        entrypoints.cli()

    run.assert_not_called()
    assert 'DEEPSEEK_API_KEY="sk-new-deepseek"' in env_file.read_text(encoding="utf-8")
    assert "DeepSeek API key updated." in "\n".join(printed)


def test_cli_auth_login_maps_to_deepseek_key_setup(tmp_path: Path) -> None:
    """`vertex auth login` is API-key setup, not Anthropic OAuth."""
    import sys

    from cli import entrypoints

    env_file = tmp_path / ".config" / "vertex" / ".env"
    env_file.parent.mkdir(parents=True)
    env_file.write_text('DEEPSEEK_API_KEY="old"\n', encoding="utf-8")

    with (
        patch.object(entrypoints, "ENV_FILE", env_file),
        patch.object(sys, "argv", ["vertex", "auth", "login"]),
        patch("builtins.input", return_value="sk-deepseek-next"),
        patch("subprocess.run") as run,
    ):
        entrypoints.cli()

    run.assert_not_called()
    assert 'DEEPSEEK_API_KEY="sk-deepseek-next"' in env_file.read_text(encoding="utf-8")


def test_cli_auth_status_reports_deepseek_key_status(tmp_path: Path) -> None:
    """`vertex auth status` reports DeepSeek API-key status, not Anthropic auth."""
    import sys

    from cli import entrypoints

    env_file = tmp_path / ".config" / "vertex" / ".env"
    env_file.parent.mkdir(parents=True)
    env_file.write_text('DEEPSEEK_API_KEY="sk-configured"\n', encoding="utf-8")
    printed: list[str] = []

    with (
        patch.object(entrypoints, "ENV_FILE", env_file),
        patch.object(sys, "argv", ["vertex", "auth", "status"]),
        patch(
            "builtins.print",
            side_effect=lambda *a: printed.append(" ".join(str(x) for x in a)),
        ),
        patch("subprocess.run") as run,
    ):
        entrypoints.cli()

    run.assert_not_called()
    assert "\n".join(printed) == "DeepSeek API key: configured"


def test_cli_blocks_anthropic_setup_token() -> None:
    """The Anthropic token/OAuth setup command is not reachable through vertex."""
    import sys

    from cli import entrypoints

    printed: list[str] = []
    with (
        patch.object(sys, "argv", ["vertex", "setup-token"]),
        patch(
            "builtins.print",
            side_effect=lambda *a: printed.append(" ".join(str(x) for x in a)),
        ),
        patch("subprocess.run") as run,
    ):
        entrypoints.cli()

    run.assert_not_called()
    assert "Anthropic account login is disabled in Vertex." in "\n".join(printed)
