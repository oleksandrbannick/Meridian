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

# Check if server is mid-hedge before restarting
ACTIVE_HEDGES=$(curl -s --max-time 3 http://localhost:5001/api/bot/list 2>/dev/null | python3 -c "
import json,sys
try:
    bots = json.load(sys.stdin)
    if isinstance(bots, dict): bots = list(bots.values())
    hedging = [b for b in bots if b.get('status') in ('dog_filled','fav_hedge_posted')]
    print(len(hedging))
except: print(0)
" 2>/dev/null || echo "0")

if [ "$ACTIVE_HEDGES" != "0" ] && [ "$ACTIVE_HEDGES" != "" ]; then
    echo "[$(date)] Skipping deploy — $ACTIVE_HEDGES active hedges"
    exit 0
fi

echo "[$(date)] Deploying $CURRENT (was $LAST_DEPLOYED)..."
echo "$CURRENT" > "$DEPLOY_MARKER"
systemctl restart meridian
echo "[$(date)] Server restarted via systemd"
