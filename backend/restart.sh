#!/bin/bash
# Restart the Meridian server + Cloudflare tunnel
lsof -ti:5001 | xargs kill -9 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1
cd /Applications/Programs/Meridian/backend
nohup /Applications/Programs/Meridian/backend/venv/bin/python app.py > server.log 2>&1 &
echo "Server PID: $!"
nohup /Applications/Programs/Meridian/bin/cloudflared tunnel run > cloudflared.log 2>&1 &
echo "Cloudflared PID: $!"
