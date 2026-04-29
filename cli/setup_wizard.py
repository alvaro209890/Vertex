"""First-run setup wizard — prompts for DeepSeek API key interactively."""

from __future__ import annotations

from pathlib import Path

GREEN = "\033[92m"
RESET = "\033[0m"
BOLD = "\033[1m"


def _banner() -> None:
    """Print the branded Vertex setup banner."""
    print()
    print(f"{GREEN}{'=' * 54}{RESET}")
    print(f"{GREEN}  Welcome to Vertex — DeepSeek Proxy for Claude Code{RESET}")
    print(f"{GREEN}{'=' * 54}{RESET}")
    print()
    print("You need a DeepSeek API key to use Vertex.")
    print("Get one at: https://platform.deepseek.com/api_keys")
    print()


def prompt_deepseek_api_key() -> str:
    """Prompt user interactively for a DeepSeek API key."""
    while True:
        key = input(f"{BOLD}DeepSeek API key:{RESET} ").strip()
        if not key:
            print("  Key cannot be empty. Try again.")
            continue
        return key


def save_key_to_env(env_path: Path, api_key: str) -> None:
    """Write or update DEEPSEEK_API_KEY in the env file."""
    env_path.parent.mkdir(parents=True, exist_ok=True)

    key_line = f'DEEPSEEK_API_KEY="{api_key}"'

    if env_path.exists():
        content = env_path.read_text(encoding="utf-8")
        if "DEEPSEEK_API_KEY" in content:
            lines = content.splitlines()
            new_lines = []
            replaced = False
            for ln in lines:
                if ln.strip().startswith("DEEPSEEK_API_KEY"):
                    new_lines.append(key_line)
                    replaced = True
                else:
                    new_lines.append(ln)
            if not replaced:
                new_lines.append(key_line)
            env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        else:
            env_path.write_text(
                content.rstrip() + f"\n{key_line}\n",
                encoding="utf-8",
            )
    else:
        env_path.write_text(
            f"# Vertex — DeepSeek Proxy\n{key_line}\n",
            encoding="utf-8",
        )


def run_setup_wizard(env_path: Path) -> str:
    """Run the interactive setup wizard. Returns the API key."""
    _banner()
    api_key = prompt_deepseek_api_key()
    save_key_to_env(env_path, api_key)
    print(f"\n{GREEN}✓ Key saved to {env_path}{RESET}")
    print(f"  Run {GREEN}vertex --logout{RESET} to change it later.")
    print()
    return api_key
