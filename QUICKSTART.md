# Quick Start Guide

## 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

## 2. Get API Credentials
1. Go to https://kalshi.com/account/profile
2. Click "Create New API Key"
3. Save the Private Key (you won't see it again!)
4. Copy the Key ID

## 3. Start the Server
```bash
cd backend
python app.py
```

## 4. Open Browser
Open: http://localhost:5000

## 5. Login
- Click "Login" button
- Paste API Key ID
- Paste Private Key (entire PEM format)
- Check "Use Demo Environment"
- Click "Connect"

## 6. Start Trading!
- Browse markets
- Click "Find Arb Opportunities"
- Click a market with arb badge
- Click "Create Arbitrage Trade"
- Execute!

## Example Arbitrage
If you see:
- YES Ask: 60¢
- NO Ask: 35¢
- Total: 95¢ < 100¢
- **Guaranteed 5¢ profit!**

## Stop-Loss Protection
The bot automatically monitors your positions:
- If one leg fills and price drops > 5%
- Bot sells to prevent losses
- Runs every 30 seconds automatically

## Need Help?
Check README.md for full documentation!
