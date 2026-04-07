# Market Microstructure Reference for Kalshi Bot Trading

Compiled 2026-03-23. Practical reference for running automated market-making and arbitrage bots on Kalshi (CFTC-regulated binary event contracts exchange).

---

## 1. Adverse Selection in Market Making

### What it is in plain terms

Adverse selection is the fundamental curse of posting limit orders: **your orders get filled most often when you're wrong**. You post a bid at 45c. If the true value stays at 45c or goes higher, other participants have no urgency to sell to you -- they'll wait for better prices. But the moment the true value drops below 45c, suddenly everyone wants to sell to you at 45c. You get filled, and you're immediately underwater.

This is not bad luck. It is a **structural property of limit orders**. Academic research confirms that every limit order fill incurs significant negative mid-price drift on average -- meaning the price moves against you after your fill more often than it moves in your favor. The fill rate when your prediction is correct is much lower than the fill rate when your prediction is wrong.

### The Winner's Curse

The winner's curse is the limit-order version of "if they're selling to you, ask yourself why." In an auction, the winner often overpaid because winning itself is evidence that everyone else thought it was worth less. For limit orders:

- Your bid sits in the book at 45c
- It fills when someone aggressively sells into it
- That aggressive sell is **information** -- the seller knows (or believes) it's worth less than 45c
- Your "win" (getting filled) is actually evidence you're on the wrong side
- The more urgently someone fills your order, the worse it is for you

The conditional value of an asset, **given that your limit order was filled**, is worse than the unconditional value. This is not a risk you can diversify away -- it is baked into every single limit order.

### How it applies to Kalshi arb bots

On Kalshi, adverse selection hits in specific ways:

**News-driven fills**: Binary event contracts are driven by discrete information events. When news breaks (economic data release, weather update, political development), informed traders immediately hit resting limit orders. Your bot's bid that was placed during a quiet period gets swept by someone who already knows the contract is going to zero.

**The YES+NO=100c constraint makes it worse**: If you're running arb across YES and NO sides, getting adversely filled on one side means you now need the other side to fill to complete your arb. But if one side filled because informed traders dumped into it, the other side's price just moved against you too. You end up with a one-legged position in a contract that's moving away from you.

**Expiry proximity amplifies it**: As contracts approach expiry, information asymmetry increases dramatically. Someone watching a live feed of the underlying event knows the outcome before the market fully prices it. Your resting orders become free money for anyone with faster information.

**Thin books make it catastrophic**: Kalshi order books are often thin. A single informed trader can blow through your entire resting order and move the market 5-10c, leaving you with a large adverse position.

### Practical strategies

1. **Skew your quotes based on recent fill patterns**: If your bids are filling much more than your asks (or vice versa), that's a signal you're being adversely selected on one side. Widen the spread on that side or pull quotes entirely.

2. **Cancel fast after one side fills**: If your bid fills, immediately cancel your ask (or vice versa). The fill itself is information that the market is moving. Don't wait for the other side to "complete the arb" -- it may never come, or it'll come at a much worse price.

3. **Avoid posting during information events**: If you know economic data drops at 8:30 AM, pull all resting orders at 8:29. The adverse selection cost of getting picked off once can erase days of spread-capture profits.

4. **Use smaller order sizes**: Smaller orders = smaller adverse selection losses when you get picked off. You can always refill. A large resting order is a juicy target for informed traders.

5. **Track your fill-vs-cancel ratio at each price level**: If a disproportionate number of your orders at aggressive prices are filling (rather than being canceled by you), you're probably posting too aggressively and getting adversely selected.

6. **Time-limit your resting orders**: The longer an order sits, the more likely it becomes stale. Consider canceling and re-posting periodically to avoid having stale quotes sitting in the book.

---

## 2. Market Microstructure for Binary Options

### What it is in plain terms

Binary option (event contract) order books have unique structural properties that don't exist in equity or futures markets. The single most important constraint is:

**YES price + NO price = 100c (always)**

This isn't a rough relationship -- it's an **exchange-enforced invariant**. If you buy YES at 60c, you're implicitly selling NO at 40c. If someone buys YES at 60c and someone else buys NO at 40c on the same contract, the exchange collects 100c and will pay exactly 100c at settlement (100c to YES holder if event happens, 100c to NO holder if it doesn't).

### How the order book works

Kalshi's order book is a Central Limit Order Book (CLOB) with price-time priority, similar in structure to equity exchanges. Key differences from equity:

**Bounded price range**: Prices can only exist between 1c and 99c. There is no price discovery outside this range. This means:
- There's a natural ceiling and floor on how far the market can move
- At extreme prices (95c+, 5c-), the book behaves differently -- it becomes very one-sided
- Spread as a percentage of price varies enormously (a 2c spread at 50c is 4%, but at 5c it's 40%)

**Spreads in binary options**:
- The "spread" is the gap between the best bid and best ask on the YES side
- A typical liquid Kalshi market might have a 2-4c spread
- Illiquid markets can have 10-20c spreads or no resting orders at all
- Because YES+NO=100c, the YES spread and NO spread are the same thing viewed from opposite sides. If YES bid/ask is 45/49, then NO bid/ask is 51/55 (same 4c spread)

**Settlement is binary**: Unlike equities where prices can drift slowly, binary contracts settle at exactly 0c or 100c. This creates:
- Increasing volatility near expiry as the price "resolves" toward 0 or 100
- Extreme adverse selection risk near expiry (someone knows the outcome before the price reflects it)
- No ability to "average down" meaningfully -- if you're wrong, you lose the full amount

**Taker fees, no maker fees**: Kalshi charges taker fees of 7c * P * (1-P) per contract, where P is the price in dollars. This means:
- Maximum fee is at 50c (1.75c per contract)
- Fees approach zero as price approaches 0c or 100c
- Makers (limit orders) pay no fee
- This creates a natural incentive to provide liquidity via limit orders
- For arb calculations, you must account for the taker fee on whichever leg requires crossing the spread

### How it applies to Kalshi arb bots

**Intra-market arb (YES+NO < 100c)**: If you can buy YES at 45c and buy NO at 52c, total cost is 97c for a guaranteed 100c payout = 3c profit before fees. These opportunities are rare on a single market but are the bread and butter of scanning bots.

**The spread IS the arb opportunity**: When you post a bid on YES at 45c, you're simultaneously offering to sell NO at 55c. Your "spread" is your edge. If you can get filled on both YES and NO such that YES_price + NO_price < 100c, you profit.

**Inventory risk is existential**: In equities, holding inventory is a temporary inconvenience. In binary options, holding inventory at expiry is a coin flip between full payout and zero. This makes inventory management the single most critical concern.

### Practical strategies

1. **Always think in terms of total cost**: If you own YES at 45c, your max loss is 45c and max gain is 55c. If the true probability is 45%, you're at breakeven before fees. You need edge beyond the market's implied probability.

2. **Monitor both sides simultaneously**: Don't just watch the YES book. The NO book IS the other side of your trade. If NO liquidity dries up, your YES position just got harder to hedge.

3. **Account for fees in all arb calculations**: A "3c arb" with 1.5c in taker fees is actually a 1.5c arb. At Kalshi's fee structure, breakeven for a round-trip arb depends on where in the price range you're trading. At 50c, fees eat the most.

4. **Respect the 98c ceiling**: At 98c (2c from max), you're paying 98c to potentially make 2c. The risk/reward is 49:1 against you. This is where adverse selection is most brutal -- the only reason someone sells to you at 98c is if they know the event won't happen.

---

## 3. Toxic Flow vs. Informed Flow

### What it is in plain terms

Not all order flow is created equal. When someone fills your limit order, they fall into roughly two categories:

**Uninformed flow (good for you)**: Random traders, hedgers, people with no special information. They buy and sell for reasons unrelated to the contract's true value. When you trade against uninformed flow, you expect to profit on average because your spread captures edge.

**Informed/toxic flow (bad for you)**: Traders who know something you don't. They're buying because the contract is underpriced or selling because it's overpriced. When you trade against informed flow, you lose on average because the market is about to move against your new position.

The key insight: **a trade can be toxic without the counterparty being "informed" in the traditional sense**. A trade is toxic if, after it occurs, the price moves against the liquidity provider. This can happen from:
- Actual information (someone knows the outcome)
- Momentum (the market is moving and you're providing liquidity into the move)
- Latency (someone saw a price change on a correlated market and is picking off your stale quote)

### How to detect toxic flow

**Pattern 1: Fills followed by immediate price moves**
Track what happens after your orders fill. If the mid-price consistently moves against you within seconds of a fill, you're absorbing toxic flow. Specifically:
- Bid fills followed by the new best bid being lower than your fill = adverse
- Ask fills followed by the new best ask being higher than your fill = adverse
- If >60% of your fills are adverse, you have a toxicity problem

**Pattern 2: Fill rate asymmetry**
If your bids fill 80% of the time but your asks only fill 20%, the market is moving down and informed sellers are hitting your bids. The asymmetry itself is the signal.

**Pattern 3: Large fills vs. small fills**
Informed traders often trade in larger size. If your fills are bimodal (many small fills that are profitable, occasional large fills that are catastrophic), the large fills are likely toxic.

**Pattern 4: Time-of-day patterns**
Toxic flow clusters around information events. If your P&L consistently dips at specific times (data releases, market opens), those are toxic flow windows.

**VPIN (Volume-Synchronized Probability of Informed Trading)**:
An academic metric that measures order flow toxicity by looking at the imbalance between buy-initiated and sell-initiated volume. High VPIN = high probability of informed trading = dangerous time to have resting orders. The practical version: track the ratio of buys-to-sells in recent volume. If it's heavily skewed, informed traders are likely driving the market.

### How it applies to Kalshi arb bots

On Kalshi, toxic flow takes specific forms:

**Event watchers**: Someone watching a live event (sports game, election count, weather sensor) can trade before the market prices in the new information. Your resting arb orders get picked off by someone who already knows the contract should be worth 80c, not 50c.

**Cross-market arb**: If the same event trades on Kalshi and Polymarket, a price change on Polymarket creates instant toxic flow on Kalshi. Someone sees Polymarket move to 60c and immediately buys on Kalshi where the book still shows 55c. If your sell order is at 55c, you just got picked off by cross-market information flow.

**Bot-on-bot**: Other bots with faster connections or better models are toxic to you. If a faster bot consistently takes your resting orders right before the market moves, that bot has information (or speed) you don't.

### Practical strategies

1. **Track adverse fill rate religiously**: For every fill, log the mid-price at fill time and the mid-price 5s, 30s, 60s later. Calculate what percentage of your fills are followed by adverse moves. If it's above 55-60%, your quoting strategy needs adjustment.

2. **Implement asymmetric quoting**: If you detect toxic flow on the buy side (lots of aggressive buying), widen your ask or pull it entirely. Don't keep offering liquidity into a one-way market.

3. **Time-based pull-back**: During known information events, pull all quotes. The adverse selection cost of one bad fill during a news event can exceed a full day's spread capture profits.

4. **Size-based filtering**: If you get hit for your full resting size, that's more likely to be informed than a 1-lot fill. Consider reducing your resting size during volatile periods.

5. **Monitor cross-market prices**: If you can see Polymarket or other venues, use price movements there as a signal to cancel your Kalshi orders before you get picked off.

6. **Decay-based cancellation**: The longer your order sits unfilled, the more stale it becomes. Implement a TTL (time-to-live) on orders and repost at updated prices.

---

## 4. Queue Priority and Order Placement

### What it is in plain terms

Kalshi uses **price-time priority (FIFO)** for order matching. This means:

1. **Price priority**: A bid at 46c will be filled before a bid at 45c, regardless of when they were placed
2. **Time priority**: Among all bids at 45c, the oldest order fills first

Your position in the queue at a given price level determines whether you get filled. Kalshi's API exposes this directly via the `GET /orders/{order_id}/queue_position` endpoint, which returns the number of contracts ahead of you at your price level.

### Why queue position matters

Consider a market with YES bid/ask at 45/49:

**Scenario A: You bid at 45c (joining the queue)**
- There are already 100 contracts bid at 45c ahead of you
- A seller comes in with 50 contracts to sell at 45c
- Those 50 contracts go to the 100 people ahead of you. You get nothing.
- You only get filled if 100+ contracts sell at 45c

**Scenario B: You bid at 46c (jumping the queue / bid+1)**
- There is no queue at 46c (it was previously empty)
- You are FIRST in line at 46c
- Any seller willing to sell at 46c or lower fills you immediately
- You "overpay" by 1c vs. the 45c bid, but you actually get filled

### The bid+1 strategy in gapped markets

This is critical for Kalshi markets. Many Kalshi order books have **gaps** -- price levels with no resting orders. Example:

```
Ask: 52c (10 contracts)
Ask: 51c (5 contracts)
Ask: 49c (empty)
Ask: 48c (empty)
Ask: 47c (empty)
Bid: 45c (50 contracts)
Bid: 44c (20 contracts)
```

In this book, the spread is 6c (45 to 51). If you bid at 45c, you're behind 50 contracts. But if you bid at 46c:
- You're alone at that level (first in queue, position = 0)
- You've narrowed the spread to 5c
- Any seller who would have sold at 45c will fill you first at 46c (better price for them)
- You "pay" 1c more but dramatically increase your fill probability

**The trade-off**: Bidding 46c instead of 45c costs you 1c per contract in edge. But if your 45c bid never fills (because it's behind 50 contracts), that edge is worth exactly zero. A filled order at 46c beats an unfilled order at 45c every time.

### Queue position and adverse selection interact

Here's the subtle part that academics document but practitioners often miss:

**Adverse selection costs increase with queue position.** Being first in queue is better not just because you fill more -- you also face LESS adverse selection. Why?

- If you're first in queue at 45c and someone sells 1 contract, you get it. That small sell might be uninformed.
- If you're 100th in queue at 45c and you get filled, it means 100+ contracts just sold at 45c. That level of selling pressure is much more likely to be informed. Your fill is evidence of a large directional move against you.

In other words: the fills you get from being deep in the queue are the worst fills. They're the ones where the market is moving aggressively through your price level.

### How it applies to Kalshi arb bots

**Thin books = queue position is everything**: Most Kalshi markets have small queues (0-20 contracts per level). Getting to the front of the queue is often the difference between your bot working and not working.

**Your arb bot competes on queue position**: If two bots are running the same arb strategy at the same price, the one with better queue position wins. The other bot gets filled only on the leftover adverse flow.

**Order modification resets your queue position**: On Kalshi, if you modify an order's price, you lose your queue position. If you modify only the quantity (and the new quantity is less than or equal to the old), you may keep your position. This has implications for how you adjust quotes.

**Gap-filling creates value**: If you're the first to bid into a gap (e.g., posting at 46c when the best bid is 45c), you create a better market and get first-in-line fills. This can be more profitable than joining a crowded price level.

### Practical strategies

1. **Use Kalshi's queue position API**: Monitor your queue position and factor it into your expected fill probability. If you're 50th in a queue that typically trades 10 contracts/hour, your expected wait time is 5 hours.

2. **Bid+1 in gapped markets**: When the spread is wide (4c+), consider posting 1c better than the best bid/ask. The 1c cost is often repaid by dramatically higher fill probability.

3. **Don't modify price unnecessarily**: Price modifications reset your queue position. If the market moves 1c and you follow it, you go to the back of the new line. Sometimes it's better to stay put and accept slightly worse pricing to keep queue priority.

4. **Place orders during quiet periods**: Orders placed during low-volume periods accumulate queue priority before the next active session. Your order sits at the front of the queue when volume picks up.

5. **Size your orders strategically**: A 1-contract order at the front of the queue fills fully on the first trade at that level. A 100-contract order at the front fills partially and you remain exposed. Smaller orders = cleaner fills.

6. **Avoid crowded price levels**: If there are already 200 contracts at 50c, posting 1 more at 50c is nearly worthless. Either bid 51c (price improvement) or accept that you won't fill at 50c and use your capital elsewhere.

---

## 5. The "Last Look" / Stale Quote Problem

### What it is in plain terms

The "last look" problem is what happens when you can't cancel your resting order fast enough after the market moves against you. In FX markets, some venues give liquidity providers a literal "last look" -- the right to reject a fill after it matches. **Kalshi does NOT offer last look.** Once your order matches, you own that fill.

This makes the stale quote problem existential for Kalshi bots: if the market moves and your order is still resting at the old price, anyone can pick it off and you have no recourse.

The sequence:
1. Your bot posts a bid at 45c based on current market conditions
2. New information arrives (news, data release, correlated market moves)
3. The true value drops to 38c
4. Your bot detects the change and sends a cancel request
5. **In the time between steps 2 and 4, someone fills your 45c bid**
6. You now own a contract worth 38c that you paid 45c for. Immediate 7c loss.

The window between "market moves" and "your cancel is processed" is your exposure window. Every millisecond that window is open costs you money in expectation.

### Why this is worse on Kalshi than traditional markets

**API latency**: Kalshi's API adds latency that doesn't exist on co-located exchange connections. Your cancel request goes: your server -> internet -> Kalshi API -> matching engine. This can be 50-200ms depending on your server location, vs. microseconds on co-located equity exchanges.

**Event-driven markets**: Binary contracts on Kalshi are often tied to discrete events. When those events resolve, the price can jump 30-50c in an instant. In equities, a 1% move in a second is extreme. On Kalshi, a contract can go from 50c to 95c in the time it takes to send a cancel request.

**No circuit breakers**: Kalshi doesn't halt trading during rapid moves the way equity exchanges do. If an event resolves, the price goes to 0 or 100 and your stale bid at 50c is picked off without any protection.

**Rate limiting**: Kalshi's API has rate limits that can delay your cancel request. If you're sending many cancels across many markets simultaneously, you may hit rate limits and your cancel arrives late on the market that matters most.

### The latency arbitrage cycle

This is how you get systematically exploited:

1. A faster bot monitors news feeds / correlated markets / data sources
2. They detect a price-moving event before your bot does (or simultaneously, but they process + act faster)
3. They send a market order to buy your resting ask (or sell into your resting bid)
4. Their order arrives at Kalshi before your cancel does
5. They now own a position at a price favorable to them (your stale price)
6. They may immediately exit at the new market price for profit

This is called **latency arbitrage** or **stale quote sniping**. It's not illegal or unusual -- it's the fundamental dynamic of electronic markets. The protection is entirely on you to cancel faster.

### How it applies to Kalshi arb bots

**Your arb bot is particularly vulnerable**: An arb bot posts on multiple markets simultaneously. If one leg of the arb gets picked off before you can cancel, you're left with a one-legged position in a moved market.

**Phantom bot risk**: If your phantom bot is posting resting orders and the anchor moves, the phantom orders become stale. The time between the anchor moving and the phantom orders being canceled is pure exposure.

**Walk-to-bid scenarios**: When walking prices toward the bid, each step is a new resting order that can become stale. If the market moves during a walk, your intermediate orders can get picked off.

**Multi-market exposure**: If your bot scans dozens of markets, the cancel-all latency across all markets during a news event can be significant. Markets that get canceled last are most at risk.

### Practical strategies

1. **Minimize resting order lifetime**: The shorter an order sits in the book, the less time it's exposed to becoming stale. Use short TTLs and re-post frequently.

2. **Pre-compute cancel sequences**: Know which orders to cancel first in an emergency. High-exposure orders (large size, aggressive price, near-expiry contracts) should be first in the cancel queue.

3. **Host on a VPS near Kalshi's servers**: Every millisecond of network latency is exposure. If Kalshi's matching engine is in AWS us-east-1, your bot should be there too (or as close as possible).

4. **Monitor information sources directly**: Don't wait for the Kalshi order book to move to detect news. If your bot can independently monitor the same data sources that drive contract values (weather APIs, election data, economic data feeds), you can cancel BEFORE the Kalshi market moves.

5. **Reduce order count**: Fewer resting orders = fewer cancels needed = faster cancel cycle. Don't spray limit orders across 50 markets if you can't cancel them all within your latency budget.

6. **Use price guards**: Set maximum exposure per contract. If a fill arrives that puts you past your limit, immediately exit at market. Taking a small loss is better than hoping the market comes back.

7. **Implement "kill switches"**: A single API call that cancels ALL resting orders across all markets. When you detect an anomaly (sudden volume spike, large price move anywhere), fire the kill switch first, analyze later.

8. **Rate limit awareness**: Know Kalshi's rate limits and keep headroom. If your normal operation uses 80% of your rate limit, you won't have enough capacity for emergency cancels. Keep normal operation at 50-60% of limits.

9. **Stale detection on your own orders**: Track how long each order has been resting. If an order has been sitting for longer than your maximum acceptable staleness window (e.g., 30 seconds in an active market), cancel and re-evaluate before re-posting.

---

## Summary: How These Concepts Interact

These five concepts are not independent -- they form a connected system:

```
Adverse Selection
    |
    v
Toxic Flow -----> You get filled on the wrong side
    |
    v
Stale Quotes -----> You can't cancel fast enough
    |
    v
Queue Position -----> Where you sit determines WHICH fills you get
    |
    v
Binary Structure -----> Settlement at 0/100 makes every mistake existential
```

**The fundamental tension of market making on Kalshi:**
- To make money, you need to get filled (requires good queue position, tight quotes)
- But every fill is potentially adverse (could be toxic flow picking you off)
- The better your queue position, the more fills you get -- but also the more stale-quote risk you take
- The wider your spread, the more protection you have -- but the fewer fills you get

**The profitable market maker on Kalshi is the one who:**
1. Gets filled against uninformed flow (earns the spread)
2. Avoids getting filled against informed flow (doesn't get picked off)
3. Cancels fast enough that stale quotes don't become free money for snipers
4. Manages inventory so that at expiry, they're flat or on the right side
5. Sizes positions small enough that any single adverse fill is survivable

There is no strategy that eliminates adverse selection. The goal is to **make more on uninformed fills than you lose on informed fills**, and to keep the ratio of uninformed-to-informed fills as high as possible. Speed, information, and smart quoting are the levers.

---

## Sources

- [Makers and Takers: The Economics of the Kalshi Prediction Market (Whelan)](https://www.karlwhelan.com/Papers/Kalshi.pdf)
- [Market Making on Prediction Markets: Complete 2026 Guide](https://newyorkcityservers.com/blog/prediction-market-making-guide)
- [Kalshi Order Book Help Center](https://help.kalshi.com/markets/markets-101/the-orderbook)
- [Kalshi API: Get Order Queue Position](https://docs.kalshi.com/api-reference/orders/get-order-queue-position)
- [The Math of Prediction Markets: Binary Options, Kelly Criterion, and CLOB Pricing](https://navnoorbawa.substack.com/p/the-math-of-prediction-markets-binary)
- [Prediction Market Arbitrage Guide 2026](https://newyorkcityservers.com/blog/prediction-market-arbitrage-guide)
- [How Prediction Market Arbitrage Works](https://www.trevorlasn.com/blog/how-prediction-market-polymarket-kalshi-arbitrage-works)
- [Detecting Toxic Flow (arXiv)](https://arxiv.org/html/2312.05827v1)
- [Toxic Flow: Sources and Counter-Strategies (Deribit)](https://insights.deribit.com/market-research/toxic-flow-its-sources-and-counter-strategies/)
- [From PIN to VPIN: Introduction to Order Flow Toxicity](https://www.quantresearch.org/From%20PIN%20to%20VPIN.pdf)
- [VPIN and Real-Time Order Toxicity](https://electronictradinghub.com/vpin-and-real-time-order-toxicity-what-your-execution-stack-cannot-see-before-the-fill/)
- [Brokers and Informed Traders: Dealing with Toxic Flow (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4265814)
- [A Model for Queue Position Valuation in a Limit Order Book (Moallemi)](https://moallemi.com/ciamac/papers/queue-value-2016.pdf)
- [Sub-Penny and Queue-Jumping (EFMA)](https://www.efmaefm.org/0efmameetings/EFMA%20ANNUAL%20MEETINGS/2014-Rome/papers/EFMA2014_0552_fullpaper.pdf)
- [Queue Imbalance as a One-Tick-Ahead Price Predictor](https://www.worldscientific.com/doi/10.1142/S2382626616500064)
- [The Value of Queue Position in an Order Book](https://lime.co/the-value-of-queue-position-in-an-order-book/)
- [Price-Time Priority vs Speed Priority](https://axon.trade/price-time-priority-vs-speed-priority)
- [High Frequency Market Making: The Role of Speed](https://www.sciencedirect.com/science/article/abs/pii/S0304407623000581)
- [Foreign Exchange Markets with Last Look](https://link.springer.com/article/10.1007/s11579-018-0218-3)
- [The Negative Drift of a Limit Order Fill (arXiv)](https://arxiv.org/html/2407.16527v1)
- [Adverse Selection in Volatile Markets](https://www.spacetime.io/post/adverse-selection-in-volatile-markets)
- [Market Making (Princeton lecture)](https://www.princeton.edu/~markus/teaching/Eco467/05Lecture/04a_MarketMaking.pdf)
- [Limit Order Strategic Placement with Adverse Selection Risk (arXiv)](https://arxiv.org/pdf/1610.00261)
- [HFT, Price Improvement, Adverse Selection (CFA Institute)](https://blogs.cfainstitute.org/marketintegrity/2014/12/18/hft-price-improvement-adverse-selection-an-expensive-way-to-get-tighter-spreads/)
- [Sharks in the Dark: Quantifying HFT Dark Pool Latency Arbitrage](https://www.sciencedirect.com/science/article/pii/S0165188923001926)
- [Quantifying the HFT Arms Race (BIS Working Papers)](https://www.bis.org/publ/work955.pdf)
- [Systematic Edges in Prediction Markets (QuantPedia)](https://quantpedia.com/systematic-edges-in-prediction-markets/)
