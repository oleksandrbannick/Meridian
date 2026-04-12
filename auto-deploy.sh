#!/bin/bash
cd /root/meridian

DEPLOY_MARKER="/root/meridian/.last_deployed_commit"

# What's on disk right now, before pulling
BEFORE_PULL=$(git rev-parse HEAD 2>/dev/null)

# Fetch + pull in one step
git fetch origin main -q 2>/dev/null
REMOTE=$(git rev-parse origin/main 2>/dev/null)

# Nothing new on remote
if [ "$REMOTE" = "$BEFORE_PULL" ]; then
    # Sync marker in case someone else already pulled+restarted
    echo "$BEFORE_PULL" > "$DEPLOY_MARKER"
    exit 0
fi

# Pull the new code
git pull origin main -q 2>/dev/null
AFTER_PULL=$(git rev-parse HEAD 2>/dev/null)

# If pull didn't change anything (already up to date, e.g. agent already pulled)
# just update marker and skip restart
if [ "$BEFORE_PULL" = "$AFTER_PULL" ]; then
    echo "$AFTER_PULL" > "$DEPLOY_MARKER"
    exit 0
fi

# Check if server is mid-hedge before restarting
ACTIVE_HEDGES=$(curl -s --max-time 3 http://localhost:5050/api/bot/list 2>/dev/null | python3 -c "
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

echo "[$(date)] Deploying $AFTER_PULL (was $BEFORE_PULL)..."
echo "$AFTER_PULL" > "$DEPLOY_MARKER"
systemctl restart meridian
echo "[$(date)] Server restarted via systemd"
