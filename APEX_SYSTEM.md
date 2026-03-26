# Apex System — Complete Technical Documentation

## What Is Apex?

Apex is a **multi-width ladder arbitrage bot** for the Kalshi binary options exchange. It targets sports prediction markets (NBA, NFL, NHL, MLB, NCAAB) where YES and NO prices don't sum to 100¢, identifying profit opportunities by posting simultaneous YES+NO limit orders at multiple price levels ("rungs") and automatically hedging filled positions.

**Core Concept**: Post many small positions across different "width" levels (e.g., 5¢, 8¢, 12¢, 14¢ spreads), wait for some to fill naturally as the game develops, then instantly hedge the filled side to lock in the arb profit.

**Example**: If YES is at 45¢ and NO is at 50¢, the combined cost is 95¢ for a contract that always pays out 100¢ — that's a 5¢ guaranteed spread. Apex systematically captures these across multiple price levels simultaneously.

---

## Architecture

### Backend (Python/Flask)
- **Main file**: `backend/app.py` (~21,500 lines)
- **Kalshi API client**: `backend/kalshi_api.py` (~13,600 bytes)
- **State persistence**: `data.json` (atomic save), `trades.jsonl` (append-only log), `activity_log.jsonl` (detailed events)
- **Authentication**: RSA-PSS signing for Kalshi API v2

### Frontend (Vanilla JavaScript)
- **Main file**: `frontend/app.js` (~12,500 lines)
- **Template**: `frontend/index.html`
- **Real-time updates**: WebSocket from Kalshi + polling for bot status
- **UI components**: Market cards, bot cards, trade history, P&L dashboard, live scores

### API Layer
- Kalshi REST API v2 with RSA-PSS authentication
- WebSocket for real-time fills and price updates
- Rate limiting via `api_rate_limiter` and `api_read_limiter`

---

## How Apex Fits Into Meridian

Meridian hosts 6 bot types. Apex is one of them:

| Bot Type | Code | Description |
|----------|------|-------------|
| **Apex** | `ladder_arb` | Multi-width ladder — posts YES+NO at multiple rungs, consolidates hedge on first fill |
| Phantom | `anchor_dog` | Posts only dog leg first, instantly hedges on fill |
| Phantom Ladder | `anchor_ladder` | Multi-rung dog + instant hedges per rung |
| Scout | `bet` | Stop-loss + take-profit wrapper on existing position |
| Meridian | `middle` | Dual-leg spread arb (opposing NO+NO) |
| Regular Arb | `arb`/`both_posted` | Simultaneous YES+NO at a single price |

---

## Apex Bot Lifecycle

### Phase 1: Creation (`create_ladder_arb()`)

**User inputs:**
- **Ticker**: Market to trade (e.g., `KXNBAGAME-26MAR20PHISAC-SAC`)
- **Widths**: Array of spread targets (e.g., `[5, 8, 12, 14]` cents)
- **Quantity**: Base contracts per rung (e.g., `1`)
- **Width Scaling**: Auto-scale contracts by width (wider = more contracts)
- **Repeat Count**: Number of bot cycles (0 = single, 999 = infinite/smart mode)
- **Hard Ceiling**: Max allowed combined price (default: 98¢, range: 96-98)

**Creation flow:**
1. Fetch live orderbook -> compute bid/ask for YES and NO
2. For each width, calculate target YES+NO prices using `_calculate_arb_prices_server()`
3. Validate prices meet hard ceiling and have positive edge
4. Batch-place ALL YES orders together, then ALL NO orders together (2 API calls total)
5. Store bot state in `active_bots` dict with initial status: `ladder_arb_posted`
6. Subscribe WebSocket to ticker for real-time fills

**Bot ID format**: `larb_{ticker}_{unix_ms}`

### Phase 2: Monitoring (`_handle_apex()`)

Every 3 seconds via the monitor loop:
- Check market status (if settled, cancel everything and complete)
- Update live bid/ask from WebSocket cache
- Handle fills from the monitor cycle
- Process hedge walking (amending hedge price toward market when stuck)
- Manage sell-back exits when game ends

### Phase 3: First Fill -> Consolidation

When ANY anchor rung fills (YES or NO side):

1. **Status change**: `ladder_arb_posted` -> `ladder_arb_yes_filled` or `ladder_arb_no_filled`
2. **Sweep & Hedge** (`_execute_ladder_arb_sweep_and_hedge()`):
   - **Phase 1a** (locked): Compute weighted average of filled rungs
   - **Phase 1b** (unlocked): Place consolidated hedge order at calculated price
   - **Phase 1c** (locked): Store hedge order ID, mark `_consolidated = True`
   - **Phase 2**: Cancel all opposite-side rung orders (we only need one hedge now)
   - **Phase 3**: Verify against Kalshi for missed fills

**Critical design decision**: All rung fills are consolidated into ONE hedge order (not one hedge per rung). This minimizes API calls and simplifies tracking.

**Hedge price calculation**:
```
hedge_price = 100 - avg_filled_price - weighted_avg_width
capped at: min(hedge_price, hard_ceiling - avg_filled_price)
```

### Phase 4: Late Anchor Fills

After consolidation, if more anchor rungs fill:
- Amend the existing hedge order to higher quantity (via Kalshi `amend_order`)
- Update bot's `hedge_qty` using `max()` to avoid race condition downgrades
- Handle cancel-fill race: if hedge fills while cancelling remaining anchors, complete the bot

### Phase 5: Rung Completion

When hedge fills >= anchor fills for a rung:
- Record P&L via `_record_rung_completion()`
- Log to trade history with width, prices, quantity, P&L, fees
- Mark rung as `completed: True`
- Increment `completed_rungs_count`

**P&L formula per rung:**
```
Gross P&L = (100 - yes_price - no_price) * quantity
Fee = anchor_fee + hedge_fee  (Kalshi maker formula)
Net P&L = Gross P&L - Fee
```

**Kalshi fee formula:**
```
fee = ceil(0.0175 * qty * P * (1-P) * 100)
where P = price / 100
```

### Phase 6: Completion

When all rungs are completed (or bot times out):
- Cancel remaining open orders
- Transition status to `completed`
- Log final bot stats (P&L, latency, walk count)
- If `repeat_count > repeats_done`, transition to `waiting_repeat`

### Phase 7: Repeats

If repeat cycles remain:
- Wait 10s cooldown in `waiting_repeat` state
- Fetch fresh orderbook
- Repost ladder with same widths at new market prices
- Increment `repeats_done`
- Restart monitoring cycle

### Phase 8: Sell-Back (Emergency Exit)

When game enters critical phase (final 2 min) and hedge is NOT yet filled:
- Place market-sell order for the filled anchor position
- Walk sell price down toward bid adaptively
- Once sell fills, record exit via `_apex_sellback_complete()`
- Transition to `awaiting_settlement` if market dies

---

## Key Algorithms

### A. Price Calculation (`_calculate_arb_prices_server()`)

For each width, computes optimal YES+NO order prices:

1. **Target total**: `100 - width` (e.g., 5¢ width -> target 95¢ combined)
2. **Spread detection**: If ask > bid (wide spread), use ask-side pricing; otherwise bid-side
3. **Shave distribution**: 60% from fav side, 40% from dog side
4. **Bounds**: Clamp to 1-98¢, enforce minimum width via fav adjustment

**Example:**
- Market: YES bid 45, YES ask 50, NO bid 54, NO ask 60
- Width: 5¢, Target total: 95¢
- Result: YES order at 47¢, NO order at 48¢ (95¢ combined, maker-buy both sides)

### B. Quantity Scaling (`_scale_qty_for_width()`)

Wider spreads = higher confidence in fill, so size up:

```
WIDTH_QTY_TIERS:
  13-16¢ width  ->  3x base quantity
  9-12¢ width   ->  2x base quantity
  5-8¢ width    ->  1x base quantity
```

### C. Adaptive Hedge Walking

Once hedge is placed and not filling, Apex walks the price toward the market:

- **Walk interval** (based on game urgency):
  - Normal game: 20s
  - Halftime: 10s
  - Late game (final 2 min): 3s
  - Critical (game ending): 1s
- **Walk target**: `max(bid, ask-1)` if spread > 2¢, else `bid+1`
- **Each walk**: Reduce price by 1¢ toward walk target
- **Ceiling guard**: If combined price >= hard_ceiling (98¢), stop walking and wait

**Walk states:**
- **SNAP**: Hedge already at bid or better
- **WALKING**: Actively amending toward bid
- **CEILING**: Combined price >= hard_ceiling, waiting
- **FILLED**: Hedge fully filled

### D. Fill Recomputation (`_recompute_apex_fills()`)

After consolidation, redistribute hedge fills across anchor rungs:

```
Example: hedge filled 5 contracts, anchors filled at rungs [1, 2, 1]:
  Rung 0: anchor 1 -> assign hedge 1 -> COMPLETED
  Rung 1: anchor 2 -> assign hedge 2 -> COMPLETED
  Rung 2: anchor 1 -> assign hedge 0 -> WAITING

Edge: 3 anchors filled but only 2 hedges -> Rung 2 stays incomplete
```

### E. Drift Guard (Repeat Protection)

When reposting after a cycle:
- If market lean (|yes_bid - no_bid|) > 30¢, skip this repeat cycle
- Wait for market to rebalance before reposting
- Prevents entering one-sided blowout games
- Does NOT kill the bot, just holds repeats

---

## Configuration & Parameters

### Hard Ceiling (default: 98¢)
- Absolute maximum combined bid price
- User-configurable: 96-98 range
- Prevents posting at prices where profit is impossible after fees

### Snap Threshold (98¢)
- When hedge + anchor combined >= 98¢, stop walking
- Market will oscillate naturally; don't waste API calls amending

### Timeout
- Computed per bot based on narrowest width
- Narrow widths (5¢) -> longer timeout (tiny profit, willing to wait)
- Wide widths (14¢) -> shorter timeout (big opportunity, if not hit fast, context changed)

### Smart Mode
- Sets `repeat_count = 999` (effectively infinite)
- Bot monitors until:
  - Market dies (bid crash to <= 1¢)
  - Game ending (final 2 min, auto-cancel)
  - Blowout drift (price lean > 30¢, pause repeats)
  - Manual user stop

---

## Real-Time Infrastructure

### WebSocket Manager (`KalshiWSManager`)
- Subscribes to ticker on bot creation
- On real-time fill: triggers `_ws_realtime_fill_handler()`
- Updates bot's rung fill counts instantly (not waiting for 3s monitor cycle)
- Spawns `_execute_ladder_arb_sweep_and_hedge()` on first anchor fill
- Provides sub-100ms fill detection

### Monitor Loop (`_run_monitor()`)
- Runs every 3 seconds for all active bots
- For Apex: handles timeout, repeat cycles, walk amendments, settlement checks
- Calls `_handle_apex(bot_id, bot, actions)` per bot

### State Persistence
- **data.json**: Atomic save after every state change (create, fill, completion, walk)
- **trades.jsonl**: Append-only, one JSON line per event (backup/audit trail)
- **activity_log.jsonl**: Every bot action with detailed metadata for debugging

---

## Performance Metrics

### Latency Tracking
- **raw_hedge_ms**: Fill detection to Kalshi API hedge send (target: <100ms)
- **api_ms**: Kalshi API response time for hedge order
- **round_trip_ms**: Fill -> hedge order confirmed on Kalshi (target: <500ms)

Example log output:
```
APEX HEDGE: bot_id @56¢ x 5 | raw=12.5ms api=45.2ms rt=234.1ms
RUNG COMPLETE: 8¢ width YES@42 NO@56 +18¢ (1/12 rungs) hedge_lat=0.3s
```

---

## Frontend UI

### Market Card
- Shows arb recommendation score (0-100)
- Displays "APEX" button when quality meets threshold
- Score factors: Depth/spread (35pts), Balance (30pts), Live game (20pts), Volume (15pts)

### Apex Bot Card (`_renderLadderArbCard()`)
Real-time display of:
- **Status badges**: BOTH LIVE, YES FILLED, NO FILLED, REPEATING, COMPLETE
- **Rungs table**: Each rung shows width, YES/NO prices, qty, fill status
- **Anchor summary**: "YES ANCHOR: 3 contracts @ avg 42¢"
- **Hedge detail**: "NO HEDGE: 5 contracts @ 56¢ (fill status, gap to bid)"
- **Walk status**: Walk count, next walk timer, urgency badge
- **Ceiling distance**: Cents away from hard ceiling
- **P&L**: Estimated or realized profit based on combined prices minus fees
- **Game score**: Live score badge
- **Run counter**: "Run 2/4" if repeating

---

## System Interactions & Guards

### Phantom Conflict Guard
- Prevents simultaneous Phantom + Apex on the same ticker
- Reason: Apex posts both YES+NO; Phantom positions would interfere

### Meridian Rebalancer Integration
- Apex does NOT have a built-in late-game block (unlike Phantom)
- Meridian rebalancer monitors Apex sell-back positions when hedge hasn't filled + game ending
- Can auto-reduce or exit via market sell

### Settlement Auto-Cancel
- If market settles while bot is active, immediately cancel all orders
- Mark bot as completed with settlement status
- No P&L recorded for unfilled positions

---

## Summary

Apex is a production-grade arbitrage engine that:
1. **Scales** across 1-20 market price levels simultaneously
2. **Adapts** contract sizes based on spread confidence (5¢ -> 1x, 14¢ -> 3x)
3. **Consolidates** all fills into a single synthetic hedge order for efficiency
4. **Walks** intelligently toward market prices when stuck
5. **Repeats** profitably until game conditions deteriorate
6. **Exits** gracefully via sell-back when game ends
7. **Tracks** sub-100ms latency metrics for optimization
8. **Persists** state atomically for crash recovery

It combines real-time WebSocket fills, intelligent price calculation, fee-aware P&L accounting, and game context awareness to maximize arbitrage profits in fast-moving binary options markets.
