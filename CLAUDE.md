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
| Apex MM | apex_mm | ladder_arb | Market maker: continuous quoting, net inventory, spread collection |
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

## Apex Market Maker — Continuous Spread Collector
Apex MM continuously quotes both sides with a 1¢-spaced ladder, collecting spread as fills trickle in:
- Config: `start_gap` (min edge from midpoint), `levels` (per side), `spacing`, `qty_per_level`, `inventory_limit`, `loss_limit_cents`, `smart_mode`
- Midpoint from LocalOrderbook: `(yes_bid + (100 - no_bid)) / 2`
- YES bids: midpoint - start_gap - i*spacing; NO bids: (100-midpoint) - start_gap - i*spacing
- Net inventory tracking with weighted average cost basis (no per-rung isolation)
- Round trip P&L: `100 - avg_opposite_cost - fill_price` per close
- Bot statuses: `market_making_active` → `mm_depth_pulled` → `mm_exiting` → `completed`
- OBI/depth gating reused from existing system (`_apex_should_pull`, `_apex_depth_recovered`)
- Drift reprice: if midpoint moves 2+ cents, cancel unfilled and repost at new prices
- Inventory limit: pause one side when net exceeds limit, resume with hysteresis
- Key functions: `_apex_mm_midpoint()`, `_apex_mm_levels()`, `_apex_mm_post_ladder()`, `_apex_mm_repost_filled()`, `_apex_mm_record_round_trip()`, `_handle_apex()`

## Critical Rules
- **No fee calculations in bot logic** — only in P&L tracking. 98¢ combined = breakeven
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
