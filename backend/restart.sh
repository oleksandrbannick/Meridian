#!/bin/bash
# Restart the Meridian server
lsof -ti:5001 | xargs kill -9 2>/dev/null
sleep 1
cd /Applications/Programs/Meridian/backend
nohup /Applications/Programs/Meridian/backend/venv/bin/python app.py > server.log 2>&1 &
echo "Server PID: $!"
