# Meridian Trading Platform

## Overview
Meridian is a sports arbitrage trading terminal for Kalshi binary options. It runs as a Flask backend (Python) + vanilla JS frontend, served from a Chicago VPS (104.223.8.231) via systemd.

## Architecture
- **Backend**: `/root/meridian/backend/app.py` (~17K lines) — ALL bot logic, API endpoints, WS management
- **Frontend**: `/root/meridian/frontend/app.js` (~11K lines) + `index.html`
- **API Client**: `/root/meridian/backend/kalshi_api.py` — Kalshi REST/WS wrapper
- **State**: `data.json` (atomic save), `trades.jsonl` (append-only backup), `activity_log.jsonl`

## Bot Types (user-facing → internal)
| Name | `type` | `bot_category` | Description |
|------|--------|----------------|-------------|
| Apex | arb | ladder_arb | Multi-width arb ladder, consolidates hedge on first fill |
| Phantom | — | anchor_dog | Posts dog leg only, instant hedge on fill |
| Phantom Ladder | — | anchor_ladder | Multi-rung dog with instant hedges |
| Scout | watch | bet | Stop-loss / take-profit on a position |
| Meridian | middle | middle | Dual-leg spread arb (opposing NO+NO) |
| Regular Arb | arb | arb/both_posted | Simultaneous YES+NO limit orders |

## Key Systems
- **WebSocket**: `KalshiWSManager` — real-time fills, prices, subscriptions
- **Monitor Loop**: `_run_monitor()` — polls all active bots, handles fills/timeouts/reposts
- **WS Fill Handler**: `_ws_realtime_fill_handler()` — instant hedge on WS fill events
- **Precalc System**: `_precalc_phantom_hedge()` / `_precalc_phantom_ladder_hedges()` — zero-compute on hot path

## Critical Rules
- **No fee calculations in bot logic** — only in P&L tracking. 98¢ combined = breakeven
- **Walk-to-bid ceiling is intentional** — NEVER cap or limit it
- **Snap threshold = 98¢** (2¢ min profit), same as walk ceiling
- **Rubberband = dog-side snap-down on whale dumps**, not fav snap-up
- **Never modify phantom/anchor bot code without explicit permission**
- **Never revert code without user explicitly telling you to**

## Restart Procedure
```bash
git pull origin main && systemctl restart meridian && sleep 4 && systemctl status meridian
```
**NEVER use nohup.** Always `systemctl restart meridian`. Always push to GitHub BEFORE restarting.
Verify single process: `pgrep -af "python3.*app.py"`

## After Every Change
Always: bump cache (if applicable), restart server, push to GitHub.

## Kalshi API Notes
- Uses `_fp` suffix string fields (e.g., `fill_count_fp`), NOT integer fields
- Always use `_parse_fill_count()` for order fill counts
- Rate limiter: `api_rate_limiter.wait()` before every API call

## Dead Code Warning
Meridian has dead code from old bot systems. Always verify code is reachable before treating as active.

## Key API Endpoints
- `GET /api/bot/list` — all active bots with enriched data
- `POST /api/bot/monitor` — trigger monitor cycle
- `GET /api/bot/history` — trade history (?limit, ?date, ?category)
- `GET /api/pnl` — P&L breakdown by category
- `GET /api/pnl/calendar` — daily P&L calendar data
- `POST /api/bot/cancel/<bot_id>` — cancel bot (with safety sell-back)
- `GET /api/system/status` — full system health check
- `GET /api/bots/diagnose` — health-check all bots and positions
- `GET /api/latency` — API latency stats
- `GET /api/risk/exposure` — capital at risk
- `GET /api/bot/stats-by-type` — performance stats by bot type
