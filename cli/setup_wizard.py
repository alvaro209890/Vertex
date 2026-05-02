"""Assistente de primeiro uso para chave DeepSeek e roteamento de modelo."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

GREEN = "\033[92m"
RESET = "\033[0m"
BOLD = "\033[1m"


@dataclass(frozen=True, slots=True)
class ProviderSetupOption:
    """Opcao interativa de configuracao para um provedor remoto."""

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
INVALID_API_KEY_COMMAND_VALUES = {"/login", "/logout", "--login", "--logout"}


def _banner() -> None:
    """Imprimir o banner de configuracao do Vertex."""
    print()
    print(f"{GREEN}{'=' * 54}{RESET}")
    print(f"{GREEN}  Bem-vindo ao Vertex — CLI DeepSeek e proxy local{RESET}")
    print(f"{GREEN}{'=' * 54}{RESET}")
    print()
    print("O Vertex usa DeepSeek para todas as conversas.")
    print()


def prompt_provider_option() -> ProviderSetupOption:
    """Retornar a opcao de provedor usada pelo assistente."""
    return DEFAULT_SETUP_OPTION


def prompt_provider_api_key(option: ProviderSetupOption) -> str:
    """Pedir interativamente a chave de API do provedor selecionado."""
    print(f"Crie uma chave {option.display_name} em: {option.key_url}")
    while True:
        key = input(f"{BOLD}Chave de API {option.display_name}:{RESET} ").strip()
        if not key:
            print("  A chave nao pode ficar vazia. Tente novamente.")
            continue
        if key.lower() in INVALID_API_KEY_COMMAND_VALUES:
            print(
                "  Isso e um comando do Vertex, nao uma chave DeepSeek. Tente novamente."
            )
            continue
        return key


def prompt_deepseek_api_key() -> str:
    """Pedir interativamente uma chave de API DeepSeek."""
    deepseek = next(
        option for option in PROVIDER_SETUP_OPTIONS if option.provider_id == "deepseek"
    )
    return prompt_provider_api_key(deepseek)


def _write_env_updates(env_path: Path, updates: dict[str, str]) -> None:
    """Gravar ou atualizar um pequeno conjunto de variaveis dotenv."""
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
    """Gravar ou atualizar a credencial e o roteamento de modelo no env."""
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
    """Gravar ou atualizar DEEPSEEK_API_KEY no env."""
    deepseek = next(
        option for option in PROVIDER_SETUP_OPTIONS if option.provider_id == "deepseek"
    )
    _write_env_updates(env_path, {deepseek.credential_env: api_key})


def run_setup_wizard(env_path: Path) -> str:
    """Executar o assistente interativo. Retorna a chave de API."""
    _banner()
    option = prompt_provider_option()
    api_key = prompt_provider_api_key(option)
    save_provider_config_to_env(env_path, option, api_key)
    print(f"\n{GREEN}✓ Chave salva em {env_path}{RESET}")
    print(f"  Provedor: {option.display_name}")
    print(f"  Modelo: {option.default_model}")
    print(f"  Rode {GREEN}vertex /logout{RESET} para trocar a chave depois.")
    print()
    return api_key
