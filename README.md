# Meridian — Sports Trading Terminal

A full-stack sports event trading terminal built on the [Kalshi](https://kalshi.com) exchange. Trade NBA, NFL, NHL, MLB, and NCAAB markets with automated bot management, live scores, arbitrage scanning, and middle-spread detection.

---

## Architecture

```
frontend/
  index_new.html   — Single-page UI (dark theme, inline styles)
  app_new.js       — Vanilla JS client (~1,900 lines)

backend/
  app.py           — Flask REST API (port 5001)
  kalshi_api.py    — Kalshi v2 API client (RSA-PSS auth)
  requirements.txt — Python dependencies
```

## Features

| Feature | Description |
|---------|-------------|
| **Market Browser** | Browse all sports markets grouped by series, with sport filter pills and live-event filtering |
| **Bot System** | Create bots with custom entry prices, stop-loss, timeout, and repost logic. Bots auto-monitor and cancel/repost limit orders in real time |
| **Arb Scanner** | One-click scan for arbitrage opportunities where YES + NO ask < 100¢ |
| **Middle Spread Scanner** | Find markets where the bid/ask spread allows a middle entry |
| **Live Scores** | Real-time ESPN scores for NBA, NFL, NHL, MLB, NCAAB with auto-refresh |
| **Trade History** | In-app log of every bot action (fill, repost, stop-loss trigger, timeout) |
| **P&L Dashboard** | Live balance, total invested, and unrealized P&L from open positions |
| **Bot Buddy** | Animated assistant widget showing active bot count and quick status |

## Supported Series

- **NBA**: Game (ML), Spread, Total
- **NFL**: Game (ML), Spread, Total
- **NHL**: Game (ML), Spread, Total
- **MLB**: Game (ML), Spread, Total
- **NCAAB**: Game (ML), Spread, Total

## Quick Start

### Prerequisites
- Python 3.10+
- Kalshi account with API access (RSA key pair)

### Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The server starts on **http://localhost:5001**. Open the browser and navigate to the frontend served by Flask.

### API Credentials

On first load, the app auto-logs in using the API key and private key configured in `app.py`. Update the `auto_login()` function with your own credentials.

## Bot Lifecycle

1. **Place** — Bot submits a limit order at your chosen price
2. **Monitor** — Auto-monitor polls every 3 seconds for fills, reposts, and stop-loss triggers
3. **Fill** — When your order fills, the bot places the opposing exit order
4. **Repost** — If the exit order isn't filled within the repost window, it cancels and re-places at current best price
5. **Stop-Loss** — If price moves against you past your stop-loss threshold, the bot market-sells your position
6. **Timeout** — If the entry order doesn't fill within the timeout window, the bot cancels it

### Important Notes

- **Canceling a bot cancels the real Kalshi orders.** The cancel function calls the Kalshi API to cancel any resting limit orders associated with that bot.
- **All trades appear on your Kalshi account.** This app uses the official Kalshi API — every order, fill, and position shows up in your Kalshi account history and portfolio.
- **Auto-monitor starts automatically** when you place a bet via Quick Bot, Create Bot, or Place Middle. You only need to manually stop it when you're done.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | Fetch all sports markets by series |
| POST | `/api/bot/create` | Create a new trading bot |
| POST | `/api/bot/monitor` | Run one monitor cycle for all active bots |
| POST | `/api/bot/cancel/<id>` | Cancel a bot and its Kalshi orders |
| GET | `/api/bot/list` | List all active bots with live bid/ask |
| GET | `/api/bot/history` | Get trade history log |
| POST | `/api/order/single` | Place a single limit order (no bot) |
| GET | `/api/scan/middles` | Scan for middle-spread opportunities |
| POST | `/api/bot/scan` | Scan for arbitrage opportunities |
| GET | `/api/pnl` | Get P&L summary |
| GET | `/api/fills` | Get recent fills from Kalshi |
| GET | `/api/scoreboard/<sport>` | Get live scores for a sport |

## Tech Stack

- **Backend**: Flask 3.0, Python 3.10+
- **Frontend**: Vanilla JavaScript, HTML5 (no framework)
- **Auth**: RSA-PSS signatures (cryptography library)
- **Exchange**: Kalshi Production API v2
- **Scores**: ESPN API (unofficial)

## License

Private — not for redistribution.
