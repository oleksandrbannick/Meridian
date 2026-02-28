# Kalshi Arbitrage Screener & Trading Bot

A powerful web-based trading application for Kalshi that helps you find arbitrage opportunities and automatically execute profitable trades with stop-loss protection.

## 🚀 Features

### Core Features
- **🔐 Secure Authentication**: RSA signature-based authentication with Kalshi API
- **📊 Real-time Market Display**: View all markets with a Kalshi-like interface
- **💰 Balance & Portfolio Tracking**: Monitor your balance and positions in real-time
- **🔍 Market Search & Filtering**: Find markets by status, name, or ticker
- **📈 Detailed Market View**: See orderbook, prices, and volume for any market

### Arbitrage Trading
- **⚡ Automatic Arb Detection**: Finds guaranteed profit opportunities where YES + NO < 100¢
- **🎯 One-Click Arb Execution**: Buy YES at one price and NO at another for guaranteed profit
- **🛡️ Stop-Loss Protection**: Automatically sells if one leg fills and price drops
- **📱 Position Monitoring**: Track all active arbitrage positions
- **🔄 Auto-Monitoring**: Checks positions every 30 seconds for stop-loss triggers

### Player Props Support
- **🏀 NO Side Access**: Full access to NO side for player props via API (not available on website)
- **📊 Complete Orderbook**: See both YES and NO orderbooks for all markets

## 📦 Installation

### Prerequisites
- Python 3.8 or higher
- Kalshi API credentials (API Key ID and Private Key)

### Setup Steps

1. **Clone or navigate to the project directory:**
```bash
cd "/Applications/Programs/kalshi screener"
```

2. **Install Python dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

3. **Get your Kalshi API credentials:**
   - Go to [Kalshi Account Settings](https://kalshi.com/account/profile)
   - Create a new API key
   - **IMPORTANT**: Save your private key immediately - you can't retrieve it later!
   - Copy both the Key ID and the private key (starts with `-----BEGIN RSA PRIVATE KEY-----`)

## 🎮 Usage

### Starting the Server

1. **Start the Flask backend:**
```bash
cd backend
python app.py
```

The server will start on `http://localhost:5000`

2. **Open your browser and go to:**
```
http://localhost:5000
```

### Login

1. Click the **"Login"** button in the top right
2. Paste your API Key ID
3. Paste your Private Key (entire PEM format including BEGIN/END lines)
4. Check **"Use Demo Environment"** if testing (recommended)
5. Click **"Connect"**

### Finding Arbitrage Opportunities

1. **Automatic Detection:**
   - Markets with arbitrage opportunities show a green badge: `⚡ Arb: 5.0¢`
   - Click **"Find Arb Opportunities"** to filter only arbitrage markets
   - Adjust minimum profit threshold in the sidebar

2. **Manual Trading:**
   - Click any market card to open details
   - Click **"Create Arbitrage Trade"**
   - Set your YES and NO buy prices
   - Set quantity
   - Review profit calculation
   - Click **"Execute Arbitrage"**

### How Arbitrage Works

**Example:**
- Market: "Will it rain tomorrow?"
- Buy YES at 60¢
- Buy NO at 35¢
- **Total cost: 95¢**
- **Guaranteed payout: $1.00 (100¢)**
- **Profit: 5¢ per contract** 🎉

No matter the outcome:
- If YES wins: You make 100¢ - 60¢ = 40¢ on YES, lose 35¢ on NO = **+5¢ profit**
- If NO wins: You make 100¢ - 35¢ = 65¢ on NO, lose 60¢ on YES = **+5¢ profit**

### Stop-Loss Protection

The bot monitors your arbitrage positions automatically:

1. If **YES leg fills** but NO doesn't:
   - Monitors YES price
   - If price drops > 5% (configurable), **automatically sells YES**
   - Cancels the unfilled NO order
   - Prevents losses if market moves against you

2. If **NO leg fills** but YES doesn't:
   - Same logic applies for NO side

3. If **both legs fill**:
   - Congratulations! Your arbitrage is complete
   - Position removed from monitoring
   - Profit is guaranteed

**Manual Monitoring:**
- Click **"Monitor & Stop Loss"** button to check positions immediately
- Auto-monitor runs every 30 seconds when logged in

### Features Walkthrough

#### Markets View
- **Grid View**: Card-based display (default)
- **List View**: Compact list display
- **Status Filter**: Open / Closed / Settled markets
- **Search**: Search by ticker, title, or market name

#### Market Details
- Click any market card to view:
  - Full market title and description
  - Current YES/NO bid/ask prices
  - Market status, volume, and open interest
  - Create arbitrage trade button

#### Position Tracking
- **Active Positions**: Shows your current open positions
- **Active Arb Trades**: Tracks your arbitrage orders with:
  - Market ticker
  - YES and NO prices
  - Expected profit
  - Quantity

## ⚙️ Configuration

### Arbitrage Settings (Sidebar)
- **Min Profit**: Minimum profit in cents to consider an arb opportunity (default: 5¢)
- **Stop Loss**: Percentage price drop before triggering stop-loss (default: 5%)

### API Configuration (in code)
Edit `backend/kalshi_api.py` to change:
- **Demo vs Production**: Set `demo=True` for testing, `demo=False` for live trading
- **Base URLs**: Automatically switches between demo and production

## 🔒 Security & Privacy

- **Private keys are never saved**: Your private key is used only for the session
- **Local processing**: All authentication happens on your computer
- **Secure transmission**: Uses HTTPS to communicate with Kalshi API
- **No data collection**: This app doesn't store or transmit your data anywhere else

## 📝 API Rate Limits

Kalshi has rate limits:
- **Standard tier**: Limited requests per second
- **Monitor responsibly**: Don't abuse the monitoring feature
- The app auto-monitors every 30 seconds (reasonable for most use cases)

## 🐛 Troubleshooting

### "Authentication failed"
- Make sure you copied the ENTIRE private key including `-----BEGIN/END-----` lines
- Verify your API Key ID is correct
- Check if you're using the right environment (demo vs production)

### "No arbitrage opportunities found"
- Arbitrage opportunities are rare and competitive
- Lower your minimum profit threshold
- Check during high-volume times
- Remember: efficient markets mean fewer arb opportunities

### "Order failed"
- Verify you have sufficient balance
- Check if market is still open
- Prices may have moved - refresh and try again
- Rate limit may have been hit - wait a few seconds

### Server won't start
- Make sure port 5000 is not in use
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Check Python version: `python --version` (need 3.8+)

## 🛠️ Technical Details

### Architecture
- **Backend**: Flask (Python) - Handles API authentication and trading logic
- **Frontend**: Vanilla JavaScript, HTML, CSS - Provides the user interface
- **API Client**: Custom Kalshi API client with RSA-PSS signature authentication

### File Structure
```
kalshi screener/
├── backend/
│   ├── app.py              # Flask server and API endpoints
│   ├── kalshi_api.py       # Kalshi API client
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # Main HTML interface
│   ├── styles.css          # Styling
│   └── app.js              # Frontend logic
└── README.md               # This file
```

### API Endpoints

**Backend Endpoints:**
- `POST /api/login` - Authenticate with Kalshi
- `GET /api/markets` - Get all markets
- `GET /api/market/<ticker>` - Get specific market
- `GET /api/orderbook/<ticker>` - Get market orderbook
- `GET /api/balance` - Get account balance
- `GET /api/positions` - Get positions
- `GET /api/orders` - Get orders
- `POST /api/arb/create` - Create arbitrage trade
- `GET /api/arb/positions` - Get arbitrage positions
- `POST /api/arb/monitor` - Monitor and execute stop-loss

## 📚 Resources

- [Kalshi API Documentation](https://docs.kalshi.com/)
- [Kalshi Trading Platform](https://kalshi.com/)
- [Generate API Keys](https://kalshi.com/account/profile)
- [Kalshi Discord](https://discord.gg/kalshi) - #dev and #support channels

## ⚠️ Disclaimer

**IMPORTANT:**
- This software is for educational and personal use only
- Trading involves risk - you can lose money
- Test with demo account before using real money
- Not financial advice - trade at your own risk
- The authors are not responsible for any financial losses
- Always understand the markets you're trading
- Arbitrage opportunities may not exist or may be short-lived
- Market conditions can change rapidly

## 🤝 Support

Having issues? Here's how to get help:

1. **Check this README** - Most common questions are answered here
2. **Review the Troubleshooting section** - Common issues and solutions
3. **Check the Kalshi Discord** - #dev and #support channels
4. **Read the Kalshi API docs** - [docs.kalshi.com](https://docs.kalshi.com/)

## 📈 Future Enhancements

Potential features for future versions:
- [ ] Multi-market arbitrage across correlated events
- [ ] Historical performance tracking
- [ ] Advanced order types (FOK, IOC)
- [ ] Webhook notifications for arb opportunities
- [ ] Mobile-responsive design improvements
- [ ] Export trade history to CSV
- [ ] Advanced filtering (by category, tags, etc.)
- [ ] Real-time WebSocket price updates
- [ ] Profit/loss charts and analytics

## 📄 License

MIT License - Feel free to use, modify, and distribute as needed.

---

**Happy Trading! 🎉**

Remember: The best arbitrage opportunity is the one you can execute quickly and reliably. Start small, test thoroughly, and always monitor your positions!
