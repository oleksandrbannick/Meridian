# Kalshi Arbitrage Trading Strategies Guide

## Understanding Arbitrage on Kalshi

### What is Arbitrage?

Arbitrage is a **risk-free profit** opportunity that occurs when you can buy both sides of a binary market for less than 100¢ total.

**Key Principle**: In any binary market on Kalshi, exactly ONE outcome will happen:
- Either YES wins (pays 100¢) OR NO wins (pays 100¢)
- Never both, never neither

**Example Arbitrage:**
```
Market: "Will Bitcoin hit $100k in 2026?"
- Buy YES at 55¢
- Buy NO at 40¢
- Total Cost: 95¢
- Guaranteed Payout: 100¢
- Profit: 5¢ (5.3% return)
```

**Why it works:**
- If YES wins: You get 100¢ for YES, lose 40¢ on NO = +60¢ → Profit: 60¢ - 55¢ = +5¢
- If NO wins: You get 100¢ for NO, lose 55¢ on YES = +45¢ → Profit: 45¢ - 40¢ = +5¢

## Finding Arbitrage Opportunities

### Automatic Detection

The bot automatically highlights arbitrage opportunities:
- Look for the green **⚡ Arb: X¢** badge on market cards
- Use **"Find Arb Opportunities"** button to filter all markets
- Adjust minimum profit threshold based on your requirements

### Best Times to Find Arb

1. **Market Opens**: New markets often have inefficient pricing
2. **News Events**: Sudden events can create temporary mispricings
3. **Low Liquidity**: Less competitive markets may have wider spreads
4. **Off-Hours**: Late night/early morning when fewer traders are active
5. **High Volatility**: When markets are moving quickly

### What to Look For

✅ **Good Arbitrage Opportunities:**
- Profit > 3-5¢ per contract
- Both sides have good liquidity
- Market has time until close (not expiring immediately)
- Clear resolution criteria

❌ **Avoid:**
- Profit < 2¢ (fees may eat into it)
- Thin orderbooks (may not fill)
- Markets closing very soon (risk of last-minute moves)
- Unclear resolution criteria

## Execution Strategies

### Strategy 1: Conservative Arb (Recommended for Beginners)

**Goal**: Minimize risk, accept smaller profits

**Settings:**
- Min Profit: 5-10¢
- Stop Loss: 5%
- Position Size: Small (1-10 contracts)

**Approach:**
1. Only trade clear arbitrage opportunities (5¢+)
2. Check orderbook depth before executing
3. Start with small sizes to test the system
4. Monitor positions actively

**Pros:** Lower risk, reliable profits
**Cons:** Fewer opportunities, smaller gains

### Strategy 2: Aggressive Arb

**Goal**: Maximize profit, accept more risk

**Settings:**
- Min Profit: 3-5¢
- Stop Loss: 3-7%
- Position Size: Medium to Large (10-100 contracts)

**Approach:**
1. Jump on opportunities quickly
2. Accept tighter margins
3. Scale position sizes based on confidence
4. Use tighter stop-losses

**Pros:** More opportunities, larger profits
**Cons:** Higher risk, requires active monitoring

### Strategy 3: High-Volume Scalping

**Goal**: Many small profits add up

**Settings:**
- Min Profit: 2-3¢
- Stop Loss: 3%
- Position Size: Variable

**Approach:**
1. Execute many small arbitrage trades
2. Focus on liquid markets
3. Quick in and out
4. Automated monitoring is crucial

**Pros:** Consistent income stream
**Cons:** High volume, fees matter more

## Risk Management

### Position Sizing

**Rule of Thumb**: Never risk more than 5-10% of your account on a single trade

**Example with $1000 account:**
- Conservative: $50-100 per trade (50-100 contracts at $1 each)
- Moderate: $100-200 per trade
- Aggressive: $200-500 per trade

### Stop-Loss Settings

**What it does**: If one leg fills and price drops, automatically sells

**Recommended Settings:**
- **Conservative**: 3-5% stop-loss
- **Moderate**: 5-7% stop-loss  
- **Aggressive**: 7-10% stop-loss

**Example:**
```
You buy YES at 60¢
YES fills, but NO doesn't
YES price drops to 57¢ (5% drop)
Stop-loss triggers → Sells YES automatically
Limits your loss
```

### Maximum Exposure

**Never go all-in!** Keep reserves for:
- Multiple opportunities
- Unexpected losses
- Market moves

**Suggested Allocation:**
- 60-70%: Active trading
- 20-30%: Reserve for opportunities
- 10%: Emergency cushion

## Advanced Techniques

### 1. Legging In

Instead of placing both orders simultaneously, place one first and the second if it makes sense:

**Approach:**
1. Place the better side first (usually the side with better pricing)
2. Monitor market
3. Place second leg only if still profitable

**Risk**: Market moves against you before second leg fills
**Reward**: Can get better pricing on second leg

### 2. Scale-In Strategy

Build position gradually:

**Approach:**
1. Start with 1-5 contracts
2. If fills quickly at good prices, add more
3. Scale up to your maximum size
4. Reduces risk of bad fills on large orders

### 3. Multi-Market Arb

Look for correlated markets:

**Example:**
- Market A: "Team wins" 
- Market B: "Player scores 20+ points"
- If player is on the team, these are correlated
- Can sometimes find arb across related markets

### 4. Order Book Analysis

Before executing large trades:

**Check:**
1. **Bid-Ask Spread**: Tighter = better liquidity
2. **Order Depth**: How many contracts at each price level
3. **Recent Volume**: Is there active trading?

**Better Execution:**
- Deep orderbook → Can execute larger sizes
- Thin orderbook → Start small, scale up
- Wide spread → May not be true arb after slippage

## Understanding Fees

Kalshi charges fees on trades. **Important:** Factor fees into your calculations!

**Typical Fee Structure:**
- Maker fees: ~0-1% (when you add liquidity)
- Taker fees: ~1-3% (when you take liquidity)

**Impact on Arb:**
```
Example without fees:
YES: 60¢, NO: 35¢ = 5¢ profit

Example with fees (2% taker):
YES: 60¢ + 2% = 61.2¢
NO: 35¢ + 2% = 35.7¢
Total: 96.9¢ = 3.1¢ profit (not 5¢!)
```

**Strategy**: Try to be a maker (limit orders) rather than taker (market orders)

## Common Mistakes to Avoid

### ❌ Mistake #1: Ignoring Liquidity
**Problem**: Placing orders that never fill
**Solution**: Check orderbook depth first

### ❌ Mistake #2: No Stop-Loss
**Problem**: One leg fills, market moves, big loss
**Solution**: Always set stop-loss, monitor positions

### ❌ Mistake #3: Chasing Small Profits
**Problem**: 1-2¢ arb barely covers fees
**Solution**: Stick to 3-5¢+ minimum (adjust based on fees)

### ❌ Mistake #4: Over-Leveraging
**Problem**: All capital tied up in one trade
**Solution**: Never exceed 20% of capital per trade

### ❌ Mistake #5: Ignoring Market Close Times
**Problem**: Market closes before arb can complete
**Solution**: Check expiration times, avoid markets closing soon

### ❌ Mistake #6: Not Monitoring Positions
**Problem**: Miss stop-loss triggers, losses accumulate
**Solution**: Enable auto-monitoring, check regularly

## Player Props Special Strategy

Player props on Kalshi often DON'T show NO prices on the website, but the API has them!

### Why This Matters

**Website**: Only shows YES side for player props
**API (This Bot)**: Shows BOTH YES and NO sides

**Opportunity**: Less competition on NO side = better prices = more arb!

### Strategy for Player Props

1. **Find player prop markets** (search "points", "rebounds", "assists")
2. **Check NO orderbook** (only available via API!)
3. **Look for YES + NO < 100¢**
4. **Execute arb**

**Example:**
```
Market: "Steph Curry 25+ points"
Website shows: YES: 65¢
API shows: YES: 65¢, NO: 30¢
Arbitrage: 65 + 30 = 95¢ < 100¢ = 5¢ profit!
```

## Performance Tracking

### Keep a Trading Journal

Track these metrics:
- Date/Time
- Market
- Entry Prices (YES/NO)
- Quantity
- Expected Profit
- Actual Profit
- Time to Fill
- Any Stop-Loss Triggers

### Calculate Your ROI

**Formula:**
```
ROI = (Total Profit / Total Capital Deployed) × 100%

Example:
$50 profit on $1000 deployed = 5% ROI
```

### Set Goals

**Daily Goals:**
- Number of arb opportunities found
- Number executed
- Total profit target

**Monthly Goals:**
- Total ROI %
- Win rate (completed arbs / total arbs)
- Average profit per arb

## Example Trading Day

**Morning Routine (9:00 AM):**
1. Start the bot
2. Check for overnight fills
3. Review active positions
4. Scan for new opportunities

**Midday Trading (12:00 PM):**
1. Monitor existing positions
2. Execute 2-3 new arbs if available
3. Adjust stop-loss if needed

**Afternoon Session (3:00 PM):**
1. Final opportunity scan
2. Review performance
3. Close any positions approaching market close

**Evening Wrap-Up (6:00 PM):**
1. Check all positions settled correctly
2. Update trading journal
3. Calculate daily P&L
4. Plan for tomorrow

## Pro Tips

### Tip #1: Speed Matters
Set up hotkeys and optimize your workflow. Arb opportunities can disappear in seconds.

### Tip #2: Diversify Markets
Don't just focus on one type. Spread across sports, politics, economics, etc.

### Tip #3: Be Patient
Good arbs are rare. Don't force trades. Wait for solid opportunities.

### Tip #4: Stay Informed
Follow news related to markets you're trading. Understand what moves prices.

### Tip #5: Test in Demo First
Use Kalshi's demo environment to practice. No risk while learning.

### Tip #6: Automate Monitoring
Let the bot monitor positions. Don't manually watch all day.

### Tip #7: Know When to Stop
Set daily loss limits. If you hit them, stop trading for the day.

## Troubleshooting Common Issues

### "Both legs aren't filling"
- **Cause**: Prices moved or low liquidity
- **Solution**: Adjust prices slightly or choose more liquid markets

### "Keep getting partial fills"
- **Cause**: Insufficient orderbook depth
- **Solution**: Reduce position size or split into smaller orders

### "Stop-loss triggering too often"
- **Cause**: Stop-loss too tight or volatile market
- **Solution**: Widen stop-loss or avoid volatile markets

### "Profit less than expected"
- **Cause**: Fees, slippage, or partial fills
- **Solution**: Factor in 2-3% for fees/slippage in calculations

## Summary Checklist

Before executing an arbitrage trade:

- [ ] YES price + NO price < 100¢
- [ ] Profit > 5¢ (after fees)
- [ ] Orderbook has sufficient depth
- [ ] Market has enough time before close
- [ ] Stop-loss is configured
- [ ] Position size is appropriate
- [ ] Monitoring is enabled

---

**Remember**: Arbitrage is about consistent, small wins. Focus on execution, risk management, and steady growth. Good luck! 🎯
