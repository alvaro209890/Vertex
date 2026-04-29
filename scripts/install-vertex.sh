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
    echo -e "${BOLD}[1/5] Installing Node.js via nvm...${RESET}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm alias default 20
    echo "Node.js $(node --version) installed"
else
    echo -e "${BOLD}[1/5] Node.js already installed: $(node --version)${RESET}"
fi

# ─── Step 2: Install OpenClaude CLI ──────────────────────────────
echo -e "${BOLD}[2/5] Installing OpenClaude CLI...${RESET}"
npm install -g @gitlawb/openclaude
echo "OpenClaude installed"

# ─── Step 3: Apply Vertex theme to OpenClaude ───────────────────
echo -e "${BOLD}[3/5] Applying Vertex theme...${RESET}"

CLI_MJS=""
if command -v openclaude &>/dev/null; then
    CLI_MJS="$(dirname "$(dirname "$(realpath "$(which openclaude)")")")/dist/cli.mjs"
elif [ -d "/usr/local/lib/node_modules/@gitlawb/openclaude" ]; then
    CLI_MJS="/usr/local/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"
elif [ -d "/usr/lib/node_modules/@gitlawb/openclaude" ]; then
    CLI_MJS="/usr/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"
fi

if [ -n "$CLI_MJS" ] && [ -f "$CLI_MJS" ]; then
    cp "$CLI_MJS" "${CLI_MJS}.bak"
    echo "Backup saved: ${CLI_MJS}.bak"

    # Colors
    sed -i \
        -e 's/SUNSET_GRAD = \[\[255, 180, 100\], \[240, 140, 80\], \[217, 119, 87\], \[193, 95, 60\], \[160, 75, 55\], \[130, 60, 50\]\]/SUNSET_GRAD = [[0, 255, 120], [0, 220, 100], [0, 190, 90], [0, 160, 75], [0, 130, 60], [10, 90, 45]]/' \
        -e 's/ACCENT = \[240, 148, 100\]/ACCENT = [0, 255, 136]/' \
        -e 's/CREAM = \[220, 195, 170\]/CREAM = [180, 240, 200]/' \
        -e 's/DIMCOL = \[120, 100, 82\]/DIMCOL = [80, 140, 100]/' \
        -e 's/BORDER = \[100, 80, 65\]/BORDER = [40, 100, 60]/' \
        "$CLI_MJS"

    # Logo
    sed -i \
        -e 's/`  ████████╗ ████████╗ ████████╗ ██╗  ██╗`/`  ██╗   ██╗███████╗██████╗ ████████╗███████╗██╗  ██╗`/' \
        -e 's/`  ██╔═══██║ ██╔═══██║ ██╔═════╝ ███╗ ██║`/`  ██║   ██║██╔════╝██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝`/' \
        -e 's/`  ██║   ██║ ████████║ ██████╗   ████╗██║`/`  ██║   ██║█████╗  ██████╔╝   ██║   █████╗   ╚███╔╝ `/' \
        -e 's/`  ██║   ██║ ██╔═════╝ ██╔═══╝   ██╔████║`/`  ╚██╗ ██╔╝██╔══╝  ██╔══██╗   ██║   ██╔══╝   ██╔██╗ `/' \
        -e 's/`  ████████║ ██║       ████████╗ ██║ ╚███║`/`   ╚████╔╝ ███████╗██║  ██║   ██║   ███████╗██╔╝ ██╗`/' \
        -e 's/`  ╚═══════╝ ╚═╝       ╚═══════╝ ╚═╝  ╚══╝`/`    ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝`/' \
        "$CLI_MJS"

    # Name & version
    sed -i \
        -e 's/openclaude v${"0.3.0"}/vertex v${"1.0.0"}/' \
        -e 's/").version("0.3.0 (Open Claude)", "/").version("1.0.0 (Vertex)", "/' \
        -e 's/console.log(`${"0.3.0"} (Open Claude)`)/console.log(`${"1.0.0"} (Vertex)`)/' \
        -e 's/program2.name("claude").description(`Claude Code/program2.name("vertex").description(`Vertex/' \
        "$CLI_MJS"

    # Remove Claude logo
    sed -i 's/const allLogo = \[\.\.\.LOGO_OPEN, "", \.\.\.LOGO_CLAUDE\];/const allLogo = [...LOGO_OPEN];/' "$CLI_MJS"

    # Thinking colors
    sed -i \
        -e 's/THINKING_INACTIVE = {r: 153, g: 153, b: 153}/THINKING_INACTIVE = {r: 0, g: 200, b: 100}/' \
        -e 's/THINKING_INACTIVE_SHIMMER = {r: 185, g: 185, b: 185}/THINKING_INACTIVE_SHIMMER = {r: 0, g: 255, b: 136}/' \
        "$CLI_MJS"

    # Branding
    sed -i 's/OpenClaude/Vertex/g' "$CLI_MJS"
    sed -i 's/"Open Claude"/"Vertex"/g' "$CLI_MJS"

    # Symlink
    NODE_BIN="$(dirname "$(realpath "$(which openclaude)")")"
    if [ ! -f "$NODE_BIN/vertex" ]; then
        ln -sf "$NODE_BIN/openclaude" "$NODE_BIN/vertex"
    fi
    echo "Theme applied"
else
    echo "Warning: OpenClaude binary not found, skipping theme."
fi

# ─── Step 4: Install pipx + Vertex proxy ─────────────────────────
echo -e "${BOLD}[4/5] Installing Vertex proxy...${RESET}"
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
pipx install vertex-deepseek --force 2>&1 | tail -1 || pipx install vertex-deepseek 2>&1 | tail -1

# ─── Step 5: Configure OpenClaude settings ───────────────────────
echo -e "${BOLD}[5/5] Configuring OpenClaude settings...${RESET}"
SETTINGS_DIR="$HOME/.openclaude"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"
mkdir -p "$SETTINGS_DIR"

if [ ! -f "$SETTINGS_FILE" ]; then
    cat > "$SETTINGS_FILE" << 'JSONEOF'
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8082",
    "ANTHROPIC_AUTH_TOKEN": "freecc",
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
    echo "Settings created"
fi

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
