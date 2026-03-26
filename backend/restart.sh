#!/bin/bash
# Restart the Meridian server (LOCAL dev only — Chicago uses systemd)
cd "$(dirname "$0")"

# Kill existing server by port
lsof -ti:5001 | while read pid; do
    cmd=$(ps -p "$pid" -o command= 2>/dev/null)
    if echo "$cmd" | grep -qi python; then
        kill "$pid" 2>/dev/null
    fi
done
sleep 2

# Start Flask server
nohup ./venv/bin/python app.py > server.log 2>&1 &
echo "Meridian server started (PID $!)"
echo "Logs: backend/server.log"

# DO NOT start cloudflared here — Chicago server runs the tunnel via systemd.
# Starting it locally hijacks the tunnel and routes all traffic through the Mac.
