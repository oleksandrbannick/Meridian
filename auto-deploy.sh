#!/bin/bash
cd /root/meridian

# Track last deployed commit in a file (not git HEAD — that matches immediately on local push)
DEPLOY_MARKER="/root/meridian/.last_deployed_commit"
CURRENT=$(git rev-parse HEAD)
LAST_DEPLOYED=$(cat "$DEPLOY_MARKER" 2>/dev/null || echo "none")

# Also fetch remote in case someone pushed from elsewhere
git fetch origin main -q 2>/dev/null
REMOTE=$(git rev-parse origin/main)

# Pull if remote is ahead
if [ "$CURRENT" != "$REMOTE" ]; then
    git checkout origin/main -- backend/app.py frontend/ backend/requirements.txt backend/restart.sh 2>/dev/null
    git reset --soft origin/main 2>/dev/null
    CURRENT=$(git rev-parse HEAD)
fi

# Restart if current commit differs from what's actually running
if [ "$CURRENT" != "$LAST_DEPLOYED" ]; then
    echo "[$(date)] Deploying $CURRENT (was $LAST_DEPLOYED)..."
    systemctl restart meridian
    echo "$CURRENT" > "$DEPLOY_MARKER"
    echo "[$(date)] Server restarted via systemd"
fi
