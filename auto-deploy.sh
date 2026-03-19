#!/bin/bash
cd /root/meridian
LOCAL=$(git rev-parse HEAD)
git fetch origin main -q 2>/dev/null
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[$(date)] New commit detected: $REMOTE — updating code files..."
    # Only checkout code files (never touch runtime data files)
    git checkout origin/main -- backend/app.py frontend/ backend/requirements.txt backend/restart.sh 2>/dev/null
    # Update HEAD to match remote so we don't re-trigger
    git reset --soft origin/main 2>/dev/null
    # Restart server via systemd (no duplicate processes)
    systemctl restart meridian
    echo "[$(date)] Server restarted via systemd"
fi
