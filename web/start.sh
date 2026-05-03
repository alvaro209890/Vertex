#!/bin/bash
# Start script for Vertex API backend + Cloudflare Tunnel
# Usage: ./start.sh
# Also used by systemd: systemctl --user start vertex-backend.service

set -e

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Ensure nvm node is in PATH (needed when run from systemd)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

# Start backend
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!
echo "[Backend] PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2

# Start tunnel
cloudflared tunnel run vertex-api &
TUNNEL_PID=$!
echo "[Tunnel] PID: $TUNNEL_PID"

# Trap to kill both on exit
trap "kill $BACKEND_PID $TUNNEL_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
