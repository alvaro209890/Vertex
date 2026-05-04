#!/bin/bash
# Start script for Vertex API backend + DeepSeek Proxy + Cloudflare Tunnel
# Usage: ./vertex-start.sh
# Also used by systemd: systemctl --user start vertex-backend.service

set -e

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
BACKEND_DIR="/media/server/HD Backup/Servidores_NAO_MEXA/vertex/web/backend"
REPO_DIR="/media/server/HD Backup/Servidores_NAO_MEXA/vertex"

# Ensure nvm node is in PATH (needed when run from systemd)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

export PATH="/home/server/.local/bin:$PATH"

# Start backend
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!
echo "[Backend] PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2

# Start DeepSeek proxy (FastAPI)
echo "[Proxy] Iniciando proxy DeepSeek..."
cd "$REPO_DIR"
VERTEX_REMOTE=1 uv run python web/backend/proxy_server.py &
PROXY_PID=$!
echo "[Proxy] PID: $PROXY_PID"

sleep 3

# Start tunnel
cloudflared tunnel run vertex-api &
TUNNEL_PID=$!
echo "[Tunnel] PID: $TUNNEL_PID"

# Trap to kill all on exit
trap "kill $BACKEND_PID $PROXY_PID $TUNNEL_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
