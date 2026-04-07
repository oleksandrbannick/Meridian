# Apex bot pricing logic - maker orders and volatility
**Category:** trading_lesson | **Saved:** 2026-03-20 16:58

Apex bots are NOT about catching instant arb (YES+NO under 100c is rare). The strategy is to post MAKER orders on both sides and wait for game volatility to push one side through. Bid+1 is only used when there's a gap between bid and ask (so you sit in the spread as a maker). In a tight market (e.g. 51/50), you post AT the bid — going above the bid hits the ask and makes you a taker, not a maker. Coin-toss 50/50 live markets are IDEAL Apex targets because game swings will move the price through your resting order. The system should surface these as prime Apex opportunities, not ignore them.
