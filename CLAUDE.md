# Meridian Trading Platform

## Overview
Meridian is a sports arbitrage trading terminal for Kalshi binary options. It runs as a Flask backend (Python) + vanilla JS frontend, served from a Chicago VPS (104.223.8.231) via systemd.

## Architecture
- **Backend**: `/root/meridian/backend/app.py` (~17K lines) — ALL bot logic, API endpoints, WS management
- **Frontend**: `/root/meridian/frontend/app.js` (~11K lines) + `index.html`
- **API Client**: `/root/meridian/backend/kalshi_api.py` — Kalshi REST/WS wrapper
- **State**: `data.json` (atomic save), `trades.jsonl` (append-only backup), `activity_log.jsonl`

## Key Systems
- **WebSocket**: `KalshiWSManager` — real-time fills, prices, subscriptions
- **Monitor Loop**: `_run_monitor()` — polls all active bots, handles fills/timeouts/reposts
- **WS Fill Handler**: `_ws_realtime_fill_handler()` — instant hedge on WS fill events
- **Precalc System**: `_precalc_phantom_hedge()` / `_precalc_phantom_ladder_hedges()` — zero-compute on hot path

## Bot Types (user-facing -> internal)
| Name | `type` | `bot_category` | Description |
|------|--------|----------------|-------------|
| Phantom | — | anchor_dog | Posts dog leg only, instant hedge on fill |
| Phantom Ladder | — | anchor_ladder | Multi-rung dog with instant hedges |
| Apex | — | apex | Both-sides ladder, per-rung independent hedging |
| Apex MM | apex_mm | ladder_arb | Market maker: continuous quoting, spread collection |
| Meridian | middle | middle | Dual-leg spread arb (opposing NO+NO) |
| Scout | watch | bet | Stop-loss / take-profit on a position |

## Bot Selection by Liquidity
- **Phantom** = high liquidity markets (speed play, needs active takers to lift the hedge)
- **Apex** = low liquidity markets (spread capture, wide spreads = bigger arb width)

---

# Phantom Bot — The Speed Demon

## Core Strategy
Posts invisible orders deep in the book (the "dog" side — less likely to win), waits for whale dumps or panic sells to fill them, then INSTANTLY hedges the other side. Speed is everything — every ms between fill and hedge is naked directional exposure.

## Two Variants (identical behavior, different rung count)
- **Single-Dog** (`anchor_dog` -> `_handle_phantom`): ONE underdog order deep below market. Dog fills -> instant hedge via WS hot-path.
- **Multi-Rung** (`anchor_ladder` -> `_handle_phantom_ladder`): 2+ staggered underdog rungs at different prices (2c spacing). ANY rung fills -> instant sweep: cancel unfilled rungs, hedge all filled qty.

## Speed Architecture (The Hot Path)
```
WS fill event -> _hedge_worker_queue (pre-warmed thread) -> ws_manager.get_price() -> create_order_maker(priority=True)
```
1. **WS real-time prices**: reads fav bid from ws_manager (NOT stale bot cache)
2. **Dedicated hedge worker thread**: pre-warmed daemon, no thread spawn overhead
3. **Priority burst tokens**: bypasses rate limiter on hedge post
4. **Post at BID**: always posts at fav bid (not bid+1) — ceiling margin > queue priority
5. Measured fill-to-hedge latency: **sub-5ms**

## Bid-Follow System (Fav Hedge Walk)
**No ceiling cap on snap. Two phases:**
- **Phase 1 (0-20s):** Snap to bid every cycle (maker, $0 fees)
- **Phase 2 (20s+):** Snap to bid+1 every cycle (jump queue, still maker)

Every monitor cycle (~2s):
- Snap fav to current bid — up or down, no cap
- Uses `amend_order` not cancel+repost
- Maker exit > taker sellback: staying at bid gives best chance of fill

## No Ceiling, No Sellback (as of 2026-04-11)
- **Ceiling exit / dual exit / dog sell system REMOVED** (~1400 lines deleted)
- Fav hedge snaps to bid always, **NO ceiling cap** — even if combined > 100c
- Combined < 100c = win, >= 100c = loss. Smart mode tracks this.
- `HARD_CEILING_CENTS = 98` still exists for PRE-LAUNCH validation only (rejects bad setups)
- **Only sell path:** user manually cancels bot (X) while holding positions -> `execute_maker_sell`

## TWO EXITS ONLY — NO sellback, NO timeout
1. **Fav fills** at any combined price -> arb complete (win or loss)
2. **Settlement** -> dog position settles automatically
- Death zone just sets a flag — fav stays posted, keeps snapping to bid
- If someone asks "what if it never fills" -> it settles, or user cancels

## Price Floor System
- Dog price < 2c -> pull order, wait for recovery (NOT kill bot)
- Recovery: when bid recovers above floor, auto-repost via waiting_repeat
- Settlement check every 30s while pulled
- UI shows "PULLED - YES - WAITING" in red

## Depth Floor
- 1c target width -> 3c depth floor
- 2-3c width -> 5c depth floor
- 4c+ width -> max(5, width) depth floor
- ALL depth shaved off dog only (fav_shave = 0 always)

## State Machine
- `dog_anchor_posted` / `ladder_posted`: Dog live, waiting for fill. Repost on gap/timer/retreat triggers.
- `dog_filled` / `ladder_filled_no_fav`: Dog filled, hedge post failed. Retry each cycle.
- `fav_hedge_posted`: Hedge posted, bid-follow active. Snap/ceiling/dual exit logic here.
- `waiting_repeat`: 10s cooldown, then re-anchor with fresh prices. Drift guard checks.

## Repost Triggers (all require 0 fills)
1. Gap trigger: adaptive threshold (3/5/8c based on bid volatility)
2. Timer trigger: 3 minutes stale
3. Retreat trigger: bid crept within anchor_depth - 2 of order

## Safety Guards
- bid <= 1c -> cancel (dead market)
- bid < anchor_depth + 1 -> cancel (can't post meaningful order)
- bid > 50c -> cancel (dog is now favorite, drift guard)

## Rubberband Effect
When a whale dumps and dog price drops (e.g., 30c -> 25c), phantom reposts at the new lower bid. Fav is still at 70c, so the arb widens from 0c to 5c for free. The gap-based repost mechanism IS the rubberband.

---

# Apex Bot — Per-Rung Siloed Arbiter

## Core Strategy
Places limit orders on BOTH sides (YES + NO) at different widths. When one side fills (anchor), the opposite-side order IS the hedge. Tracks each rung independently with time-decay exit protocol.

## Width = Profit Target
Each rung has a "width" — gap between YES price and NO price. Width 5 = 95c combined = 5c guaranteed profit if both fill at target. **Max width: 8c** (wider widths have 75%+ snap rate, structurally unprofitable).

## Two-Step Exit Protocol

### Step 1: `pending_profit` (0-30s at target price)
- Hedge order at TARGET width price
- **Stop-loss override**: if combined > 100 + stop_loss -> IMMEDIATE sellback
- **Greedy snap**: bid 1-2c above -> snap after 5s; 3-4c -> snap after 10s
- **Breathing guard**: within 3-4c of target -> sit indefinitely, reset drift timer
- **Drift detection**: > 3c away -> start game-clock timer
- Timer expiry -> transition to `snapped`

### Step 2: `snapped` (30s+, follow bid)
- Amend hedge to bid or bid+1 — **NO cap, goes to bid regardless** (exiting, not optimizing)
- If market comes back within width -> revert to `pending_profit`
- Dead market: bid=0 for 30s -> force complete as loss
- Amend to follow bid every 10s

### Walk-Up in Gapped Spreads
- When snapped and spread > 4c, walks from bid+1 toward midpoint over 45s
- Max 40% of spread, capped at 98c combined
- Prevents sitting at unfillable bid+1 for 180s

## Stop-Loss / Sellback
`_apex_rung_sellback()` fires when `anchor_price + hedge_bid > 100 + stop_loss_cents`:
1. Cancel hedge order (check for cancel-race fills)
2. Compute unhedged qty
3. `execute_sell()` anchor position at market
4. Record P&L as `apex_sellback`
5. If sell fails -> `_sellback_pending` flag, retry next tick

**Stop-loss thresholds:**
- width <= 5: 6c (combined > 106c)
- width <= 8: 8c (combined > 108c)
- wider: 12c

## Dynamic Snap Timer
- Tennis/Golf: 60s (no game clock)
- Early game: 60s
- Mid game: 25s
- Late game (final period, >2min): 15s
- End game (<2min): 5s
- OT: 5s
- Halftime: infinite (paused)

## Burst Detection
Tracks anchor fill sides — if 2+ on same side within 5s, snaps all pending rungs. Prevents feeding momentum waves.

## Apex Key Differences from Phantom
| | Phantom | Apex |
|---|---|---|
| Sides | Dog only -> hedge after fill | Both sides upfront |
| Speed | Maximum (precalc, <5ms) | Fast but has time-decay |
| Ceiling | None — snaps to bid uncapped | 98c hard ceiling on posting |
| Exit | Fav fill at any price | Two-step: target -> snap -> sellback |
| Walk | Snap to bid, no cap | Two-step with cap during pending_profit |
| Stop-loss | None — loss tracked by smart mode | Combined > threshold -> sellback |
| Cancel+replace | Uses amend_order | cancel+replace (no amend) |

---

# Meridian Bot — The Queen (Middle Arb)

## Core Strategy
Buy NO on two opposing spread markets for the same game. Only one team can cover, so at least one NO always wins (100c payout). If the score lands in the middle zone, BOTH NOs win (200c payout).

**Meridian is a girl — the queen. Crown is her signature.**

## NO Pricing Logic
- **NO "wins by 1.5"** = CHEAP (~30c). Team probably covers 1.5, so NO is unlikely -> cheap.
- **NO "wins by 25"** = EXPENSIVE (~95c). Teams almost never win by 25+, so NO is near-certain -> expensive.

## Middle Pairs
- **Cheap pairs (top of scanner):** Tight spread, tiny middle zone but combined cost can be under 100c = instant arb.
- **Expensive pairs (bottom):** Wide spread, massive middle zone likely to hit, but costs 150-170c+. Need volatility catch.

## Arb Math
- Combined cost = 100c -> straight middle (0c arb, profit only if both NOs win)
- Combined cost = 98c -> 2c guaranteed profit (one NO always wins = 100c)
- Combined cost = 96c -> 4c guaranteed profit
- Combined cost CAN dip below 100 during volatility — that's when you catch it.

## Scanner Suggested Prices
- Width presets: Straight (target 100c), +2c (98c), +4c (96c), +6c (94c)
- Tight spread (<=2c): Shave from bid+1, apply arb width
- Gapped spread (>2c): ALWAYS bid+1 to be first in line
- Shave evenly off BOTH sides

## How Fills Happen
- Place orders PREGAME at shaved prices
- Both legs don't dip at the same time — game momentum shifts one way, catch the other when it swings back
- Score changes during live play cause volatility -> NO prices fluctuate -> orders fill

---

# Apex Market Maker — Continuous Spread Collector

Continuously quotes both sides with a 1c-spaced ladder, collecting spread as fills trickle in:
- Config: `start_gap`, `levels`, `spacing`, `qty_per_level`, `inventory_limit`, `loss_limit_cents`, `smart_mode`
- Midpoint from LocalOrderbook: `(yes_bid + (100 - no_bid)) / 2`
- Net inventory tracking with weighted average cost basis (no per-rung isolation)
- Drift reprice: if midpoint moves 2+ cents, cancel unfilled and repost
- Inventory limit: pause one side when net exceeds limit, resume with hysteresis
- Bot statuses: `market_making_active` -> `mm_depth_pulled` -> `mm_exiting` -> `completed`

---

# Critical Rules — READ THESE

## NEVER Do
- **Never modify phantom/anchor bot code without explicit user permission** — it's working and fragile
- **Never revert code without user explicitly telling you to**
- **Never use ladder_arb/larb/LADDER_ARB naming** — was renamed to apex, old names cause real bugs
- **Never add fee calculations to bot logic** — only in P&L tracking. 98c = breakeven, simple.
- **Never add timeout or sellback to Phantom** — two exits only (fav fill or dog sell)
- **Never auto-recover deleted trades from trades.jsonl without asking**
- **Never merge P&L between bot types** — each has completely separate P&L, history, and calendar
- **Never assume how strategies work** — ask or verify against code first
- **Never dismiss user-confirmed issues** — if the user says it's a bug, it's a bug

## ALWAYS Do
- **Bump cache version after frontend changes** (Cloudflare caching)
- **Restart server after backend changes**: `systemctl restart meridian` (NEVER nohup)
- **Push to GitHub after every change**
- **Read actual code before explaining bot mechanics** — don't trust summaries or memory alone
- **Verify code is reachable** — Meridian has dead code from old bot systems
- **Diagnose the actual problem before touching code** — stop guessing
- **Do comprehensive logging when asked** — user has asked 10+ times, actually do it thoroughly

## You ARE On Production
Every file edit on this VPS affects the live server immediately. There is no staging environment. Be careful.

## Restart Procedure
```bash
git pull origin main && systemctl restart meridian && sleep 4 && systemctl status meridian
```
Always push to GitHub BEFORE restarting. Verify single process: `pgrep -af "python3.*app.py"`

---

# Kalshi API Notes
- Uses `_fp` suffix string fields (e.g., `fill_count_fp`), NOT integer fields
- Always use `_parse_fill_count()` for order fill counts
- Rate limits: advanced tier, 30 read/s, 30 write/s, burst=28
- `api_rate_limiter.wait()` before every API call

---

# Trading Theory Applied

## Adverse Selection Severity (by bot)
1. **Phantom single-dog**: highest — single deep fill = most adverse
2. **Phantom ladder**: moderate-high — multiple fills average out somewhat
3. **Apex**: moderate — both-sides posting, cancel opposite on fill
4. **Meridian**: lowest — two-legged, legs partially hedge each other

## Speed Hierarchy
1. Phantom hedge (WS hot-path, precalc, sub-5ms) — most critical
2. Apex consolidation hedge (priority burst, hedge-first) — second priority
3. Apex walk/snap (20s intervals, market-adaptive) — patient but responsive
4. Meridian entry (pregame placement, hours to fill) — speed irrelevant

## Ceiling System — REMOVED (2026-04-11)
- No more WALK_CEILING, SNAP_CEILING, dual exit, dog sell
- Fav snaps to bid uncapped. Combined > 100c = loss, < 100c = win
- Only `HARD_CEILING_CENTS = 98` remains for pre-launch validation

---

# Key API Endpoints
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

---

# Current Work (2026-04-09)
- **Dual exit redesign** is actively being discussed/reworked
- Ceiling moved from 98 back to 100 to reduce orphan-generating dual exit races
- Cross-market uses sequential exit (cancel fav first, then sell dog) to avoid races
- Price floor pull system: sub-2c dog prices pause bot instead of killing it
