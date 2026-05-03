#!/bin/bash
# Start script for Vertex API backend + Cloudflare Tunnel
# Usage: ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "=== Iniciando Vertex API ==="

# Start backend
echo "[Backend] Iniciando servidor na porta 4000..."
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!
echo "[Backend] PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2

# Start tunnel
echo "[Tunnel] Iniciando Cloudflare Tunnel..."
cloudflared tunnel run vertex-api &
TUNNEL_PID=$!
echo "[Tunnel] PID: $TUNNEL_PID"

echo ""
echo "=== Vertex API rodando ==="
echo "  Backend: http://127.0.0.1:4000"
echo "  Tunnel:  https://vertex-api.cursar.space"
echo ""
echo "Pressione Ctrl+C para parar tudo."

# Trap to kill both on exit
trap "echo 'Parando...'; kill $BACKEND_PID $TUNNEL_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
