#!/bin/bash
# Restart the Meridian server + Cloudflare tunnel
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

lsof -ti:5001 | xargs kill -9 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1
cd "$SCRIPT_DIR"
# Load environment variables
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a; source "$SCRIPT_DIR/.env"; set +a
fi
# Use venv python if available, else system python3
if [ -x "$SCRIPT_DIR/venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/venv/bin/python"
else
    PYTHON="python3"
fi
nohup "$PYTHON" -u app.py > server.log 2>&1 &
echo "Server PID: $!"
# Use system cloudflared if available, else project-local binary
if command -v cloudflared &>/dev/null; then
    CF="cloudflared"
elif [ -x "$PROJECT_DIR/bin/cloudflared" ]; then
    CF="$PROJECT_DIR/bin/cloudflared"
else
    echo "ERROR: cloudflared not found"
    exit 1
fi
nohup "$CF" tunnel run meridian > cloudflared.log 2>&1 &
echo "Cloudflared PID: $!"
