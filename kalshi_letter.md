Subject: API Rate Limit Increase Request — Meridian Trading System

Hi Kalshi API Team,

My name is Oleksandr Bannick, and I'm writing to request an increase to my API rate limits. I operate Meridian, an automated market-making system that provides resting liquidity on Kalshi's sports event markets.

## What Meridian Does

Meridian is a trading terminal I built and operate full-time. It runs market-making strategies on live sports markets — primarily tennis, NBA, NHL, MLB, and MLS moneyline contracts. The system posts resting limit orders on the less liquid side of binary markets (the "dog" side) and hedges on the opposite side when filled, capturing the bid-ask spread.

All orders are placed as maker/limit orders. Meridian adds liquidity to markets that are often thin on one side, helping tighten spreads for other participants. The system uses a single process with built-in rate limiting to stay well within current API thresholds.

## Technical Setup

- **Colocated server**: Dedicated VPS in Chicago, running 24/7 via systemd
- **Execution speed**: Average order placement latency of 24ms, p95 under 40ms
- **Rate discipline**: Built-in rate limiter (currently respecting 10 writes/s, 20 reads/s) with queuing — no burst spamming
- **WebSocket integration**: Real-time fills and orderbook data via Kalshi's WS feed, reducing unnecessary REST polling
- **Clean execution**: Automated orphan detection, position verification, and settlement handling to ensure no stale orders or untracked positions

## How This Benefits Kalshi

- **Liquidity on thin markets**: Meridian posts resting orders on the dog side of sports moneylines — often the least liquid side. This tightens spreads and improves the trading experience for all participants.
- **Consistent activity**: The system operates across multiple concurrent markets and sports, generating steady order flow throughout live events.
- **Responsible API usage**: I've invested significant engineering effort into minimizing API calls — WebSocket for real-time data, batched operations where possible, and strict rate limiting built into every code path.

## The Request

I'm requesting an increase to my API rate limits — specifically:

- **Reads**: 40/second (up from 20) — faster orderbook snapshots allow better pricing decisions and reduce stale quotes
- **Writes**: 20/second (up from 10) — enables more responsive order management across multiple concurrent markets, especially during high-activity periods with several live games

Higher limits would allow Meridian to operate on more markets simultaneously while maintaining the same disciplined, non-spamming approach. The additional capacity translates directly to more resting liquidity on your platform.

## About Me

I'm the sole creator, developer, and operator of Meridian. This is my full-time focus. I've been actively trading on Kalshi and continuously improving the system's execution quality, risk management, and market coverage. I'm committed to operating responsibly and being a positive participant in the Kalshi ecosystem.

Happy to discuss further, provide additional technical details, or hop on a call if that would be helpful.

Best regards,
Oleksandr Bannick
