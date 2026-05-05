# Apex Market Maker — Design Spec (v1 Draft)

## Concept
Replace Apex's current "post both sides, pray both fill" model with a **true market-making system** that continuously quotes both sides and collects the bid-ask spread as fills trickle in.

**Core philosophy**: You're a liquidity provider. Post resting orders on both YES and NO sides. When fills come from either direction, track net inventory. Every time net returns to zero, you've completed a round trip and banked the spread. Always maker, never taker.

---

## Configuration

| Parameter | Description | Example |
|-----------|-------------|---------|
| `start_gap` | Minimum distance from midpoint (minimum edge per side) | 4¢ |
| `levels` | Number of price levels per side | 7 |
| `spacing` | Gap between each level | 1¢ |
| `qty_per_level` | Contracts per price level | 10 |
| `inventory_limit` | Max contracts held on one side before pausing that side | 50 |
| `loss_limit_cents` | Max unrealized loss before stopping bot | 500 (= $5) |
| `smart_mode` | Stop after N consecutive losing round trips | 2 |

### Price Level Calculation

Given: `midpoint = 50¢, start_gap = 4¢, levels = 7, spacing = 1¢`

```
YES bids: 46, 45, 44, 43, 42, 41, 40
NO bids:  46, 45, 44, 43, 42, 41, 40
```

- 14 total orders (7 per side)
- No duplicates — every price appears once per side
- Combined cost ranges: 80¢ (40+40) to 92¢ (46+46)
- Profit ranges: 8¢ to 20¢ per round trip depending on which levels fill

### Dynamic Midpoint
The midpoint is calculated from the current orderbook: `midpoint = (yes_bid + (100 - no_bid)) / 2` or simply `yes_bid` when balanced. Levels are placed relative to this.

---

## Inventory Tracking

**No per-rung isolation.** Track net position across all fills:

```
net_yes = total YES contracts filled (held)
net_no  = total NO contracts filled (held)
net_position = net_yes - net_no
```

- `net_position > 0` → long YES, need NO fills to rebalance
- `net_position < 0` → long NO, need YES fills to rebalance  
- `net_position = 0` → flat, all round trips complete

### Round Trip P&L
Every time `net_position` returns to zero (or decreases), calculate the round trip profit:

```
Example sequence:
1. YES fills 10 @ 45¢  → net = +10, avg_yes = 45¢
2. YES fills 10 @ 44¢  → net = +20, avg_yes = 44.5¢
3. NO fills 10 @ 46¢   → net = +10, profit = (100 - 44.5 - 46) × 10 = 95¢
4. NO fills 10 @ 45¢   → net = 0,   profit = (100 - 44.5 - 45) × 10 = 105¢
Total banked: 200¢ = $2.00
```

Use **FIFO** or **weighted average** for cost basis:
- **Weighted average** (simpler): track `total_cost_yes` and `total_qty_yes`, avg = total/qty
- When NO fills: profit per contract = `100 - avg_yes_cost - no_fill_price`
- Deduct from yes inventory, recalculate avg

---

## Order Lifecycle

### 1. Initial Posting
```
POST all YES bids (batch API) → 7 orders
POST all NO bids (batch API)  → 7 orders
Status: market_making_active
```

### 2. Fill Handling (WS real-time)
On any fill:
1. Update inventory (`net_yes++` or `net_no++`)
2. If fill reduces net position toward zero → record round trip profit
3. Check inventory limit — if one side exceeds limit, cancel that side's remaining orders
4. **Immediately repost** the filled order at the same price (stay in market)

### 3. Continuous Quoting
After every fill, repost the filled level. The ladder stays full at all times unless:
- Inventory limit hit on one side
- OBI pulls all orders
- End of game

### 4. OBI Depth Gating (existing system)
Same thresholds as current Apex:
- **Pull** when: either side depth < 300, |OBI| > 0.7, vanishing liquidity
- **Repost** when: both sides > 350, |OBI| < 0.65
- **Max pull cycles**: 8 before giving up

When pulled: all unfilled orders cancelled. Held inventory stays (can't cancel fills).
When recovered: repost full ladder at fresh prices (recalculate from current midpoint).

---

## Risk Management

### Inventory Limit
If `net_yes > inventory_limit` (e.g., 50 contracts):
- **Cancel all YES orders** (stop accumulating)
- Keep NO orders live (need fills to rebalance)
- Resume YES quoting when `net_yes < inventory_limit - 10` (hysteresis buffer)

Same logic for NO side.

### Unrealized P&L Stop
Every monitor tick, calculate unrealized P&L:
```
If net_yes > 0:
  unrealized = (current_yes_bid - avg_yes_cost) × net_yes
If net_no > 0:
  unrealized = (current_no_bid - avg_no_cost) × net_no
```
If `unrealized < -loss_limit_cents` → stop bot, begin exit sequence.

### Crash Protection (One-Sided Move)
If you're holding +30 YES and the YES bid crashes from 48¢ to 20¢:
- OBI should detect this (book goes one-sided) → pulls all orders
- You're sitting on losing inventory but NOT adding more
- When book recovers, repost — NO fills will now come at lower prices
- If it never recovers (game ends) → exit at settlement or sell back at bid

Key insight: binary markets settle at 0 or 100. If you hold YES at avg 45¢ and YES wins → you get $1, profit = 55¢/contract. If YES loses → you get $0, loss = 45¢/contract. The crash was temporary noise.

**Decision at end of game**: Hold through settlement if you believe the side could still win, OR sell back at bid if you want to cut losses before settlement.

### Smart Mode (Consecutive Loss Stop)
Track consecutive round trips that are net negative. If `consecutive_losses >= smart_mode_limit` (default 2), stop the bot.

A "losing round trip" means: the NO fill that closed the position resulted in negative P&L (combined > 100¢ after fees). This shouldn't happen often in maker-only mode but could occur if fills come at bad levels during volatile moments.

---

## End-of-Game Exit

### Detection
Same as current Apex: ESPN game context, check period + clock.

### Exit Sequence
1. **Cancel all unfilled orders** (stop new fills)
2. **If net_position = 0**: done, record final P&L
3. **If holding inventory**:
   - Post maker sell orders at current bid for held side
   - Follow bid down every 5s (same as current Apex maker exit)
   - If game ends → contracts settle at 0 or 100, P&L is automatic

### Settlement Math
If holding 30 YES contracts at avg 45¢:
- YES wins: profit = (100 - 45) × 30 = 1650¢ = $16.50
- YES loses: loss = 45 × 30 = 1350¢ = $13.50

This is why inventory limits matter — cap exposure so settlement losses are bounded.

---

## Monitor Loop (per tick)

```python
def _apex_mm_tick(bot_id, bot):
    # 1. Check OBI — pull if hostile
    if _apex_should_pull(ticker):
        _apex_mm_pull_all(bot_id, bot)
        return
    
    # 2. If pulled, check recovery
    if bot['status'] == 'mm_depth_pulled':
        if _apex_depth_recovered(ticker):
            _apex_mm_repost_ladder(bot_id, bot)
        return
    
    # 3. Check inventory limits
    _apex_mm_check_inventory(bot_id, bot)
    
    # 4. Check unrealized P&L stop
    _apex_mm_check_loss_limit(bot_id, bot)
    
    # 5. Check game phase — exit if ending
    _apex_mm_check_game_end(bot_id, bot)
    
    # 6. Repost any filled levels (continuous quoting)
    _apex_mm_repost_filled(bot_id, bot)
    
    # 7. Drift check — if midpoint moved significantly, reprice ladder
    _apex_mm_drift_check(bot_id, bot)
```

### Drift / Reprice
If the midpoint moves more than 2¢ from where the ladder was posted:
- Cancel all unfilled orders
- Repost at new prices centered on current midpoint
- Keep held inventory (don't touch filled positions)
- This keeps the ladder centered on the action

---

## State Tracking

```python
bot = {
    'type': 'apex_mm',
    'status': 'market_making_active',  # or mm_depth_pulled, mm_exiting, completed
    'ticker': 'KXNBAGAME-26APR10LAKBOS-LAL',
    
    # Config
    'start_gap': 4,
    'levels': 7,
    'spacing': 1,
    'qty_per_level': 10,
    'inventory_limit': 50,
    'loss_limit_cents': 500,
    
    # Ladder state
    'midpoint': 50,
    'yes_orders': {46: {oid, qty, fill_qty}, 45: {...}, ...},
    'no_orders':  {46: {oid, qty, fill_qty}, 45: {...}, ...},
    
    # Inventory
    'net_yes': 0,       # total YES contracts held
    'net_no': 0,        # total NO contracts held
    'avg_yes_cost': 0,  # weighted average cost of YES inventory
    'avg_no_cost': 0,   # weighted average cost of NO inventory
    'total_yes_cost': 0,# total cents spent on YES
    'total_no_cost': 0, # total cents spent on NO
    
    # P&L
    'realized_pnl_cents': 0,    # banked profit from completed round trips
    'round_trips_completed': 0,
    'consecutive_losses': 0,
    
    # OBI
    '_pull_count': 0,
    '_last_pull_reason': '',
}
```

---

## Comparison: Current Apex vs Market Maker Apex

| | Current Apex | Market Maker Apex |
|---|---|---|
| **Strategy** | Post both sides, need both to fill | Continuously quote, collect spread over time |
| **Fill requirement** | Both sides must fill per rung | Any fill is fine, net tracks balance |
| **Time pressure** | Yes — time decay, panic, sellback | No — patient, always quoting |
| **Exit paths** | 3 (arb complete, sellback, stop-loss) | 1 (end of game or loss limit) |
| **Complexity** | High (5-stage time decay per rung) | Low (quote, fill, repost) |
| **OBI gating** | Pull/repost unfilled | Same — pull/repost unfilled |
| **Inventory risk** | 1 rung max exposure | Capped by inventory_limit |
| **Profit source** | Width between matched fills | Spread between any YES+NO fills |
| **Order count** | 2 per rung × N rungs | 1 per level × N levels × 2 sides |
| **Maker only** | Yes (mostly) | Yes (always) |

---

## Open Questions

1. **Fees**: Maker fees on every fill. With 8¢ minimum edge (46+46=92) and ~1.7% maker fee, fee per side at 46¢ ≈ 0.43¢. Round trip fees ≈ 0.86¢. Comfortable margin.

2. **Qty scaling by level**: Should deeper levels (cheaper, wider edge) get more contracts? E.g., 10 qty at 46¢ but 20 qty at 42¢? Higher risk but higher reward on the deep fills.

3. **Multiple markets**: Run on several games simultaneously? Inventory is per-market so risk is isolated.

4. **Repost delay**: After a fill, repost immediately or wait a beat? Immediate = maximum time in market. Delay = avoid getting swept if a large order is eating through levels.

5. **Settlement strategy**: When holding inventory at game end — sell back at bid (certain but possibly lossy) or hold through settlement (binary: big win or big loss)? Could be configurable.

6. **Partial fills**: If a 10-qty order fills 3, do we repost the remaining 7 at the same price? Or let it ride?

---

## Next Steps

1. **Discuss and refine** this spec
2. **Simulate** on paper with real market data — pick a game, walk through the fills
3. **Build** as a new bot type (`apex_mm`) alongside existing Apex (don't replace)
4. **Test** with small qty on one game
5. **Iterate** based on real results
