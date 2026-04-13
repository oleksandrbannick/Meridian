#!/bin/bash
cd /root/meridian

DEPLOY_MARKER="/root/meridian/.last_deployed_commit"
LAST_DEPLOYED=$(cat "$DEPLOY_MARKER" 2>/dev/null || echo "none")

# What's actually on disk right now
CURRENT=$(git rev-parse HEAD 2>/dev/null)

# Fetch remote to see if there's anything new
git fetch origin main -q 2>/dev/null
REMOTE=$(git rev-parse origin/main 2>/dev/null)

# Pull if remote is ahead of local
if [ "$CURRENT" != "$REMOTE" ]; then
    git pull origin main -q 2>/dev/null
    CURRENT=$(git rev-parse HEAD 2>/dev/null)
fi

# If current HEAD matches what's deployed, nothing to do
if [ "$CURRENT" = "$LAST_DEPLOYED" ]; then
    exit 0
fi

# Check if ANY bots are running — never auto-restart with active bots
# User does manual restarts when bots are running (can check hedges first)
ACTIVE_BOTS=$(curl -s --max-time 3 http://localhost:5001/api/bot/list 2>/dev/null | python3 -c "
import json,sys
try:
    data = json.load(sys.stdin)
    bots = data.get('bots', data)
    if isinstance(bots, dict): bots = list(bots.values())
    active = [b for b in bots if isinstance(b, dict) and b.get('status') not in ('completed','cancelled')]
    print(len(active))
except: print('error')
" 2>/dev/null || echo "error")

if [ "$ACTIVE_BOTS" != "0" ]; then
    echo "[$(date)] Skipping deploy — $ACTIVE_BOTS active bots (manual restart required)"
    exit 0
fi

echo "[$(date)] Deploying $CURRENT (was $LAST_DEPLOYED)..."
echo "$CURRENT" > "$DEPLOY_MARKER"
systemctl restart meridian
echo "[$(date)] Server restarted via systemd"
