#!/bin/bash
# Restart the Meridian server via systemd
# Cloudflared runs as its own systemd service — no need to manage it here
systemctl restart meridian
echo "Meridian restarted via systemd"
echo "Check status: systemctl status meridian"
