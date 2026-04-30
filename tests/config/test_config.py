"""Tests for config/settings.py"""

import pytest
from pydantic import ValidationError

from config.constants import (
    HTTP_CONNECT_TIMEOUT_DEFAULT,
)


class TestSettings:
    """Test Settings configuration."""

    def test_settings_loads(self):
        """Ensure Settings can be instantiated."""
        from config.settings import Settings

        settings = Settings()
        assert settings is not None

    def test_default_values(self, monkeypatch):
        """Test default values are set and have correct types."""
        from config.settings import Settings

        monkeypatch.delenv("MODEL", raising=False)
        monkeypatch.delenv("HTTP_READ_TIMEOUT", raising=False)
        monkeypatch.delenv("HTTP_CONNECT_TIMEOUT", raising=False)
        monkeypatch.setitem(Settings.model_config, "env_file", ())
        settings = Settings()
        assert settings.model == "deepseek/deepseek-v4-flash"
        assert isinstance(settings.provider_rate_limit, int)
        assert isinstance(settings.provider_rate_window, int)
        assert isinstance(settings.fast_prefix_detection, bool)
        assert isinstance(settings.enable_model_thinking, bool)
        assert settings.http_read_timeout == 120.0
        assert settings.http_connect_timeout == HTTP_CONNECT_TIMEOUT_DEFAULT
        assert settings.enable_web_server_tools is False
        assert settings.log_raw_api_payloads is False
        assert settings.log_raw_sse_events is False
        assert settings.debug_platform_edits is False
        assert settings.debug_subagent_stack is False

    def test_get_settings_cached(self):
        """Test get_settings returns cached instance."""
        from config.settings import get_settings

        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2  # Same object (cached)

    def test_model_setting(self):
        """Test model setting exists and is a string."""
        from config.settings import Settings

        settings = Settings()
        assert isinstance(settings.model, str)
        assert len(settings.model) > 0
        assert settings.model.startswith("deepseek/")

    def test_deepseek_base_url_constant(self):
        """Test DEEPSEEK_ANTHROPIC_DEFAULT_BASE is a constant."""
        from providers.defaults import DEEPSEEK_ANTHROPIC_DEFAULT_BASE

        assert DEEPSEEK_ANTHROPIC_DEFAULT_BASE == "https://api.deepseek.com/anthropic"

    def test_provider_rate_limit_from_env(self, monkeypatch):
        """PROVIDER_RATE_LIMIT env var is loaded into settings."""
        from config.settings import Settings

        monkeypatch.setenv("PROVIDER_RATE_LIMIT", "20")
        settings = Settings()
        assert settings.provider_rate_limit == 20

    def test_provider_rate_window_from_env(self, monkeypatch):
        """PROVIDER_RATE_WINDOW env var is loaded into settings."""
        from config.settings import Settings

        monkeypatch.setenv("PROVIDER_RATE_WINDOW", "30")
        settings = Settings()
        assert settings.provider_rate_window == 30

    def test_http_read_timeout_from_env(self, monkeypatch):
        """HTTP_READ_TIMEOUT env var is loaded into settings."""
        from config.settings import Settings

        monkeypatch.setenv("HTTP_READ_TIMEOUT", "600")
        settings = Settings()
        assert settings.http_read_timeout == 600.0

    def test_http_write_timeout_from_env(self, monkeypatch):
        """HTTP_WRITE_TIMEOUT env var is loaded into settings."""
        from config.settings import Settings

        monkeypatch.setenv("HTTP_WRITE_TIMEOUT", "20")
        settings = Settings()
        assert settings.http_write_timeout == 20.0

    def test_http_connect_timeout_from_env(self, monkeypatch):
        """HTTP_CONNECT_TIMEOUT env var is loaded into settings."""
        from config.settings import Settings

        monkeypatch.setenv("HTTP_CONNECT_TIMEOUT", "5")
        settings = Settings()
        assert settings.http_connect_timeout == 5.0

    def test_http_connect_timeout_default_matches_shared_constant(
        self, monkeypatch
    ) -> None:
        """Default must match config.constants (and README / .env.example)."""
        from config.settings import Settings

        monkeypatch.delenv("HTTP_CONNECT_TIMEOUT", raising=False)
        monkeypatch.setitem(Settings.model_config, "env_file", ())
        settings = Settings()
        assert settings.http_connect_timeout == HTTP_CONNECT_TIMEOUT_DEFAULT
        assert HTTP_CONNECT_TIMEOUT_DEFAULT == 10.0

    def test_enable_model_thinking_from_env(self, monkeypatch):
        """ENABLE_MODEL_THINKING env var is loaded into settings."""
        from config.settings import Settings

        monkeypatch.setenv("ENABLE_MODEL_THINKING", "false")
        settings = Settings()
        assert settings.enable_model_thinking is False

    def test_per_model_thinking_from_env(self, monkeypatch):
        """Per-model thinking env vars are loaded into settings."""
        from config.settings import Settings

        monkeypatch.setenv("ENABLE_OPUS_THINKING", "true")
        monkeypatch.setenv("ENABLE_SONNET_THINKING", "false")
        monkeypatch.setenv("ENABLE_HAIKU_THINKING", "false")
        settings = Settings()
        assert settings.enable_opus_thinking is True
        assert settings.enable_sonnet_thinking is False
        assert settings.enable_haiku_thinking is False

    def test_empty_per_model_thinking_inherits_model_default(self, monkeypatch):
        """Blank per-model thinking env vars are treated as unset."""
        from config.settings import Settings

        monkeypatch.setenv("ENABLE_MODEL_THINKING", "false")
        monkeypatch.setenv("ENABLE_OPUS_THINKING", "")
        settings = Settings()
        assert settings.enable_opus_thinking is None
        assert settings.resolve_thinking("claude-opus-4-20250514") is False

    def test_resolve_thinking_uses_model_tiers(self, monkeypatch):
        """resolve_thinking applies tier override then fallback."""
        from config.settings import Settings

        monkeypatch.setenv("ENABLE_MODEL_THINKING", "false")
        monkeypatch.setenv("ENABLE_OPUS_THINKING", "true")
        monkeypatch.setenv("ENABLE_HAIKU_THINKING", "false")
        settings = Settings()
        assert settings.resolve_thinking("claude-opus-4-20250514") is True
        assert settings.resolve_thinking("claude-sonnet-4-20250514") is False
        assert settings.resolve_thinking("claude-haiku-4-20250514") is False
        assert settings.resolve_thinking("unknown-model") is False

    def test_anthropic_auth_token_from_env_without_dotenv_key(self, monkeypatch):
        """ANTHROPIC_AUTH_TOKEN env var is loaded when dotenv does not define it."""
        from config.settings import Settings

        monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "process-token")
        monkeypatch.setitem(Settings.model_config, "env_file", ())
        settings = Settings()
        assert settings.anthropic_auth_token == "process-token"
        assert settings.uses_process_anthropic_auth_token() is True

    def test_empty_dotenv_anthropic_auth_token_overrides_process_env(
        self, monkeypatch, tmp_path
    ):
        """An explicit empty .env token disables auth despite stale shell tokens."""
        from config.settings import Settings

        env_file = tmp_path / ".env"
        env_file.write_text("ANTHROPIC_AUTH_TOKEN=\n", encoding="utf-8")
        monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "stale-client-token")
        monkeypatch.setitem(Settings.model_config, "env_file", (env_file,))

        settings = Settings()
        assert settings.anthropic_auth_token == ""
        assert settings.uses_process_anthropic_auth_token() is False

    def test_dotenv_anthropic_auth_token_overrides_process_env(
        self, monkeypatch, tmp_path
    ):
        """A configured .env token is the server token even with a stale shell token."""
        from config.settings import Settings

        env_file = tmp_path / ".env"
        env_file.write_text(
            'ANTHROPIC_AUTH_TOKEN="server-token"\n',
            encoding="utf-8",
        )
        monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "stale-client-token")
        monkeypatch.setitem(Settings.model_config, "env_file", (env_file,))

        settings = Settings()
        assert settings.anthropic_auth_token == "server-token"
        assert settings.uses_process_anthropic_auth_token() is False

    def test_removed_nim_enable_thinking_raises(self, monkeypatch):
        """NIM_ENABLE_THINKING now fails fast with a migration message."""
        from config.settings import Settings

        monkeypatch.setenv("NIM_ENABLE_THINKING", "false")
        with pytest.raises(ValidationError, match="ENABLE_MODEL_THINKING"):
            Settings()

    def test_removed_enable_thinking_raises(self, monkeypatch):
        """ENABLE_THINKING now fails fast with a migration message."""
        from config.settings import Settings

        monkeypatch.setenv("ENABLE_THINKING", "false")
        with pytest.raises(ValidationError, match="ENABLE_MODEL_THINKING"):
            Settings()

    def test_invalid_model_format_raises(self, monkeypatch):
        """Model without provider/ prefix raises ValidationError."""
        from config.settings import Settings

        monkeypatch.setenv("MODEL", "no-slash-model")
        with pytest.raises(ValidationError, match="provider type"):
            Settings()

    def test_non_deepseek_model_raises(self, monkeypatch):
        """Non-DeepSeek model raises ValidationError."""
        from config.settings import Settings

        monkeypatch.setenv("MODEL", "other/model")
        with pytest.raises(ValidationError, match="Only 'deepseek' provider"):
            Settings()


class TestSettingsOptionalStr:
    """Test Settings parse_optional_str validator."""

    def test_empty_telegram_token_to_none(self, monkeypatch):
        from config.settings import Settings

        monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "")
        s = Settings()
        assert s.telegram_bot_token is None

    def test_valid_telegram_token_preserved(self, monkeypatch):
        from config.settings import Settings

        monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "abc123")
        s = Settings()
        assert s.telegram_bot_token == "abc123"

    def test_empty_allowed_user_id_to_none(self, monkeypatch):
        from config.settings import Settings

        monkeypatch.setenv("ALLOWED_TELEGRAM_USER_ID", "")
        s = Settings()
        assert s.allowed_telegram_user_id is None

    def test_discord_bot_token_from_env(self, monkeypatch):
        from config.settings import Settings

        monkeypatch.setenv("DISCORD_BOT_TOKEN", "discord_token_123")
        s = Settings()
        assert s.discord_bot_token == "discord_token_123"

    def test_empty_discord_bot_token_to_none(self, monkeypatch):
        from config.settings import Settings

        monkeypatch.setenv("DISCORD_BOT_TOKEN", "")
        s = Settings()
        assert s.discord_bot_token is None

    def test_allowed_discord_channels_from_env(self, monkeypatch):
        from config.settings import Settings

        monkeypatch.setenv("ALLOWED_DISCORD_CHANNELS", "111,222,333")
        s = Settings()
        assert s.allowed_discord_channels == "111,222,333"

    def test_messaging_platform_from_env(self, monkeypatch):
        from config.settings import Settings

        monkeypatch.setenv("MESSAGING_PLATFORM", "discord")
        s = Settings()
        assert s.messaging_platform == "discord"

    def test_whisper_device_auto_rejected(self, monkeypatch):
        """WHISPER_DEVICE=auto raises ValidationError (auto removed)."""
        from config.settings import Settings

        monkeypatch.setenv("WHISPER_DEVICE", "auto")
        with pytest.raises(ValidationError, match="whisper_device"):
            Settings()

    @pytest.mark.parametrize("device", ["cpu", "cuda"])
    def test_whisper_device_valid(self, monkeypatch, device):
        """Valid whisper_device values are accepted."""
        from config.settings import Settings

        monkeypatch.setenv("WHISPER_DEVICE", device)
        s = Settings()
        assert s.whisper_device == device


class TestPerModelMapping:
    """Test per-model fields and resolve_model()."""

    def test_model_fields_default_none(self):
        """Per-model fields default to None."""
        from config.settings import Settings

        s = Settings()
        assert s.model_opus is None
        assert s.model_sonnet is None
        assert s.model_haiku is None

    def test_model_opus_from_env(self, monkeypatch):
        """MODEL_OPUS env var is loaded."""
        from config.settings import Settings

        monkeypatch.setenv("MODEL_OPUS", "deepseek/deepseek-v4-pro")
        s = Settings()
        assert s.model_opus == "deepseek/deepseek-v4-pro"

    @pytest.mark.parametrize("env_var", ["MODEL_OPUS", "MODEL_SONNET", "MODEL_HAIKU"])
    def test_empty_model_override_env_is_unset(self, monkeypatch, env_var):
        """Empty per-model override env vars are treated as unset."""
        from config.settings import Settings

        monkeypatch.setenv(env_var, "")
        s = Settings()
        assert getattr(s, env_var.lower()) is None
        assert (
            s.resolve_model(f"claude-{env_var.removeprefix('MODEL_').lower()}-4")
            == s.model
        )

    @pytest.mark.parametrize(
        "env_vars,expected_model",
        [
            ({"MODEL": "deepseek/deepseek-chat"}, "deepseek/deepseek-chat"),
            ({"MODEL": "deepseek/deepseek-v4-flash"}, "deepseek/deepseek-v4-flash"),
            ({"MODEL": "deepseek/deepseek-v4-pro"}, "deepseek/deepseek-v4-pro"),
        ],
    )
    def test_settings_models_from_env(self, env_vars, expected_model, monkeypatch):
        """Test environment variables override model defaults."""
        from config.settings import Settings

        for k, v in env_vars.items():
            monkeypatch.setenv(k, v)

        s = Settings()
        assert s.model == expected_model

    def test_model_sonnet_from_env(self, monkeypatch):
        """MODEL_SONNET env var is loaded."""
        from config.settings import Settings

        monkeypatch.setenv("MODEL_SONNET", "deepseek/deepseek-v4-flash")
        s = Settings()
        assert s.model_sonnet == "deepseek/deepseek-v4-flash"

    def test_model_haiku_from_env(self, monkeypatch):
        """MODEL_HAIKU env var is loaded."""
        from config.settings import Settings

        monkeypatch.setenv("MODEL_HAIKU", "deepseek/deepseek-v4-flash")
        s = Settings()
        assert s.model_haiku == "deepseek/deepseek-v4-flash"

    def test_model_opus_no_slash_raises(self, monkeypatch):
        """MODEL_OPUS without provider prefix raises ValidationError."""
        from config.settings import Settings

        monkeypatch.setenv("MODEL_OPUS", "noprefix")
        with pytest.raises(ValidationError, match="provider type"):
            Settings()

    def test_model_invalid_provider_raises(self, monkeypatch):
        """MODEL with non-DeepSeek provider prefix raises ValidationError."""
        from config.settings import Settings

        monkeypatch.setenv("MODEL_OPUS", "other/model")
        with pytest.raises(ValidationError, match="Only 'deepseek' provider"):
            Settings()

    def test_resolve_model_opus_override(self):
        """resolve_model returns model_opus for opus model names."""
        from config.settings import Settings

        s = Settings()
        s.model_opus = "deepseek/deepseek-v4-pro"
        assert s.resolve_model("claude-opus-4-20250514") == "deepseek/deepseek-v4-pro"
        assert s.resolve_model("claude-3-opus") == "deepseek/deepseek-v4-pro"
        assert s.resolve_model("claude-3-opus-20240229") == "deepseek/deepseek-v4-pro"

    def test_resolve_model_sonnet_override(self):
        """resolve_model returns model_sonnet for sonnet model names."""
        from config.settings import Settings

        s = Settings()
        s.model_sonnet = "deepseek/deepseek-v4-pro"
        assert s.resolve_model("claude-sonnet-4-20250514") == "deepseek/deepseek-v4-pro"
        assert (
            s.resolve_model("claude-3-5-sonnet-20241022") == "deepseek/deepseek-v4-pro"
        )

    def test_resolve_model_haiku_override(self):
        """resolve_model returns model_haiku for haiku model names."""
        from config.settings import Settings

        s = Settings()
        s.model_haiku = "deepseek/deepseek-v4-pro"
        assert s.resolve_model("claude-3-haiku-20240307") == "deepseek/deepseek-v4-pro"
        assert (
            s.resolve_model("claude-3-5-haiku-20241022") == "deepseek/deepseek-v4-pro"
        )
        assert s.resolve_model("claude-haiku-4-20250514") == "deepseek/deepseek-v4-pro"

    def test_resolve_model_fallback_when_override_not_set(self):
        """resolve_model falls back to MODEL when model override is None."""
        from config.settings import Settings

        s = Settings()
        s.model = "deepseek/deepseek-v4-flash"
        # No model overrides set
        assert s.resolve_model("claude-opus-4-20250514") == "deepseek/deepseek-v4-flash"
        assert (
            s.resolve_model("claude-sonnet-4-20250514") == "deepseek/deepseek-v4-flash"
        )
        assert (
            s.resolve_model("claude-3-haiku-20240307") == "deepseek/deepseek-v4-flash"
        )

    def test_resolve_model_unknown_model_falls_back(self):
        """resolve_model falls back to MODEL for unrecognized model names."""
        from config.settings import Settings

        s = Settings()
        s.model = "deepseek/deepseek-v4-flash"
        s.model_opus = "deepseek/deepseek-v4-pro"
        assert s.resolve_model("claude-2.1") == "deepseek/deepseek-v4-flash"
        assert s.resolve_model("some-unknown-model") == "deepseek/deepseek-v4-flash"

    def test_resolve_model_case_insensitive(self):
        """Model classification is case-insensitive."""
        from config.settings import Settings

        s = Settings()
        s.model_opus = "deepseek/deepseek-v4-pro"
        assert s.resolve_model("Claude-OPUS-4") == "deepseek/deepseek-v4-pro"

    def test_parse_provider_type(self):
        """parse_provider_type extracts provider from model string."""
        from config.settings import Settings

        assert Settings.parse_provider_type("deepseek/deepseek-chat") == "deepseek"

    def test_parse_model_name(self):
        """parse_model_name extracts model name from model string."""
        from config.settings import Settings

        assert Settings.parse_model_name("deepseek/deepseek-chat") == "deepseek-chat"
