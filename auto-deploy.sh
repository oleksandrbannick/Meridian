#!/bin/bash
cd /root/meridian
LOCAL=$(git rev-parse HEAD)
git fetch origin meridian -q 2>/dev/null
REMOTE=$(git rev-parse origin/meridian)
if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[$(date)] New commit detected: $REMOTE — updating code files..."
    # Only checkout code files (never touch runtime data files)
    git checkout origin/meridian -- backend/app.py frontend/ backend/requirements.txt backend/restart.sh 2>/dev/null
    # Update HEAD to match remote so we don't re-trigger
    git reset --soft origin/meridian 2>/dev/null
    # Restart server
    kill $(pgrep -f 'python3 app.py') 2>/dev/null
    sleep 2
    cd /root/meridian/backend
    nohup venv/bin/python3 app.py > server.log 2>&1 &
    disown
    echo "[$(date)] Server restarted with PID $!"
fi
