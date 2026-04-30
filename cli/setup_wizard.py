"""First-run setup wizard for provider API keys and model routing."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

GREEN = "\033[92m"
RESET = "\033[0m"
BOLD = "\033[1m"


@dataclass(frozen=True, slots=True)
class ProviderSetupOption:
    """Interactive setup option for a remotely hosted provider."""

    provider_id: str
    display_name: str
    credential_env: str
    default_model: str
    key_url: str
    enable_thinking: bool = False


PROVIDER_SETUP_OPTIONS: tuple[ProviderSetupOption, ...] = (
    ProviderSetupOption(
        provider_id="deepseek",
        display_name="DeepSeek",
        credential_env="DEEPSEEK_API_KEY",
        default_model="deepseek/deepseek-v4-flash",
        key_url="https://platform.deepseek.com/api_keys",
    ),
)
DEFAULT_SETUP_OPTION = PROVIDER_SETUP_OPTIONS[0]


def _banner() -> None:
    """Print the branded Vertex setup banner."""
    print()
    print(f"{GREEN}{'=' * 54}{RESET}")
    print(f"{GREEN}  Welcome to Vertex — DeepSeek CLI and local proxy{RESET}")
    print(f"{GREEN}{'=' * 54}{RESET}")
    print()
    print("Vertex uses DeepSeek for all chat requests.")
    print()


def prompt_provider_option() -> ProviderSetupOption:
    """Prompt user for a provider setup option."""
    return DEFAULT_SETUP_OPTION


def prompt_provider_api_key(option: ProviderSetupOption) -> str:
    """Prompt user interactively for the selected provider API key."""
    print(f"Get a {option.display_name} key at: {option.key_url}")
    while True:
        key = input(f"{BOLD}{option.display_name} API key:{RESET} ").strip()
        if not key:
            print("  Key cannot be empty. Try again.")
            continue
        return key


def prompt_deepseek_api_key() -> str:
    """Prompt user interactively for a DeepSeek API key."""
    deepseek = next(
        option for option in PROVIDER_SETUP_OPTIONS if option.provider_id == "deepseek"
    )
    return prompt_provider_api_key(deepseek)


def _write_env_updates(env_path: Path, updates: dict[str, str]) -> None:
    """Write or update a small set of dotenv assignments."""
    env_path.parent.mkdir(parents=True, exist_ok=True)
    desired = {key: f'{key}="{value}"' for key, value in updates.items()}

    if not env_path.exists():
        body = "\n".join(desired.values())
        env_path.write_text(f"# Vertex Proxy\n{body}\n", encoding="utf-8")
        return

    lines = env_path.read_text(encoding="utf-8").splitlines()
    seen: set[str] = set()
    new_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        key = stripped.split("=", 1)[0] if "=" in stripped else ""
        if key in desired:
            new_lines.append(desired[key])
            seen.add(key)
        else:
            new_lines.append(line)

    for key, line in desired.items():
        if key not in seen:
            new_lines.append(line)

    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def save_provider_config_to_env(
    env_path: Path,
    option: ProviderSetupOption,
    api_key: str,
) -> None:
    """Write or update the provider credential and model routing in the env file."""
    updates = {
        option.credential_env: api_key,
        "MODEL": option.default_model,
        "MODEL_OPUS": option.default_model,
        "MODEL_SONNET": option.default_model,
        "MODEL_HAIKU": option.default_model,
        "ENABLE_MODEL_THINKING": "true" if option.enable_thinking else "false",
    }
    _write_env_updates(env_path, updates)


def save_key_to_env(env_path: Path, api_key: str) -> None:
    """Write or update DEEPSEEK_API_KEY in the env file."""
    deepseek = next(
        option for option in PROVIDER_SETUP_OPTIONS if option.provider_id == "deepseek"
    )
    _write_env_updates(env_path, {deepseek.credential_env: api_key})


def run_setup_wizard(env_path: Path) -> str:
    """Run the interactive setup wizard. Returns the API key."""
    _banner()
    option = prompt_provider_option()
    api_key = prompt_provider_api_key(option)
    save_provider_config_to_env(env_path, option, api_key)
    print(f"\n{GREEN}✓ Key saved to {env_path}{RESET}")
    print(f"  Provider: {option.display_name}")
    print(f"  Model: {option.default_model}")
    print(f"  Run {GREEN}vertex --logout{RESET} to change it later.")
    print()
    return api_key
