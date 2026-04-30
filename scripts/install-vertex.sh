#!/usr/bin/env bash
# install-vertex.sh — One-command install: Vertex CLI + DeepSeek proxy
# Usage: curl -fsSL https://raw.githubusercontent.com/alvaro209890/Vertex/main/scripts/install-vertex.sh | bash
set -euo pipefail

GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${GREEN}======================================================${RESET}"
echo -e "${GREEN}  Vertex — All-in-One CLI + DeepSeek Proxy Installer${RESET}"
echo -e "${GREEN}======================================================${RESET}"
echo ""

# ─── Detect OS ──────────────────────────────────────────────────
OS="$(uname -s)"

# ─── Step 1: Install Node.js via nvm ─────────────────────────────
if ! command -v node &>/dev/null; then
    echo -e "${BOLD}[1/4] Installing Node.js via nvm...${RESET}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm alias default 20
    echo "Node.js $(node --version) installed"
else
    echo -e "${BOLD}[1/4] Node.js already installed: $(node --version)${RESET}"
fi

# ─── Step 2: Install pipx ────────────────────────────────────────
echo -e "${BOLD}[2/4] Installing pipx...${RESET}"
if ! command -v pipx &>/dev/null; then
    if [ "$OS" = "Linux" ]; then
        if command -v apt &>/dev/null; then
            sudo apt update && sudo apt install -y pipx
        elif command -v brew &>/dev/null; then
            brew install pipx
        else
            pip install pipx
        fi
    elif [ "$OS" = "Darwin" ]; then
        brew install pipx
    else
        pip install pipx
    fi
    pipx ensurepath
    # shellcheck source=/dev/null
    source "$HOME/.bashrc" 2>/dev/null || true
fi

# ─── Step 3: Install standalone Vertex CLI + proxy ───────────────
echo -e "${BOLD}[3/4] Installing standalone Vertex CLI + proxy from GitHub main...${RESET}"
pipx uninstall vertex-deepseek >/dev/null 2>&1 || true
pipx install "git+https://github.com/alvaro209890/Vertex.git" --force

# ─── Step 4: Configure Vertex CLI settings ───────────────────────
echo -e "${BOLD}[4/4] Configuring Vertex CLI settings...${RESET}"
SETTINGS_DIR="$HOME/.vertex"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"
mkdir -p "$SETTINGS_DIR"

cat > "$SETTINGS_FILE" << 'JSONEOF'
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8083",
    "ANTHROPIC_AUTH_TOKEN": "freecc",
    "DISABLE_LOGIN_COMMAND": "1",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek/deepseek-v4-pro",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": "DeepSeek V4 Pro",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek/deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": "DeepSeek V4 Flash",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek/deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME": "DeepSeek V4 Flash"
  },
  "skipDangerousModePermissionPrompt": true,
  "model": "deepseek/deepseek-v4-pro"
}
JSONEOF
echo "Settings written for DeepSeek"

echo ""
echo -e "${GREEN}======================================================${RESET}"
echo -e "${GREEN}  ✅ Vertex instalado com sucesso!${RESET}"
echo -e "${GREEN}======================================================${RESET}"
echo ""
echo -e "  ${BOLD}Comandos:${RESET}"
echo -e "    ${GREEN}vertex${RESET}          — Abre a CLI do Vertex (já conectado ao proxy)"
echo -e "    ${GREEN}vertex --logout${RESET} — Trocar a chave DeepSeek"
echo ""
echo -e "  ${BOLD}Primeiro uso:${RESET}"
echo -e "    Feche e abra o terminal, ou rode: source ~/.bashrc"
echo -e "    Depois: ${GREEN}vertex${RESET}"
echo ""
