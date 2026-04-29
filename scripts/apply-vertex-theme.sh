#!/usr/bin/env bash
# apply-vertex-theme.sh — Patch OpenClaude installation with Vertex branding and theme
# Usage: curl -fsSL https://raw.githubusercontent.com/alvaro209890/Vertex/main/scripts/apply-vertex-theme.sh | bash
# Or: bash scripts/apply-vertex-theme.sh

set -euo pipefail

CLI_MJS=""

# Find the installed openclaude package
if [ -f "/home/server/.nvm/versions/node/v20.20.0/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs" ]; then
    CLI_MJS="/home/server/.nvm/versions/node/v20.20.0/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"
elif command -v openclaude &>/dev/null; then
    CLI_MJS="$(dirname "$(dirname "$(realpath "$(which openclaude)")")")/dist/cli.mjs"
elif [ -d "/usr/local/lib/node_modules/@gitlawb/openclaude" ]; then
    CLI_MJS="/usr/local/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"
elif [ -d "/usr/lib/node_modules/@gitlawb/openclaude" ]; then
    CLI_MJS="/usr/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"
else
    echo "Error: OpenClaude package not found. Install it first:"
    echo "  npm install -g @gitlawb/openclaude"
    exit 1
fi

if [ ! -f "$CLI_MJS" ]; then
    echo "Error: OpenClaude dist/cli.mjs not found at $CLI_MJS"
    exit 1
fi

echo "Patching: $CLI_MJS"

# Backup
cp "$CLI_MJS" "${CLI_MJS}.bak"
echo "Backup saved: ${CLI_MJS}.bak"

# Replace colors (sunset orange -> vertex green)
sed -i \
    -e 's/SUNSET_GRAD = \[\[255, 180, 100\], \[240, 140, 80\], \[217, 119, 87\], \[193, 95, 60\], \[160, 75, 55\], \[130, 60, 50\]\]/SUNSET_GRAD = [[0, 255, 120], [0, 220, 100], [0, 190, 90], [0, 160, 75], [0, 130, 60], [10, 90, 45]]/' \
    -e 's/ACCENT = \[240, 148, 100\]/ACCENT = [0, 255, 136]/' \
    -e 's/CREAM = \[220, 195, 170\]/CREAM = [180, 240, 200]/' \
    -e 's/DIMCOL = \[120, 100, 82\]/DIMCOL = [80, 140, 100]/' \
    -e 's/BORDER = \[100, 80, 65\]/BORDER = [40, 100, 60]/' \
    "$CLI_MJS"

# Replace logo (OPEN -> VERTEX)
sed -i \
    -e 's/`  ████████╗ ████████╗ ████████╗ ██╗  ██╗`/`  ██╗   ██╗███████╗██████╗ ████████╗███████╗██╗  ██╗`/' \
    -e 's/`  ██╔═══██║ ██╔═══██║ ██╔═════╝ ███╗ ██║`/`  ██║   ██║██╔════╝██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝`/' \
    -e 's/`  ██║   ██║ ████████║ ██████╗   ████╗██║`/`  ██║   ██║█████╗  ██████╔╝   ██║   █████╗   ╚███╔╝ `/' \
    -e 's/`  ██║   ██║ ██╔═════╝ ██╔═══╝   ██╔████║`/`  ╚██╗ ██╔╝██╔══╝  ██╔══██╗   ██║   ██╔══╝   ██╔██╗ `/' \
    -e 's/`  ████████║ ██║       ████████╗ ██║ ╚███║`/`   ╚████╔╝ ███████╗██║  ██║   ██║   ███████╗██╔╝ ██╗`/' \
    -e 's/`  ╚═══════╝ ╚═╝       ╚═══════╝ ╚═╝  ╚══╝`/`    ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝`/' \
    "$CLI_MJS"

# Replace name strings
sed -i \
    -e 's/openclaude v${"0.3.0"}/vertex v${"1.0.0"}/' \
    -e 's/").version("0.3.0 (Open Claude)", "/").version("1.0.0 (Vertex)", "/' \
    -e 's/console.log(`${"0.3.0"} (Open Claude)`)/console.log(`${"1.0.0"} (Vertex)`)/' \
    -e 's/program2.name("claude").description(`Claude Code/program2.name("vertex").description(`Vertex/' \
    "$CLI_MJS"

# Remove Claude logo from banner (keep only Vertex logo)
sed -i 's/const allLogo = \[\.\.\.LOGO_OPEN, "", \.\.\.LOGO_CLAUDE\];/const allLogo = [...LOGO_OPEN];/' "$CLI_MJS"

# Replace thinking colors (gray -> green)
sed -i \
    -e 's/THINKING_INACTIVE = {r: 153, g: 153, b: 153}/THINKING_INACTIVE = {r: 0, g: 200, b: 100}/' \
    -e 's/THINKING_INACTIVE_SHIMMER = {r: 185, g: 185, b: 185}/THINKING_INACTIVE_SHIMMER = {r: 0, g: 255, b: 136}/' \
    "$CLI_MJS"

# Replace "OpenClaude" with "Vertex" (careful: semantic)
sed -i 's/OpenClaude/Vertex/g' "$CLI_MJS"

# Replace "Open Claude" with "Vertex"
sed -i 's/"Open Claude"/"Vertex"/g' "$CLI_MJS"

# Create vertex symlink
NODE_BIN="$(dirname "$(realpath "$(which openclaude)")")"
if [ ! -f "$NODE_BIN/vertex" ]; then
    ln -sf "$NODE_BIN/openclaude" "$NODE_BIN/vertex"
    echo "Symlink created: $NODE_BIN/vertex -> openclaude"
fi

# Update OpenClaude settings
SETTINGS_DIR="$HOME/.openclaude"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    # Backup
    cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak"

    # Update model references
    sed -i \
        -e 's/deepseek\/deepseek-chat/deepseek\/deepseek-v4-pro/g' \
        -e 's/"DeepSeek Chat"/"DeepSeek V4 Pro"/g' \
        "$SETTINGS_FILE"

    # Remove grouter entries from OPENCLAUDE_EXTRA_MODEL_OPTIONS
    python3 -c "
import json, re
with open('$SETTINGS_FILE') as f:
    data = json.load(f)
env = data.get('env', {})
models = env.get('OPENCLAUDE_EXTRA_MODEL_OPTIONS', '[]')
options = json.loads(models)
options = [o for o in options if not o.get('value', '').startswith('grouter/')]
if not any(o['value'] == 'deepseek/deepseek-v4-flash' for o in options):
    options.insert(1, {'value': 'deepseek/deepseek-v4-flash', 'label': 'DeepSeek V4 Flash', 'description': 'Fast responses (non-thinking mode)'})
env['OPENCLAUDE_EXTRA_MODEL_OPTIONS'] = json.dumps(options)
data['env'] = env
data['model'] = 'deepseek/deepseek-v4-pro'
with open('$SETTINGS_FILE', 'w') as f:
    json.dump(data, f, indent=2)
" 2>/dev/null || true

    echo "Settings updated: $SETTINGS_FILE"
fi

echo ""
echo "✓ Vertex theme applied successfully!"
echo "  Run: vertex"
echo ""
