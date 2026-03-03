"""
Kalshi Arbitrage Bot Backend
Flask server providing API endpoints for the trading bot
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from kalshi_api import KalshiAPI
import os
import json
import requests
from typing import Dict, List, Optional
import time
import threading

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Global variables
kalshi_client: Optional[KalshiAPI] = None
active_arb_orders: Dict = {}  # Track active arbitrage positions
stop_loss_percentage = 0.05  # 5% stop loss default


@app.route('/')
def index():
    """Serve the frontend"""
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory(app.static_folder, path)


@app.route('/api/login', methods=['POST'])
def login():
    """Initialize Kalshi API client with credentials"""
    global kalshi_client
    
    try:
        data = request.json
        api_key_id = data.get('api_key_id')
        private_key = data.get('private_key')
        demo = data.get('demo', True)
        
        if not api_key_id or not private_key:
            return jsonify({'error': 'Missing credentials'}), 400
        
        # Save private key temporarily
        key_path = '/tmp/kalshi_private_key.pem'
        with open(key_path, 'w') as f:
            f.write(private_key)
        
        # Initialize client
        kalshi_client = KalshiAPI(api_key_id, key_path, demo=demo)
        
        # Test connection by getting balance
        balance = kalshi_client.get_balance()
        
        # Clean up
        os.remove(key_path)
        
        return jsonify({
            'success': True,
            'balance': balance.get('balance', 0) / 100,  # Convert cents to dollars
            'portfolio_value': balance.get('portfolio_value', 0) / 100
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/markets', methods=['GET'])
def get_markets():
    """Get sports markets by querying Kalshi series tickers directly"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated. Please login first.'}), 401
            
        status = request.args.get('status', 'open')
        limit = int(request.args.get('limit', 2000))
        sport_filter = request.args.get('sport')  # Optional: 'nba', 'nhl', 'epl', etc.
        
        # ALL sports series tickers in Kalshi
        SPORTS_SERIES = {
            'nba': ['KXNBAGAME', 'KXNBASPREAD', 'KXNBATOTAL', 'KXNBAPOINTS', 
                     'KXNBAREBOUNDS', 'KXNBAASSISTS', 'KXNBA3PM', 'KXNBASTEALS', 
                     'KXNBABLOCKS', 'KXNBAANNOUNCER'],
            'nfl': ['KXNFLGAME', 'KXNFLSPREAD', 'KXNFLTOTAL'],
            'nhl': ['KXNHLGAME', 'KXNHLSPREAD', 'KXNHLTOTAL', 'KXNHLGOAL'],
            'mlb': ['KXMLBGAME', 'KXMLBSPREAD', 'KXMLBTOTAL'],
            'ncaab': ['KXNCAABGAME', 'KXNCAABSPREAD', 'KXNCAABTOTAL'],
            'ncaaf': ['KXNCAAFGAME', 'KXNCAAFSPREAD', 'KXNCAAFTOTAL'],
            'epl': ['KXEPLGAME', 'KXEPLGOAL', 'KXEPLBTTS'],
            'ucl': ['KXUCLGAME', 'KXUCLGOAL', 'KXUCLBTTS'],
        }
        
        # Determine which series to fetch
        if sport_filter and sport_filter.lower() != 'all':
            series_to_fetch = SPORTS_SERIES.get(sport_filter.lower(), [])
        else:
            series_to_fetch = []
            for sport_series in SPORTS_SERIES.values():
                series_to_fetch.extend(sport_series)
        
        # Fetch markets from each series
        all_markets = []
        series_counts = {}
        
        for series in series_to_fetch:
            try:
                result = kalshi_client.get_markets_by_series(series, status=status, limit=200)
                markets = result.get('markets', [])
                if markets:
                    markets = [m for m in markets if 'mve_selected_legs' not in m 
                             and 'KXMVECROSSCATEGORY' not in m.get('ticker', '')]
                    if markets:
                        series_counts[series] = len(markets)
                        all_markets.extend(markets)
            except Exception as e:
                continue
        
        print(f"✅ Sports markets: {len(all_markets)} total from {len(series_counts)} active series")
        for s, c in sorted(series_counts.items(), key=lambda x: -x[1]):
            print(f"  {s}: {c} markets")
        
        # Deduplicate by ticker
        seen = set()
        unique_markets = []
        for m in all_markets:
            ticker = m.get('ticker', '')
            if ticker not in seen:
                seen.add(ticker)
                unique_markets.append(m)
        
        # Sort by event_ticker for grouping
        unique_markets.sort(key=lambda m: m.get('event_ticker', ''))
        unique_markets = unique_markets[:limit]
        
        return jsonify({'markets': unique_markets, 'cursor': None})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/market/<ticker>', methods=['GET'])
def get_market(ticker):
    """Get specific market details"""
    try:
        if not kalshi_client:
            temp_client = KalshiAPI('', '', demo=True)
            market = temp_client.get_market(ticker)
        else:
            market = kalshi_client.get_market(ticker)
        
        return jsonify(market)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/orderbook/<ticker>', methods=['GET'])
def get_orderbook(ticker):
    """Get orderbook for a market"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        orderbook = kalshi_client.get_market_orderbook(ticker)
        return jsonify(orderbook)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/balance', methods=['GET'])
def get_balance():
    """Get account balance"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        balance = kalshi_client.get_balance()
        return jsonify({
            'balance': balance.get('balance', 0) / 100,
            'portfolio_value': balance.get('portfolio_value', 0) / 100
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/positions', methods=['GET'])
def get_positions():
    """Get current positions"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        positions = kalshi_client.get_positions()
        return jsonify(positions)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Get orders"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        status = request.args.get('status')
        ticker = request.args.get('ticker')
        
        orders = kalshi_client.get_orders(status=status, ticker=ticker)
        return jsonify(orders)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/arb/create', methods=['POST'])
def create_arb_trade():
    """
    Create an arbitrage trade
    Buys YES at one price and NO at another for guaranteed profit
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.json
        ticker = data.get('ticker')
        yes_price = data.get('yes_price')  # Price in cents (e.g., 60)
        no_price = data.get('no_price')    # Price in cents (e.g., 35)
        count = data.get('count', 1)
        
        if not ticker or yes_price is None or no_price is None:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Validate arbitrage opportunity
        total_cost = yes_price + no_price
        if total_cost >= 100:
            return jsonify({'error': 'No arbitrage opportunity - total cost >= 100 cents'}), 400
        
        profit_per_contract = 100 - total_cost
        total_profit = profit_per_contract * count
        
        # Place both orders
        yes_order = kalshi_client.create_order(
            ticker=ticker,
            side='yes',
            action='buy',
            count=count,
            yes_price=yes_price
        )
        
        no_order = kalshi_client.create_order(
            ticker=ticker,
            side='no',
            action='buy',
            count=count,
            no_price=no_price
        )
        
        # Track this arbitrage position
        arb_id = f"{ticker}_{int(time.time())}"
        active_arb_orders[arb_id] = {
            'ticker': ticker,
            'yes_order': yes_order,
            'no_order': no_order,
            'yes_price': yes_price,
            'no_price': no_price,
            'count': count,
            'profit_per_contract': profit_per_contract,
            'total_profit': total_profit,
            'created_at': time.time()
        }
        
        return jsonify({
            'success': True,
            'arb_id': arb_id,
            'yes_order': yes_order,
            'no_order': no_order,
            'profit_per_contract': profit_per_contract,
            'total_profit': total_profit
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/arb/positions', methods=['GET'])
def get_arb_positions():
    """Get active arbitrage positions"""
    return jsonify({
        'positions': list(active_arb_orders.values())
    })


@app.route('/api/arb/monitor', methods=['POST'])
def monitor_arb_positions():
    """
    Monitor arbitrage positions and execute stop-loss if needed
    Checks if one leg filled and price is dropping
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.json
        stop_loss_pct = data.get('stop_loss_percentage', 0.05)
        
        actions_taken = []
        
        for arb_id, position in list(active_arb_orders.items()):
            ticker = position['ticker']
            yes_order = position['yes_order']
            no_order = position['no_order']
            
            # Get current order status
            try:
                yes_status = kalshi_client._make_request('GET', 
                    f'/portfolio/orders/{yes_order["order"]["order_id"]}', authenticated=True)
                no_status = kalshi_client._make_request('GET', 
                    f'/portfolio/orders/{no_order["order"]["order_id"]}', authenticated=True)
                
                yes_filled = yes_status['order']['fill_count'] if yes_status else 0
                no_filled = no_status['order']['fill_count'] if no_status else 0
                
                # Get current market price
                market = kalshi_client.get_market(ticker)
                current_yes_price = market['market']['yes_bid']
                current_no_price = market['market']['no_bid']
                
                # Check if one leg filled and price is unfavorable
                if yes_filled > 0 and no_filled == 0:
                    # YES filled, check if YES price dropped
                    price_drop = (position['yes_price'] - current_yes_price) / position['yes_price']
                    if price_drop > stop_loss_pct:
                        # Sell YES position to cut losses
                        sell_order = kalshi_client.create_order(
                            ticker=ticker,
                            side='yes',
                            action='sell',
                            count=yes_filled,
                            yes_price=current_yes_price - 1  # Market order-ish
                        )
                        actions_taken.append({
                            'arb_id': arb_id,
                            'action': 'stop_loss_yes',
                            'reason': f'YES price dropped {price_drop*100:.1f}%',
                            'sell_order': sell_order
                        })
                        # Cancel NO order
                        kalshi_client.cancel_order(no_order['order']['order_id'])
                        del active_arb_orders[arb_id]
                
                elif no_filled > 0 and yes_filled == 0:
                    # NO filled, check if NO price dropped
                    price_drop = (position['no_price'] - current_no_price) / position['no_price']
                    if price_drop > stop_loss_pct:
                        # Sell NO position to cut losses
                        sell_order = kalshi_client.create_order(
                            ticker=ticker,
                            side='no',
                            action='sell',
                            count=no_filled,
                            no_price=current_no_price - 1
                        )
                        actions_taken.append({
                            'arb_id': arb_id,
                            'action': 'stop_loss_no',
                            'reason': f'NO price dropped {price_drop*100:.1f}%',
                            'sell_order': sell_order
                        })
                        # Cancel YES order
                        kalshi_client.cancel_order(yes_order['order']['order_id'])
                        del active_arb_orders[arb_id]
                
                elif yes_filled > 0 and no_filled > 0:
                    # Both filled - arbitrage complete!
                    actions_taken.append({
                        'arb_id': arb_id,
                        'action': 'completed',
                        'profit': position['total_profit']
                    })
                    del active_arb_orders[arb_id]
            
            except Exception as e:
                print(f"Error monitoring position {arb_id}: {e}")
                continue
        
        return jsonify({
            'success': True,
            'actions_taken': actions_taken,
            'active_positions': len(active_arb_orders)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/scoreboard/<sport>', methods=['GET'])
def get_scoreboard(sport):
    """Proxy ESPN public scoreboard API to avoid CORS issues"""
    sport_map = {
        'nba': 'basketball/nba',
        'nfl': 'football/nfl',
        'mlb': 'baseball/mlb',
        'nhl': 'hockey/nhl',
        'ncaab': 'basketball/mens-college-basketball',
        'ncaaf': 'football/college-football',
    }
    sport_path = sport_map.get(sport.lower())
    if not sport_path:
        return jsonify({'error': f'Unknown sport: {sport}'}), 400

    try:
        url = f'https://site.api.espn.com/apis/site/v2/sports/{sport_path}/scoreboard'
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/fills', methods=['GET'])
def get_fills():
    """Get recent fills/trades"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        ticker = request.args.get('ticker')
        fills = kalshi_client.get_fills(ticker=ticker)
        return jsonify(fills)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Dual Arb Bot System ──────────────────────────────────────────────────────
# Strategy: place LIMIT BUY orders on both YES and NO sides simultaneously.
# Both orders sit in the order book as bids (market maker = no taker fees).
# As price volatility causes each side to fill, profit is locked in on settlement.
# Stop loss: if one side fills and the other side's bid drops X cents, market-sell
# the filled side to exit (market order guarantees execution despite taker fees).

active_bots = {}  # bot_id -> bot_config
trade_history = []  # completed/stopped bots log (newest first)

# ─── State Persistence ────────────────────────────────────────────────────────
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.json')

def save_state():
    """Persist active_bots and trade_history to disk so they survive restarts."""
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump({
                'active_bots': active_bots,
                'trade_history': trade_history[:200],
                'session_pnl': session_pnl,
            }, f, indent=2, default=str)
    except Exception as e:
        print(f'⚠ save_state: {e}')

def load_state():
    """Load persisted bots and history from disk."""
    global active_bots, trade_history, session_pnl
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                data = json.load(f)
            active_bots = data.get('active_bots', {})
            trade_history = data.get('trade_history', [])
            saved = data.get('session_pnl')
            if saved:
                for k in ('gross_profit_cents','gross_loss_cents','completed_bots','stopped_bots'):
                    if k in saved:
                        session_pnl[k] = saved[k]
            print(f'✅ Loaded: {len(active_bots)} bots, {len(trade_history)} history')
    except Exception as e:
        print(f'⚠ load_state: {e}')

# ─── Rate Limiter (Upgrade #7: API rate limit guard) ──────────────────────────
class RateLimiter:
    """Token bucket — keeps us under Kalshi's ~10 req/sec API limit."""
    def __init__(self, rate: float = 8.0, per: float = 1.0):
        self.rate, self.per = rate, per
        self._tokens = float(rate)
        self._last = time.time()
        self._lock = threading.Lock()

    def wait(self):
        with self._lock:
            now = time.time()
            self._tokens = min(self.rate, self._tokens + (now - self._last) * (self.rate / self.per))
            self._last = now
            if self._tokens < 1.0:
                time.sleep((1.0 - self._tokens) * (self.per / self.rate))
                self._tokens = 0.0
            else:
                self._tokens -= 1.0

api_rate_limiter = RateLimiter(rate=8.0)   # 8 calls/sec

# ─── Session P&L (Upgrade #6: P&L dashboard) ──────────────────────────────────
import datetime

session_pnl = {
    'gross_profit_cents': 0,
    'gross_loss_cents':   0,
    'completed_bots':     0,
    'stopped_bots':       0,
    'session_start':      time.time(),
    'day_key':            datetime.date.today().isoformat(),  # for daily auto-reset
}

def auto_reset_daily_pnl():
    """Reset P&L counters if the day has changed since last check."""
    global session_pnl
    today = datetime.date.today().isoformat()
    if session_pnl.get('day_key') != today:
        print(f'📅 New day detected ({session_pnl.get("day_key")} → {today}) — resetting daily P&L')
        session_pnl = {
            'gross_profit_cents': 0,
            'gross_loss_cents':   0,
            'completed_bots':     0,
            'stopped_bots':       0,
            'session_start':      time.time(),
            'day_key':            today,
        }
        save_state()

# ─── Bot Config (Upgrades #4, #8) ─────────────────────────────────────────────
REPOST_AFTER_MINUTES = 5    # Re-post orders that haven't filled after this long
STALE_CANCEL_MINUTES = 10   # Resize to matched fills after this long


# ─── Single Order Endpoint ─────────────────────────────────────────────────────
@app.route('/api/order/single', methods=['POST'])
def place_single_order():
    """
    Place a single limit order (one side only).
    Used for middle spreads where you need YES on one market, NO on a different market.
    Does NOT create a dual-arb bot — just places the order and returns the order ID.
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json
        ticker = data.get('ticker')
        side   = data.get('side')        # 'yes' or 'no'
        price  = int(data.get('price'))   # price in cents
        qty    = int(data.get('quantity', 1))

        if not ticker or not side or not price:
            return jsonify({'error': 'Missing required fields: ticker, side, price'}), 400

        if side not in ('yes', 'no'):
            return jsonify({'error': f"Invalid side '{side}' — must be 'yes' or 'no'"}), 400

        if price < 1 or price > 99:
            return jsonify({'error': f'Price {price}¢ out of range (1-99)'}), 400

        price_kwargs = {'yes_price': price} if side == 'yes' else {'no_price': price}
        order = kalshi_client.create_order(
            ticker=ticker, side=side, action='buy',
            count=qty, **price_kwargs
        )

        return jsonify({
            'success':  True,
            'order_id': order['order']['order_id'],
            'ticker':   ticker,
            'side':     side,
            'price':    price,
            'quantity': qty,
            'message':  f'Placed {side.upper()} limit buy on {ticker} at {price}¢ × {qty}'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/bot/create', methods=['POST'])
def create_bot():
    """
    Dual Arb Bot: immediately places LIMIT BUY orders on both YES and NO sides.
    Both are market-maker orders (resting in the book) — no taker fees on entry.
    Profit = 100 - yes_price - no_price cents per contract, locked at settlement.

    game_phase: 'pregame' or 'live' — controls timeout behavior.
      - pregame: patient, orders sit until game starts. No repost, no time-based stop loss.
      - live: aggressive, repost / stop-loss after timeout windows.
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json
        ticker         = data.get('ticker')
        yes_price      = int(data.get('yes_price'))   # limit buy price for YES, in cents
        no_price       = int(data.get('no_price'))    # limit buy price for NO, in cents
        quantity       = int(data.get('quantity', 1))
        stop_loss_cents = int(data.get('stop_loss_cents', 5))  # ¢ drop to trigger stop loss
        game_phase     = data.get('game_phase', 'pregame')     # 'pregame' | 'live'
        repeat_count   = int(data.get('repeat_count', 0))      # 0 = no repeat, N = repeat N more times
        arb_width      = int(data.get('arb_width', 0))         # remember target width for repeat

        if not ticker or yes_price is None or no_price is None:
            return jsonify({'error': 'Missing required fields: ticker, yes_price, no_price'}), 400

        profit_per = 100 - yes_price - no_price
        if profit_per <= 0:
            return jsonify({'error': f'Not an arb: yes({yes_price}¢) + no({no_price}¢) = {yes_price+no_price}¢ ≥ 100¢'}), 400

        # Place both limit orders immediately (market-maker = resting bids)
        yes_order = kalshi_client.create_order(
            ticker=ticker, side='yes', action='buy',
            count=quantity, yes_price=yes_price
        )
        no_order = kalshi_client.create_order(
            ticker=ticker, side='no', action='buy',
            count=quantity, no_price=no_price
        )

        bot_id = f"{ticker}_{int(time.time())}"
        active_bots[bot_id] = {
            'ticker':           ticker,
            'yes_price':        yes_price,
            'no_price':         no_price,
            'quantity':         quantity,
            'stop_loss_cents':  stop_loss_cents,
            'profit_per':       profit_per,
            'game_phase':       game_phase,
            'status':           'pending_fills',  # pending_fills | yes_filled | no_filled | completed | stopped
            'yes_order_id':     yes_order['order']['order_id'],
            'no_order_id':      no_order['order']['order_id'],
            'yes_fill_qty':     0,
            'no_fill_qty':      0,
            'created_at':       time.time(),
            'posted_at':        time.time(),
            'repost_count':     0,
            'repeat_count':     repeat_count,
            'repeats_done':     0,
            'arb_width':        arb_width if arb_width > 0 else profit_per,
        }
        save_state()

        return jsonify({
            'success':      True,
            'bot_id':       bot_id,
            'yes_order_id': yes_order['order']['order_id'],
            'no_order_id':  no_order['order']['order_id'],
            'profit_per':   profit_per,
            'game_phase':   game_phase,
            'repeat_count': repeat_count,
            'message':      f'[{game_phase.upper()}] Limit orders placed — YES at {yes_price}¢, NO at {no_price}¢ → {profit_per}¢ profit/contract'
                            + (f' (repeat {repeat_count}x)' if repeat_count > 0 else '')
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def verify_position_cleared(ticker, side, expected_gone):
    """
    Check the Kalshi positions API to confirm we no longer hold contracts.
    Returns (is_cleared: bool, remaining: int)
    """
    try:
        api_rate_limiter.wait()
        pos_resp = kalshi_client.get_positions(ticker=ticker)
        positions = pos_resp.get('market_positions', pos_resp.get('positions', []))
        for p in positions:
            if p.get('ticker') == ticker:
                qty = p.get('position', 0)
                # positive = YES, negative = NO
                if side == 'yes' and qty > 0:
                    print(f'⚠ verify_position: still holding {qty} YES on {ticker}')
                    return False, qty
                elif side == 'no' and qty < 0:
                    print(f'⚠ verify_position: still holding {abs(qty)} NO on {ticker}')
                    return False, abs(qty)
        print(f'✅ verify_position: {side} position on {ticker} confirmed CLEARED')
        return True, 0
    except Exception as e:
        print(f'⚠ verify_position error: {e} — treating as unverified')
        return False, -1


def get_actual_fill_price(order_id, side='yes'):
    """
    Get the actual average fill price from Kalshi for a completed order.
    side='yes' → use yes_price field, side='no' → use no_price field.
    Returns price in cents, or None if not available.
    """
    try:
        api_rate_limiter.wait()
        # Check fills for this order to get actual execution price
        fills_resp = kalshi_client.get_fills()
        fills = fills_resp.get('fills', [])
        order_fills = [f for f in fills if f.get('order_id') == order_id]
        if order_fills:
            total_cents = 0
            total_count = 0
            for f in order_fills:
                # Kalshi fills contain BOTH yes_price and no_price (complements).
                # Use the correct one based on which side this order was for.
                price_field = 'no_price' if side == 'no' else 'yes_price'
                price = f.get(price_field, f.get('yes_price', f.get('no_price', 0)))
                cnt = f.get('count', 1)
                total_cents += price * cnt
                total_count += cnt
            if total_count > 0:
                return round(total_cents / total_count)
        # Fallback: check the order status itself
        api_rate_limiter.wait()
        order_resp = kalshi_client.get_order(order_id)
        order_data = order_resp.get('order', {})
        # Some APIs return average_price or similar
        avg = order_data.get('average_fill_price', order_data.get('avg_fill_price'))
        if avg:
            return round(float(avg) * 100) if float(avg) < 1 else int(avg)
    except Exception as e:
        print(f'⚠ get_actual_fill_price error: {e}')
    return None


def execute_sell(ticker, side, count, reason='stop_loss'):
    """
    Reliably sell contracts at the current bid price.
    If the sell doesn't fill within a few seconds, cancel and return False
    so the bot stays active and retries next cycle at the new bid.
    After a successful fill, VERIFIES via Kalshi positions API that
    the contracts are actually gone.

    Returns (success: bool, order_info: dict)
    """
    MAX_ATTEMPTS = 3
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            # Fetch the CURRENT bid for this side right before selling
            api_rate_limiter.wait()
            mkt_resp = kalshi_client.get_market(ticker)
            mkt = mkt_resp.get('market', mkt_resp)

            def _tc(field):
                d = mkt.get(field + '_dollars')
                if d: return round(float(d) * 100)
                return mkt.get(field, 0)

            cur_bid = _tc(f'{side}_bid')
            if cur_bid <= 0:
                print(f'⚠ execute_sell({reason}) attempt {attempt}: {side} bid is {cur_bid}¢ — no buyers')
                return False, {'error': 'no_bid', 'bid': cur_bid}

            # Place limit sell at the current bid
            sell_kwargs = {
                'ticker': ticker,
                'side': side,
                'action': 'sell',
                'count': count,
            }
            if side == 'yes':
                sell_kwargs['yes_price'] = cur_bid
            else:
                sell_kwargs['no_price'] = cur_bid

            api_rate_limiter.wait()
            resp = kalshi_client.create_order(**sell_kwargs)
            order_id = resp.get('order', {}).get('order_id')

            if not order_id:
                print(f'⚠ execute_sell({reason}) attempt {attempt}: no order_id in response: {resp}')
                if attempt < MAX_ATTEMPTS:
                    time.sleep(1)
                    continue
                return False, resp

            # Check if it filled immediately
            time.sleep(0.5)
            api_rate_limiter.wait()
            check = kalshi_client.get_order(order_id)
            order_data = check.get('order', {})
            filled = order_data.get('filled_count', order_data.get('fill_count', 0))

            if filled >= count:
                # VERIFY: confirm position is actually gone on Kalshi
                cleared, remaining = verify_position_cleared(ticker, side, count)
                actual_price = get_actual_fill_price(order_id, side)
                sell_price = actual_price if actual_price else cur_bid
                print(f'✅ execute_sell({reason}): {side} {count}x {ticker} SOLD at {sell_price}¢ (attempt {attempt}) | verified={cleared}')
                return True, {'order_id': order_id, 'filled': filled, 'sell_price': sell_price,
                              'verified_cleared': cleared, 'remaining': remaining,
                              'actual_fill_price': actual_price}

            # Wait a bit more and check again
            time.sleep(1.5)
            api_rate_limiter.wait()
            check2 = kalshi_client.get_order(order_id)
            order_data2 = check2.get('order', {})
            filled2 = order_data2.get('filled_count', order_data2.get('fill_count', 0))

            if filled2 >= count:
                # VERIFY: confirm position is actually gone on Kalshi
                cleared, remaining = verify_position_cleared(ticker, side, count)
                actual_price = get_actual_fill_price(order_id, side)
                sell_price = actual_price if actual_price else cur_bid
                print(f'✅ execute_sell({reason}): {side} {count}x {ticker} SOLD at {sell_price}¢ (attempt {attempt}, 2nd check) | verified={cleared}')
                return True, {'order_id': order_id, 'filled': filled2, 'sell_price': sell_price,
                              'verified_cleared': cleared, 'remaining': remaining,
                              'actual_fill_price': actual_price}

            # Not filled — cancel this order and retry at the NEW bid
            print(f'⚠ execute_sell({reason}) attempt {attempt}: {side} {count}x {ticker} not filled at {cur_bid}¢ ({filled2}/{count}), cancelling...')
            try:
                api_rate_limiter.wait()
                kalshi_client.cancel_order(order_id)
            except Exception:
                pass

            if attempt < MAX_ATTEMPTS:
                print(f'   Retrying at new bid...')
                time.sleep(0.5)
                continue

        except Exception as e:
            print(f'❌ execute_sell({reason}) attempt {attempt}: exception: {e}')
            if attempt < MAX_ATTEMPTS:
                time.sleep(1)
                continue
            return False, {'error': str(e)}

    print(f'⚠ execute_sell({reason}): {side} {count}x {ticker} FAILED after {MAX_ATTEMPTS} attempts — will retry next monitor cycle')
    return False, {'attempts': MAX_ATTEMPTS, 'status': 'all_attempts_failed'}


@app.route('/api/bot/monitor', methods=['POST'])
def monitor_bots():
    """
    Check all active bots and handle fills / timeouts.

    PREGAME bots:
      - Orders sit patiently. No repost, no time-based stop-loss.
      - Only action: detect fills and mark completed.
      - If you cancel manually, that's fine.

    LIVE bots:
      - Repost stale unfilled orders after REPOST_AFTER_MINUTES
        (but NEVER above the current bid — repost AT the bid).
      - Partial fill resize after STALE_CANCEL_MINUTES.
      - Stop-loss if one side fills and the bid drops by stop_loss_cents.

    Both phases: if both sides fill → completed → profit locked at settlement.
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        # Auto-reset P&L if the date has changed
        auto_reset_daily_pnl()

        actions = []
        active_statuses = ('pending_fills', 'yes_filled', 'no_filled', 'watching')

        for bot_id, bot in list(active_bots.items()):
            if bot['status'] not in active_statuses:
                continue
            try:
                ticker  = bot['ticker']
                qty     = bot['quantity']
                stop    = bot['stop_loss_cents']
                now     = time.time()
                age_min = (now - bot.get('posted_at', now)) / 60.0
                phase   = bot.get('game_phase', 'pregame')

                # ── Watch Bots: monitor existing positions ───────────
                if bot.get('type') == 'watch':
                    watch_side = bot.get('side', 'yes')
                    entry = bot.get('entry_price', 50)
                    sl = bot.get('stop_loss_cents', 5)
                    tp = bot.get('take_profit_cents', 0)

                    api_rate_limiter.wait()
                    mkt_resp = kalshi_client.get_market(ticker)
                    mkt = mkt_resp.get('market', mkt_resp)

                    def tc_watch(field):
                        d = mkt.get(field + '_dollars')
                        if d: return round(float(d) * 100)
                        return mkt.get(field, 50)

                    cur_bid = tc_watch(f'{watch_side}_bid')
                    bot['live_bid'] = cur_bid
                    bot['last_price_update'] = now

                    # Stop-loss: sell at 1¢ (gets price improvement to actual bid)
                    if cur_bid <= entry - sl:
                        sold, sell_info = execute_sell(ticker, watch_side, qty, reason=f'watch_SL_{bot_id}')
                        if sold:
                            loss = (entry - cur_bid) * qty
                            bot['status'] = 'stopped'
                            bot['stopped_at'] = now
                            session_pnl['gross_loss_cents'] += loss
                            session_pnl['stopped_bots'] += 1
                            trade_history.insert(0, {
                        'bot_id': bot_id, 'ticker': ticker, 'type': 'watch',
                        'side': watch_side, 'entry_price': entry,
                        'exit_bid': cur_bid, 'quantity': qty,
                        'loss_cents': loss, 'result': 'stop_loss_watch',
                        'timestamp': now,
                        'placed_at': bot.get('created_at', now),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                    })
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_watch',
                                           'loss_cents': loss})
                        else:
                            print(f'⚠ Watch SL sell FAILED for {bot_id} — will retry next cycle')
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_watch_FAILED',
                                           'info': str(sell_info)})
                    # Take-profit
                    elif tp > 0 and cur_bid >= entry + tp:
                        sold, sell_info = execute_sell(ticker, watch_side, qty, reason=f'watch_TP_{bot_id}')
                        if sold:
                            profit = (cur_bid - entry) * qty
                            bot['status'] = 'completed'
                            bot['completed_at'] = now
                            session_pnl['gross_profit_cents'] += profit
                            session_pnl['completed_bots'] += 1
                            trade_history.insert(0, {
                        'bot_id': bot_id, 'ticker': ticker, 'type': 'watch',
                        'side': watch_side, 'entry_price': entry,
                        'exit_bid': cur_bid, 'quantity': qty,
                        'profit_cents': profit, 'result': 'take_profit_watch',
                        'timestamp': now,
                        'placed_at': bot.get('created_at', now),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                    })
                            actions.append({'bot_id': bot_id, 'action': 'take_profit_watch',
                                           'profit_cents': profit})
                        else:
                            print(f'⚠ Watch TP sell FAILED for {bot_id} — will retry next cycle')
                            actions.append({'bot_id': bot_id, 'action': 'take_profit_watch_FAILED',
                                           'info': str(sell_info)})
                    continue

                # ── Rate-limited fill checks ──────────────────────────────
                api_rate_limiter.wait()
                yes_resp = kalshi_client.get_order(bot['yes_order_id'])
                api_rate_limiter.wait()
                no_resp  = kalshi_client.get_order(bot['no_order_id'])

                yes_ord    = yes_resp.get('order', {})
                no_ord     = no_resp.get('order', {})
                yes_filled = yes_ord.get('filled_count', yes_ord.get('fill_count', 0))
                no_filled  = no_ord.get('filled_count',  no_ord.get('fill_count', 0))
                bot['yes_fill_qty'] = yes_filled
                bot['no_fill_qty']  = no_filled

                # ── Both sides fully filled → profit locked at settlement ──
                if yes_filled >= qty and no_filled >= qty:
                    bot['status'] = 'completed'
                    bot['completed_at'] = now

                    # Verify actual fill prices from the order data for accurate P&L
                    actual_yes = get_actual_fill_price(bot['yes_order_id'], 'yes')
                    actual_no  = get_actual_fill_price(bot['no_order_id'], 'no')
                    real_yes = actual_yes if actual_yes else bot['yes_price']
                    real_no  = actual_no  if actual_no  else bot['no_price']
                    verified_profit = (100 - real_yes - real_no) * qty
                    profit_cents = verified_profit

                    session_pnl['gross_profit_cents'] += profit_cents
                    session_pnl['completed_bots']     += 1
                    trade_history.insert(0, {
                        'bot_id': bot_id, 'ticker': ticker,
                        'yes_price': real_yes, 'no_price': real_no,
                        'original_yes': bot['yes_price'], 'original_no': bot['no_price'],
                        'quantity': qty, 'profit_cents': profit_cents,
                        'result': 'completed', 'timestamp': now,
                        'verified_prices': actual_yes is not None and actual_no is not None,
                        'placed_at': bot.get('created_at', now),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                    })
                    actions.append({'bot_id': bot_id, 'action': 'completed', 'profit_cents': profit_cents})

                    # ── REPEAT ARB: spawn a new bot at fresh prices if repeats remain ──
                    repeat_remaining = bot.get('repeat_count', 0) - bot.get('repeats_done', 0)
                    if repeat_remaining > 0:
                        try:
                            target_width = bot.get('arb_width', bot['profit_per'])
                            # Fetch fresh market prices
                            api_rate_limiter.wait()
                            fresh_mkt = kalshi_client.get_market(ticker)
                            fm = fresh_mkt.get('market', fresh_mkt)

                            def tc_repeat(field):
                                d = fm.get(field + '_dollars')
                                if d: return round(float(d) * 100)
                                return fm.get(field, 0)

                            fresh_yes_bid = tc_repeat('yes_bid')
                            fresh_no_bid  = tc_repeat('no_bid')
                            current_gap   = 100 - fresh_yes_bid - fresh_no_bid

                            if current_gap >= target_width and fresh_yes_bid > 0 and fresh_no_bid > 0:
                                # Calculate new prices maintaining the target width
                                # Use same favorite-anchoring logic as scanner
                                bid_sum = fresh_yes_bid + fresh_no_bid
                                target_total = 100 - target_width
                                total_shave = max(0, bid_sum - target_total)
                                yes_is_fav = fresh_yes_bid >= fresh_no_bid
                                fav_shave = total_shave * 4 // 10
                                dog_shave = total_shave - fav_shave
                                if yes_is_fav:
                                    new_yes = fresh_yes_bid - fav_shave
                                    new_no  = fresh_no_bid - dog_shave
                                else:
                                    new_yes = fresh_yes_bid - dog_shave
                                    new_no  = fresh_no_bid - fav_shave
                                new_yes = max(1, min(new_yes, fresh_yes_bid))
                                new_no  = max(1, min(new_no, fresh_no_bid))
                                new_profit = 100 - new_yes - new_no

                                if new_profit >= 1:
                                    # Place new orders
                                    api_rate_limiter.wait()
                                    ny = kalshi_client.create_order(
                                        ticker=ticker, side='yes', action='buy',
                                        count=qty, yes_price=new_yes)
                                    api_rate_limiter.wait()
                                    nn = kalshi_client.create_order(
                                        ticker=ticker, side='no', action='buy',
                                        count=qty, no_price=new_no)

                                    new_bot_id = f"{ticker}_{int(time.time())}"
                                    active_bots[new_bot_id] = {
                                        'ticker':          ticker,
                                        'yes_price':       new_yes,
                                        'no_price':        new_no,
                                        'quantity':        qty,
                                        'stop_loss_cents': bot['stop_loss_cents'],
                                        'profit_per':      new_profit,
                                        'game_phase':      bot['game_phase'],
                                        'status':          'pending_fills',
                                        'yes_order_id':    ny['order']['order_id'],
                                        'no_order_id':     nn['order']['order_id'],
                                        'yes_fill_qty':    0,
                                        'no_fill_qty':     0,
                                        'created_at':      time.time(),
                                        'posted_at':       time.time(),
                                        'repost_count':    0,
                                        'repeat_count':    bot['repeat_count'],
                                        'repeats_done':    bot.get('repeats_done', 0) + 1,
                                        'arb_width':       target_width,
                                        'parent_bot':      bot_id,
                                    }
                                    print(f'🔄 REPEAT ARB #{bot.get("repeats_done", 0) + 1}/{bot["repeat_count"]}: '
                                          f'new bot {new_bot_id} YES {new_yes}¢ + NO {new_no}¢ → {new_profit}¢ profit')
                                    actions.append({
                                        'bot_id': new_bot_id, 'action': 'repeat_spawned',
                                        'yes_price': new_yes, 'no_price': new_no,
                                        'profit_per': new_profit,
                                        'repeat_num': bot.get('repeats_done', 0) + 1,
                                        'repeat_total': bot['repeat_count'],
                                    })
                                else:
                                    print(f'⚠ Repeat skipped: new spread too tight ({new_profit}¢ < 1¢)')
                            else:
                                print(f'⚠ Repeat skipped: market gap {current_gap}¢ < target {target_width}¢')
                        except Exception as rep_err:
                            print(f'⚠ Repeat arb failed: {rep_err}')

                    continue

                # ── Fetch current market prices ────────────────────────────
                api_rate_limiter.wait()
                market_resp = kalshi_client.get_market(ticker)
                market = market_resp.get('market', market_resp)

                def to_cents(field):
                    d = market.get(field + '_dollars')
                    if d: return round(float(d) * 100)
                    return market.get(field, 50)

                yes_bid  = to_cents('yes_bid')
                no_bid   = to_cents('no_bid')
                yes_ask  = to_cents('yes_ask')
                no_ask   = to_cents('no_ask')

                # Store live market data on bot for frontend display
                bot['live_yes_bid'] = yes_bid
                bot['live_no_bid']  = no_bid
                bot['live_yes_ask'] = yes_ask
                bot['live_no_ask']  = no_ask
                bot['last_price_update'] = now

                # ═══════════════════════════════════════════════════════════
                # PREGAME: Patient mode — just detect fills, nothing else.
                # Orders sit in the book until game starts or user cancels.
                # ═══════════════════════════════════════════════════════════
                if phase == 'pregame':
                    # Update status labels for UI display
                    if yes_filled >= qty and no_filled < qty:
                        bot['status'] = 'yes_filled'
                    elif no_filled >= qty and yes_filled < qty:
                        bot['status'] = 'no_filled'
                    # No repost, no stop-loss, no resize — just wait.
                    continue

                # ═══════════════════════════════════════════════════════════
                # LIVE: Active management — repost, resize, stop-loss
                # ═══════════════════════════════════════════════════════════

                # ── Stale order repost (no fills after REPOST_AFTER_MINUTES) ──
                # NEVER go above the current bid. Repost AT the bid to stay competitive
                # without overpaying. Favorite-anchoring: shave less from the fav side.
                if yes_filled == 0 and no_filled == 0 and age_min >= REPOST_AFTER_MINUTES:
                    # Repost at current bids (never above, just refresh position in queue)
                    new_yes = min(yes_bid, 98)
                    new_no  = min(no_bid,  98)
                    if new_yes + new_no < 100:
                        try:
                            api_rate_limiter.wait()
                            kalshi_client.cancel_order(bot['yes_order_id'])
                            api_rate_limiter.wait()
                            kalshi_client.cancel_order(bot['no_order_id'])
                            api_rate_limiter.wait()
                            ny = kalshi_client.create_order(ticker=ticker, side='yes', action='buy', count=qty, yes_price=new_yes)
                            api_rate_limiter.wait()
                            nn = kalshi_client.create_order(ticker=ticker, side='no',  action='buy', count=qty, no_price=new_no)
                            bot.update({
                                'yes_order_id': ny['order']['order_id'],
                                'no_order_id':  nn['order']['order_id'],
                                'yes_price':    new_yes,
                                'no_price':     new_no,
                                'profit_per':   100 - new_yes - new_no,
                                'posted_at':    now,
                                'repost_count': bot.get('repost_count', 0) + 1,
                            })
                            actions.append({'bot_id': bot_id, 'action': 'reposted',
                                            'new_yes': new_yes, 'new_no': new_no,
                                            'repost_count': bot['repost_count']})
                        except Exception as re_err:
                            print(f"Repost failed for {bot_id}: {re_err}")
                    continue

                # ── Partial fill: resize unfilled leg after STALE_CANCEL_MINUTES ──
                if yes_filled > 0 and no_filled == 0 and age_min >= STALE_CANCEL_MINUTES:
                    # Repost NO at current no_bid (never above)
                    new_no_price = min(no_bid, 98)
                    try:
                        api_rate_limiter.wait()
                        kalshi_client.cancel_order(bot['no_order_id'])
                        api_rate_limiter.wait()
                        nn = kalshi_client.create_order(ticker=ticker, side='no', action='buy',
                                                        count=yes_filled, no_price=new_no_price)
                        bot.update({'no_order_id': nn['order']['order_id'],
                                    'quantity': yes_filled, 'no_price': new_no_price,
                                    'posted_at': now})
                        actions.append({'bot_id': bot_id, 'action': 'partial_resize_no', 'yes_filled': yes_filled})
                    except Exception as pe:
                        print(f"Partial resize NO failed for {bot_id}: {pe}")
                    continue

                if no_filled > 0 and yes_filled == 0 and age_min >= STALE_CANCEL_MINUTES:
                    # Repost YES at current yes_bid (never above)
                    new_yes_price = min(yes_bid, 98)
                    try:
                        api_rate_limiter.wait()
                        kalshi_client.cancel_order(bot['yes_order_id'])
                        api_rate_limiter.wait()
                        ny = kalshi_client.create_order(ticker=ticker, side='yes', action='buy',
                                                        count=no_filled, yes_price=new_yes_price)
                        bot.update({'yes_order_id': ny['order']['order_id'],
                                    'quantity': no_filled, 'yes_price': new_yes_price,
                                    'posted_at': now})
                        actions.append({'bot_id': bot_id, 'action': 'partial_resize_yes', 'no_filled': no_filled})
                    except Exception as pe:
                        print(f"Partial resize YES failed for {bot_id}: {pe}")
                    continue

                # ── YES fully filled, NO still open — check stop loss ──────
                if yes_filled >= qty and no_filled < qty:
                    bot['status'] = 'yes_filled'
                    if yes_bid <= bot['yes_price'] - stop:
                        # STOP LOSS: sell YES FIRST, only cancel hedge if sell confirmed
                        sold, sell_info = execute_sell(ticker, 'yes', yes_filled, reason=f'arb_SL_yes_{bot_id}')
                        if sold:
                            # Sell confirmed — NOW safe to cancel the hedge
                            try:
                                api_rate_limiter.wait()
                                kalshi_client.cancel_order(bot['no_order_id'])
                            except Exception:
                                pass
                            # Double-check cancel
                            try:
                                api_rate_limiter.wait()
                                no_check = kalshi_client.get_order(bot['no_order_id'])
                                no_status = no_check.get('order', {}).get('status', '')
                                if no_status not in ('canceled', 'cancelled'):
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['no_order_id'])
                            except Exception:
                                pass
                            bot['status'] = 'stopped'
                            bot['stopped_at'] = now
                            # Use VERIFIED sell price from execute_sell, not the bid snapshot
                            actual_sell = sell_info.get('actual_fill_price') or sell_info.get('sell_price', yes_bid)
                            loss = (bot['yes_price'] - actual_sell) * yes_filled
                            verified = sell_info.get('verified_cleared', False)
                            session_pnl['gross_loss_cents'] += loss
                            session_pnl['stopped_bots']     += 1
                            trade_history.insert(0, {
                                'bot_id': bot_id, 'ticker': ticker,
                                'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                'quantity': yes_filled, 'loss_cents': loss,
                                'result': 'stop_loss_yes', 'exit_bid': actual_sell,
                                'verified_cleared': verified, 'timestamp': now,
                                'placed_at': bot.get('created_at', now),
                                'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                            })
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_yes',
                                            'entry': bot['yes_price'], 'exit_bid': actual_sell,
                                            'loss_cents': loss, 'verified': verified})

                            # ── REPEAT ARB after stop-loss ──
                            repeat_remaining = bot.get('repeat_count', 0) - bot.get('repeats_done', 0)
                            if repeat_remaining > 0:
                                try:
                                    target_width = bot.get('arb_width', bot['profit_per'])
                                    api_rate_limiter.wait()
                                    fresh_mkt = kalshi_client.get_market(ticker)
                                    fm = fresh_mkt.get('market', fresh_mkt)
                                    def tc_rsl_y(field):
                                        d = fm.get(field + '_dollars')
                                        if d: return round(float(d) * 100)
                                        return fm.get(field, 0)
                                    fresh_yes_bid = tc_rsl_y('yes_bid')
                                    fresh_no_bid  = tc_rsl_y('no_bid')
                                    current_gap   = 100 - fresh_yes_bid - fresh_no_bid
                                    if current_gap >= target_width and fresh_yes_bid > 0 and fresh_no_bid > 0:
                                        bid_sum = fresh_yes_bid + fresh_no_bid
                                        target_total = 100 - target_width
                                        total_shave = max(0, bid_sum - target_total)
                                        yes_is_fav = fresh_yes_bid >= fresh_no_bid
                                        fav_shave = total_shave * 4 // 10
                                        dog_shave = total_shave - fav_shave
                                        if yes_is_fav:
                                            new_yes = fresh_yes_bid - fav_shave
                                            new_no  = fresh_no_bid - dog_shave
                                        else:
                                            new_yes = fresh_yes_bid - dog_shave
                                            new_no  = fresh_no_bid - fav_shave
                                        new_yes = max(1, min(new_yes, fresh_yes_bid))
                                        new_no  = max(1, min(new_no, fresh_no_bid))
                                        new_profit = 100 - new_yes - new_no
                                        if new_profit >= 1:
                                            api_rate_limiter.wait()
                                            ny = kalshi_client.create_order(ticker=ticker, side='yes', action='buy', count=qty, yes_price=new_yes)
                                            api_rate_limiter.wait()
                                            nn = kalshi_client.create_order(ticker=ticker, side='no', action='buy', count=qty, no_price=new_no)
                                            new_bot_id = f"{ticker}_{int(time.time())}"
                                            active_bots[new_bot_id] = {
                                                'ticker': ticker, 'yes_price': new_yes, 'no_price': new_no,
                                                'quantity': qty, 'stop_loss_cents': bot['stop_loss_cents'],
                                                'profit_per': new_profit, 'game_phase': bot['game_phase'],
                                                'status': 'pending_fills',
                                                'yes_order_id': ny['order']['order_id'],
                                                'no_order_id': nn['order']['order_id'],
                                                'yes_fill_qty': 0, 'no_fill_qty': 0,
                                                'created_at': time.time(), 'posted_at': time.time(),
                                                'repost_count': 0, 'repeat_count': bot['repeat_count'],
                                                'repeats_done': bot.get('repeats_done', 0) + 1,
                                                'arb_width': target_width, 'parent_bot': bot_id,
                                            }
                                            print(f'🔄 REPEAT (after SL) #{bot.get("repeats_done", 0) + 1}/{bot["repeat_count"]}: '
                                                  f'new bot {new_bot_id} YES {new_yes}¢ + NO {new_no}¢ → {new_profit}¢')
                                            actions.append({'bot_id': new_bot_id, 'action': 'repeat_spawned',
                                                'yes_price': new_yes, 'no_price': new_no, 'profit_per': new_profit,
                                                'repeat_num': bot.get('repeats_done', 0) + 1,
                                                'repeat_total': bot['repeat_count'], 'after_stop_loss': True})
                                except Exception as rep_err:
                                    print(f'⚠ Repeat after SL failed: {rep_err}')

                        else:
                            # Sell FAILED — do NOT touch hedge, do NOT change status
                            # Bot stays at yes_filled, retries next monitor cycle
                            print(f'⚠ Arb SL YES sell FAILED for {bot_id} — hedge kept, retrying next cycle')
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_yes_RETRY'})
                    continue  # ← prevent fall-through to NO check

                # ── NO fully filled, YES still open — check stop loss ──────
                if no_filled >= qty and yes_filled < qty:
                    bot['status'] = 'no_filled'
                    if no_bid <= bot['no_price'] - stop:
                        # STOP LOSS: sell NO FIRST, only cancel hedge if sell confirmed
                        sold, sell_info = execute_sell(ticker, 'no', no_filled, reason=f'arb_SL_no_{bot_id}')
                        if sold:
                            # Sell confirmed — NOW safe to cancel the hedge
                            try:
                                api_rate_limiter.wait()
                                kalshi_client.cancel_order(bot['yes_order_id'])
                            except Exception:
                                pass
                            # Double-check cancel
                            try:
                                api_rate_limiter.wait()
                                yes_check = kalshi_client.get_order(bot['yes_order_id'])
                                yes_status = yes_check.get('order', {}).get('status', '')
                                if yes_status not in ('canceled', 'cancelled'):
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['yes_order_id'])
                            except Exception:
                                pass
                            bot['status'] = 'stopped'
                            bot['stopped_at'] = now
                            # Use VERIFIED sell price from execute_sell, not the bid snapshot
                            actual_sell = sell_info.get('actual_fill_price') or sell_info.get('sell_price', no_bid)
                            loss = (bot['no_price'] - actual_sell) * no_filled
                            verified = sell_info.get('verified_cleared', False)
                            session_pnl['gross_loss_cents'] += loss
                            session_pnl['stopped_bots']     += 1
                            trade_history.insert(0, {
                                'bot_id': bot_id, 'ticker': ticker,
                                'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                'quantity': no_filled, 'loss_cents': loss,
                                'result': 'stop_loss_no', 'exit_bid': actual_sell,
                                'verified_cleared': verified, 'timestamp': now,
                                'placed_at': bot.get('created_at', now),
                                'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                            })
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_no',
                                            'entry': bot['no_price'], 'exit_bid': actual_sell,
                                            'loss_cents': loss, 'verified': verified})

                            # ── REPEAT ARB after stop-loss ──
                            repeat_remaining = bot.get('repeat_count', 0) - bot.get('repeats_done', 0)
                            if repeat_remaining > 0:
                                try:
                                    target_width = bot.get('arb_width', bot['profit_per'])
                                    api_rate_limiter.wait()
                                    fresh_mkt = kalshi_client.get_market(ticker)
                                    fm = fresh_mkt.get('market', fresh_mkt)
                                    def tc_rsl_n(field):
                                        d = fm.get(field + '_dollars')
                                        if d: return round(float(d) * 100)
                                        return fm.get(field, 0)
                                    fresh_yes_bid = tc_rsl_n('yes_bid')
                                    fresh_no_bid  = tc_rsl_n('no_bid')
                                    current_gap   = 100 - fresh_yes_bid - fresh_no_bid
                                    if current_gap >= target_width and fresh_yes_bid > 0 and fresh_no_bid > 0:
                                        bid_sum = fresh_yes_bid + fresh_no_bid
                                        target_total = 100 - target_width
                                        total_shave = max(0, bid_sum - target_total)
                                        yes_is_fav = fresh_yes_bid >= fresh_no_bid
                                        fav_shave = total_shave * 4 // 10
                                        dog_shave = total_shave - fav_shave
                                        if yes_is_fav:
                                            new_yes = fresh_yes_bid - fav_shave
                                            new_no  = fresh_no_bid - dog_shave
                                        else:
                                            new_yes = fresh_yes_bid - dog_shave
                                            new_no  = fresh_no_bid - fav_shave
                                        new_yes = max(1, min(new_yes, fresh_yes_bid))
                                        new_no  = max(1, min(new_no, fresh_no_bid))
                                        new_profit = 100 - new_yes - new_no
                                        if new_profit >= 1:
                                            api_rate_limiter.wait()
                                            ny = kalshi_client.create_order(ticker=ticker, side='yes', action='buy', count=qty, yes_price=new_yes)
                                            api_rate_limiter.wait()
                                            nn = kalshi_client.create_order(ticker=ticker, side='no', action='buy', count=qty, no_price=new_no)
                                            new_bot_id = f"{ticker}_{int(time.time())}"
                                            active_bots[new_bot_id] = {
                                                'ticker': ticker, 'yes_price': new_yes, 'no_price': new_no,
                                                'quantity': qty, 'stop_loss_cents': bot['stop_loss_cents'],
                                                'profit_per': new_profit, 'game_phase': bot['game_phase'],
                                                'status': 'pending_fills',
                                                'yes_order_id': ny['order']['order_id'],
                                                'no_order_id': nn['order']['order_id'],
                                                'yes_fill_qty': 0, 'no_fill_qty': 0,
                                                'created_at': time.time(), 'posted_at': time.time(),
                                                'repost_count': 0, 'repeat_count': bot['repeat_count'],
                                                'repeats_done': bot.get('repeats_done', 0) + 1,
                                                'arb_width': target_width, 'parent_bot': bot_id,
                                            }
                                            print(f'🔄 REPEAT (after SL) #{bot.get("repeats_done", 0) + 1}/{bot["repeat_count"]}: '
                                                  f'new bot {new_bot_id} YES {new_yes}¢ + NO {new_no}¢ → {new_profit}¢')
                                            actions.append({'bot_id': new_bot_id, 'action': 'repeat_spawned',
                                                'yes_price': new_yes, 'no_price': new_no, 'profit_per': new_profit,
                                                'repeat_num': bot.get('repeats_done', 0) + 1,
                                                'repeat_total': bot['repeat_count'], 'after_stop_loss': True})
                                except Exception as rep_err:
                                    print(f'⚠ Repeat after SL failed: {rep_err}')

                        else:
                            # Sell FAILED — do NOT touch hedge, do NOT change status
                            # Bot stays at no_filled, retries next monitor cycle
                            print(f'⚠ Arb SL NO sell FAILED for {bot_id} — hedge kept, retrying next cycle')
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_no_RETRY'})

            except Exception as e:
                print(f"Error monitoring bot {bot_id}: {e}")
                continue

        save_state()
        return jsonify({
            'success':     True,
            'actions':     actions,
            'active_bots': len([b for b in active_bots.values() if b['status'] in active_statuses]),
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/bot/list', methods=['GET'])
def list_bots():
    """Get all bots with live market data"""
    return jsonify({'bots': active_bots})


@app.route('/api/bot/history', methods=['GET'])
def bot_history():
    """Get completed/stopped trade history"""
    limit = int(request.args.get('limit', 50))
    return jsonify({'trades': trade_history[:limit], 'total': len(trade_history)})


@app.route('/api/bot/history/clear', methods=['POST'])
def clear_history():
    """Clear all trade history and reset P&L counters"""
    global trade_history, session_pnl
    trade_history = []
    session_pnl['gross_profit_cents'] = 0
    session_pnl['gross_loss_cents'] = 0
    session_pnl['completed_bots'] = 0
    session_pnl['stopped_bots'] = 0
    save_state()
    return jsonify({'success': True, 'message': 'History cleared, P&L reset'})


@app.route('/api/bot/set_phase/<bot_id>', methods=['POST'])
def set_bot_phase(bot_id):
    """Switch a bot between 'pregame' and 'live' phases.
    When a game goes live, flip the phase so the monitor starts
    doing repost / stop-loss management."""
    if bot_id not in active_bots:
        return jsonify({'error': 'Bot not found'}), 404
    data = request.json or {}
    new_phase = data.get('phase', 'live')
    if new_phase not in ('pregame', 'live'):
        return jsonify({'error': 'phase must be pregame or live'}), 400
    active_bots[bot_id]['game_phase'] = new_phase
    # Reset posted_at so timeout counters restart from now
    active_bots[bot_id]['posted_at'] = time.time()
    save_state()
    return jsonify({'success': True, 'bot_id': bot_id, 'phase': new_phase})


@app.route('/api/bot/cancel/<bot_id>', methods=['DELETE'])
def cancel_bot(bot_id):
    """Cancel a bot and its outstanding limit orders"""
    if bot_id not in active_bots:
        return jsonify({'error': 'Bot not found'}), 404

    bot = active_bots[bot_id]
    cancelled = []

    # Cancel any unfilled limit orders
    if kalshi_client:
        if bot.get('yes_order_id') and bot.get('yes_fill_qty', 0) < bot.get('quantity', 1):
            try:
                kalshi_client.cancel_order(bot['yes_order_id'])
                cancelled.append('YES')
            except Exception:
                pass
        if bot.get('no_order_id') and bot.get('no_fill_qty', 0) < bot.get('quantity', 1):
            try:
                kalshi_client.cancel_order(bot['no_order_id'])
                cancelled.append('NO')
            except Exception:
                pass

    del active_bots[bot_id]
    save_state()
    return jsonify({'success': True, 'cancelled_orders': cancelled})


@app.route('/api/bot/scan', methods=['GET'])
def scan_arb_opportunities():
    """
    Smart arb scanner — finds markets with wide bid-bid spreads where
    limit orders can capture profit.  Uses the same series-based fetching
    as the main /markets endpoint so it actually scans real sports markets.

    Strategy: For dual-arb to work you place YES limit buy at yes_bid+1
    and NO limit buy at no_bid+1.  Profit = 100 - yes_price - no_price.
    A market where yes_bid + no_bid is well below 100 means there's room
    for maker orders to capture spread.  The wider the gap, the more profit
    per contract (but also longer fill time / lower liquidity).
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        min_width = max(1, int(request.args.get('min_width', 3)))
        sport_filter = request.args.get('sport', '')

        # Use the same series map as /api/markets
        SPORTS_SERIES = {
            'nba': ['KXNBAGAME', 'KXNBASPREAD', 'KXNBATOTAL', 'KXNBAPOINTS',
                     'KXNBAREBOUNDS', 'KXNBAASSISTS', 'KXNBA3PM', 'KXNBASTEALS',
                     'KXNBABLOCKS'],
            'nfl': ['KXNFLGAME', 'KXNFLSPREAD', 'KXNFLTOTAL'],
            'nhl': ['KXNHLGAME', 'KXNHLSPREAD', 'KXNHLTOTAL', 'KXNHLGOAL'],
            'mlb': ['KXMLBGAME', 'KXMLBSPREAD', 'KXMLBTOTAL'],
            'ncaab': ['KXNCAABGAME', 'KXNCAABSPREAD', 'KXNCAABTOTAL'],
            'epl': ['KXEPLGAME', 'KXEPLGOAL', 'KXEPLBTTS'],
            'ucl': ['KXUCLGAME', 'KXUCLGOAL', 'KXUCLBTTS'],
        }

        if sport_filter and sport_filter.lower() not in ('', 'all'):
            series_to_fetch = SPORTS_SERIES.get(sport_filter.lower(), [])
        else:
            series_to_fetch = []
            for s in SPORTS_SERIES.values():
                series_to_fetch.extend(s)

        # Fetch all open markets from each series
        all_markets = []
        for series in series_to_fetch:
            try:
                result = kalshi_client.get_markets_by_series(series, status='open', limit=200)
                markets = result.get('markets', [])
                markets = [m for m in markets if 'mve_selected_legs' not in m
                           and 'KXMVECROSSCATEGORY' not in m.get('ticker', '')]
                all_markets.extend(markets)
            except Exception:
                continue

        def tc(m, field):
            d = m.get(field + '_dollars')
            if d: return round(float(d) * 100)
            return m.get(field, 0)

        opportunities = []
        for m in all_markets:
            yes_bid = tc(m, 'yes_bid')
            no_bid  = tc(m, 'no_bid')
            yes_ask = tc(m, 'yes_ask')
            no_ask  = tc(m, 'no_ask')
            if not yes_bid or not no_bid:
                continue

            # Width = profit room for dual-arb limit orders
            width = 100 - yes_bid - no_bid
            if width < min_width:
                continue

            # If both ask prices exist, calculate instant arb too
            instant = (100 - (yes_ask or 99) - (no_ask or 99)) if yes_ask and no_ask else 0

            # Suggested prices: AT the bid, never above it.
            # Use favorite-anchoring: shave less from fav, more from underdog.
            bid_sum = yes_bid + no_bid
            target_total = 100 - min_width  # target combined cost
            total_shave = max(0, bid_sum - target_total)
            yes_is_fav = yes_bid >= no_bid
            fav_shave = total_shave * 4 // 10  # 40% to fav
            dog_shave = total_shave - fav_shave  # 60% to underdog
            if yes_is_fav:
                sug_yes = yes_bid - fav_shave
                sug_no  = no_bid - dog_shave
            else:
                sug_yes = yes_bid - dog_shave
                sug_no  = no_bid - fav_shave
            sug_yes = max(1, min(sug_yes, yes_bid))  # never above bid
            sug_no  = max(1, min(sug_no, no_bid))    # never above bid
            posted_profit = 100 - sug_yes - sug_no

            # Spread info
            yes_spread = (yes_ask - yes_bid) if yes_ask and yes_bid else 0
            no_spread  = (no_ask  - no_bid)  if no_ask  and no_bid  else 0

            opportunities.append({
                'ticker':        m.get('ticker', ''),
                'title':         m.get('title', ''),
                'event_ticker':  m.get('event_ticker', ''),
                'series_ticker': m.get('series_ticker', ''),
                'yes_bid':       yes_bid,
                'no_bid':        no_bid,
                'yes_ask':       yes_ask or 0,
                'no_ask':        no_ask or 0,
                'yes_spread':    yes_spread,
                'no_spread':     no_spread,
                'width':         width,
                'instant_arb':   instant > 0,
                'suggested_yes': sug_yes,
                'suggested_no':  sug_no,
                'profit_posted': posted_profit,
            })

        opportunities.sort(key=lambda x: x['width'], reverse=True)
        return jsonify({
            'opportunities': opportunities,
            'count': len(opportunities),
            'total_scanned': len(all_markets),
            'min_width': min_width
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/pnl', methods=['GET'])
def get_pnl():
    """Upgrade #6: P&L dashboard — session profit/loss summary."""
    auto_reset_daily_pnl()
    pnl = dict(session_pnl)
    pnl['net_cents']   = pnl['gross_profit_cents'] - pnl['gross_loss_cents']
    pnl['net_dollars'] = pnl['net_cents'] / 100
    pnl['active_bots'] = len([b for b in active_bots.values()
                               if b['status'] in ('pending_fills', 'yes_filled', 'no_filled')])
    pnl['day_key']     = pnl.get('day_key', datetime.date.today().isoformat())
    return jsonify(pnl)


@app.route('/api/pnl/reset', methods=['POST'])
def reset_pnl():
    """Reset session P&L counters."""
    global session_pnl
    session_pnl = {
        'gross_profit_cents': 0, 'gross_loss_cents': 0,
        'completed_bots': 0,     'stopped_bots': 0,
        'session_start': time.time(),
        'day_key': datetime.date.today().isoformat(),
    }
    save_state()
    return jsonify({'success': True})


# ─── Middle Spread Scanner ─────────────────────────────────────────────────────
# A "middle" is when you buy YES on a tight spread (e.g. Team -3.5) and
# NO on a wider spread for the same team (e.g. Team -7.5).
# If the team wins by 4-7 points, BOTH contracts settle YES/NO correctly
# and you win both sides.  Even if only one hits, the combined cost < 100¢
# for each individual contract, so downside is limited.

@app.route('/api/scan/middles', methods=['GET'])
def scan_middles():
    """
    Find middle spread opportunities within the same game.
    Looks for spread pairs where:
      - Same game (same event group)
      - One spread is tighter (e.g. -3.5), one is wider (e.g. -7.5)
      - Buying YES on tight + NO on wide (or vice versa) creates a "middle"
        where both can win if the margin lands between the two numbers

    Returns list of middle opportunities with expected value calculations.
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        # Fetch all spread markets
        SPREAD_SERIES = [
            'KXNBASPREAD', 'KXNFLSPREAD', 'KXNHLSPREAD',
            'KXMLBSPREAD', 'KXNCAABSPREAD',
        ]

        all_spreads = []
        for series in SPREAD_SERIES:
            try:
                result = kalshi_client.get_markets_by_series(series, status='open', limit=200)
                markets = result.get('markets', [])
                markets = [m for m in markets if 'mve_selected_legs' not in m]
                all_spreads.extend(markets)
            except Exception:
                continue

        def tc(m, field):
            d = m.get(field + '_dollars')
            if d: return round(float(d) * 100)
            return m.get(field, 0)

        # Group spreads by game
        # Event ticker format: KXNBASPREAD-26FEB28TORWAS
        # Game ID = last part after the series prefix hyphen
        import re
        games = {}
        for m in all_spreads:
            et = m.get('event_ticker', '')
            # Extract game ID — everything after the last series prefix
            match = re.match(r'KX\w+SPREAD-(.+)', et, re.IGNORECASE)
            if not match:
                continue
            game_id = match.group(1)
            if game_id not in games:
                games[game_id] = []
            games[game_id].append(m)

        middles = []
        for game_id, spreads in games.items():
            if len(spreads) < 2:
                continue

            # Parse spread numbers from titles
            # e.g. "TOR vs WAS: TOR -3.5" → team=TOR, spread=-3.5
            parsed = []
            for m in spreads:
                title = m.get('title', '')
                # Try to extract spread number
                sp_match = re.search(r'([A-Z]{2,5})\s+([+-]?\d+\.?\d*)', title)
                if sp_match:
                    team = sp_match.group(1)
                    spread_num = float(sp_match.group(2))
                    parsed.append({
                        'market': m,
                        'team': team,
                        'spread': spread_num,
                        'yes_bid': tc(m, 'yes_bid'),
                        'no_bid': tc(m, 'no_bid'),
                        'yes_ask': tc(m, 'yes_ask'),
                        'no_ask': tc(m, 'no_ask'),
                    })

            # Find pairs: same team, different spread numbers
            for i in range(len(parsed)):
                for j in range(i + 1, len(parsed)):
                    a, b = parsed[i], parsed[j]
                    if a['team'] != b['team']:
                        continue

                    # Order so that 'tight' has the smaller absolute spread
                    if abs(a['spread']) <= abs(b['spread']):
                        tight, wide = a, b
                    else:
                        tight, wide = b, a

                    gap = abs(wide['spread']) - abs(tight['spread'])
                    if gap < 1:
                        continue  # spreads too close, no real middle

                    # Strategy: buy YES on tight spread, buy NO on wide spread
                    # Cost: tight_yes_bid + wide_no_bid
                    # Win condition: margin lands between tight and wide
                    cost_yes_tight_no_wide = tight['yes_bid'] + wide['no_bid']
                    # Alt: buy NO on tight, YES on wide
                    cost_no_tight_yes_wide = tight['no_bid'] + wide['yes_bid']

                    # Pick the cheaper direction
                    if cost_yes_tight_no_wide <= cost_no_tight_yes_wide:
                        cost = cost_yes_tight_no_wide
                        direction = 'YES_tight_NO_wide'
                        entry_desc = f"YES {tight['market']['title']} @ {tight['yes_bid']}¢ + NO {wide['market']['title']} @ {wide['no_bid']}¢"
                    else:
                        cost = cost_no_tight_yes_wide
                        direction = 'NO_tight_YES_wide'
                        entry_desc = f"NO {tight['market']['title']} @ {tight['no_bid']}¢ + YES {wide['market']['title']} @ {wide['yes_bid']}¢"

                    # Max win: if margin lands in the middle, both settle favorably = $2 payout
                    # One-side win: $1 payout
                    # Both miss: $0 payout
                    max_payout = 200  # both contracts pay
                    partial_payout = 100  # one contract pays
                    max_profit = max_payout - cost
                    partial_profit = partial_payout - cost

                    middles.append({
                        'game_id': game_id,
                        'team': tight['team'],
                        'tight_spread': tight['spread'],
                        'wide_spread': wide['spread'],
                        'gap': gap,
                        'direction': direction,
                        'cost': cost,
                        'max_profit': max_profit,
                        'partial_profit': partial_profit,
                        'entry': entry_desc,
                        'tight_ticker': tight['market']['ticker'],
                        'wide_ticker': wide['market']['ticker'],
                        'tight_title': tight['market']['title'],
                        'wide_title': wide['market']['title'],
                        'tight_yes_bid': tight['yes_bid'],
                        'tight_no_bid': tight['no_bid'],
                        'wide_yes_bid': wide['yes_bid'],
                        'wide_no_bid': wide['no_bid'],
                    })

        # Sort by max_profit descending
        middles.sort(key=lambda x: x['max_profit'], reverse=True)

        return jsonify({
            'middles': middles,
            'count': len(middles),
            'total_spreads': len(all_spreads),
            'games_with_spreads': len(games),
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ─── Active Positions from Kalshi ──────────────────────────────────────────────

@app.route('/api/positions/active', methods=['GET'])
def get_active_positions():
    """Get current Kalshi positions enriched with live market data."""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        positions = kalshi_client.get_positions(limit=200)
        pos_list = positions.get('market_positions', positions.get('positions', []))

        enriched = []
        for pos in pos_list:
            qty = pos.get('position', 0)
            if qty == 0:
                continue
            ticker = pos.get('ticker', '')
            side = 'yes' if qty > 0 else 'no'
            abs_qty = abs(qty)

            try:
                api_rate_limiter.wait()
                mkt_resp = kalshi_client.get_market(ticker)
                mkt = mkt_resp.get('market', mkt_resp)

                def tc_pos(field):
                    d = mkt.get(field + '_dollars')
                    if d: return round(float(d) * 100)
                    return mkt.get(field, 0)

                enriched.append({
                    'ticker':     ticker,
                    'title':      mkt.get('title', ticker),
                    'side':       side,
                    'quantity':   abs_qty,
                    'yes_bid':    tc_pos('yes_bid'),
                    'yes_ask':    tc_pos('yes_ask'),
                    'no_bid':     tc_pos('no_bid'),
                    'no_ask':     tc_pos('no_ask'),
                    'market_exposure': pos.get('market_exposure', 0),
                    'realized_pnl':   pos.get('realized_pnl', 0),
                    'resting_orders': pos.get('resting_orders_count', 0),
                    'fees_paid':      pos.get('fees_paid', 0),
                    'watched_by': next((bid for bid, b in active_bots.items()
                                        if b.get('ticker') == ticker and b.get('type') == 'watch'
                                        and b['status'] == 'watching'), None),
                })
            except Exception:
                enriched.append({
                    'ticker': ticker, 'title': ticker,
                    'side': side, 'quantity': abs_qty,
                    'yes_bid': 0, 'no_bid': 0, 'yes_ask': 0, 'no_ask': 0,
                    'market_exposure': pos.get('market_exposure', 0),
                    'realized_pnl': pos.get('realized_pnl', 0),
                    'watched_by': None,
                })

        return jsonify({'positions': enriched, 'count': len(enriched)})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/bot/watch', methods=['POST'])
def watch_position():
    """Attach a watch-bot to an existing Kalshi position for stop-loss / take-profit."""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json
        ticker           = data.get('ticker')
        side             = data.get('side', 'yes')
        entry_price      = int(data.get('entry_price', 50))
        quantity         = int(data.get('quantity', 1))
        stop_loss_cents  = int(data.get('stop_loss_cents', 5))
        take_profit_cents = int(data.get('take_profit_cents', 0))

        if not ticker:
            return jsonify({'error': 'ticker required'}), 400

        bot_id = f"watch_{ticker}_{int(time.time())}"
        active_bots[bot_id] = {
            'type':              'watch',
            'ticker':            ticker,
            'side':              side,
            'entry_price':       entry_price,
            'quantity':          quantity,
            'stop_loss_cents':   stop_loss_cents,
            'take_profit_cents': take_profit_cents,
            'status':            'watching',
            'game_phase':        'live',
            'created_at':        time.time(),
            'posted_at':         time.time(),
        }
        save_state()

        return jsonify({
            'success': True,
            'bot_id':  bot_id,
            'message': f'Watching {side.upper()} on {ticker} — SL: -{stop_loss_cents}¢'
                       + (f', TP: +{take_profit_cents}¢' if take_profit_cents else ''),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    load_state()
    app.run(debug=True, host='0.0.0.0', port=5001)
