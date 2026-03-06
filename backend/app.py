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


@app.route('/api/auto-login', methods=['POST'])
def auto_login():
    """Auto-login using server-side config.json (credentials never sent over the wire)"""
    global kalshi_client

    try:
        config_path = os.path.join(os.path.dirname(__file__), 'config.json')
        if not os.path.exists(config_path):
            return jsonify({'error': 'config.json not found. Create backend/config.json with api_key_id and private_key_path.'}), 400

        import json as _json
        with open(config_path) as f:
            config = _json.load(f)

        api_key_id = config.get('api_key_id')
        key_file = config.get('private_key_path', 'kalshi_private_key.pem')
        demo = config.get('demo', False)

        if not api_key_id:
            return jsonify({'error': 'api_key_id missing from config.json'}), 400

        # Resolve key path relative to backend directory
        key_path = os.path.join(os.path.dirname(__file__), key_file)
        if not os.path.exists(key_path):
            return jsonify({'error': f'Private key file not found: {key_file}'}), 400

        kalshi_client = KalshiAPI(api_key_id, key_path, demo=demo)
        balance = kalshi_client.get_balance()

        # Start WebSocket connection for real-time data
        try:
            ws_manager.connect(kalshi_client)
            # Subscribe to tickers of any existing active bots
            active_tickers = list({b['ticker'] for b in active_bots.values()
                                   if b.get('status') in ('fav_posted', 'pending_fills', 'yes_filled', 'no_filled', 'watching')})
            if active_tickers:
                threading.Timer(2.0, lambda: ws_manager.subscribe(active_tickers)).start()
        except Exception as ws_err:
            print(f'⚠ WS connect after login failed (non-fatal): {ws_err}')

        return jsonify({
            'success': True,
            'balance': balance.get('balance', 0) / 100,
            'portfolio_value': balance.get('portfolio_value', 0) / 100,
            'display_name': config.get('display_name', '')
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ws/status', methods=['GET'])
def ws_status():
    """Get WebSocket connection status and subscribed tickers."""
    return jsonify({
        'connected': ws_manager.connected,
        'subscribed_tickers': list(ws_manager._subscribed_tickers),
        'cached_tickers': list(ws_manager.ticker_cache.keys()),
        'recent_fills': len(ws_manager.fill_events),
        'recent_orders': len(ws_manager.order_events),
    })


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
        # Map: series_ticker -> market_type for frontend categorization
        SERIES_TYPE_MAP = {
            # NBA
            'KXNBAGAME': 'winner', 'KXNBASPREAD': 'spread', 'KXNBATOTAL': 'total',
            'KXNBAPTS': 'prop', 'KXNBAREB': 'prop', 'KXNBAAST': 'prop',
            'KXNBA3PT': 'prop', 'KXNBASTL': 'prop', 'KXNBABLK': 'prop',
            'KXNBAMVP': 'prop',
            # NFL
            'KXNFLGAME': 'winner', 'KXNFLSPREAD': 'spread', 'KXNFLTOTAL': 'total',
            # NHL
            'KXNHLGAME': 'winner', 'KXNHLSPREAD': 'spread', 'KXNHLTOTAL': 'total',
            'KXNHLGOAL': 'prop',
            # MLB
            'KXMLBGAME': 'winner', 'KXMLBSPREAD': 'spread', 'KXMLBTOTAL': 'total',
            'KXMLBSTGAME': 'winner',  # Spring Training
            # MLS
            'KXMLSGAME': 'winner', 'KXMLSSPREAD': 'spread', 'KXMLSTOTAL': 'total',
            'KXMLSBTTS': 'prop',
            # NCAAB (Men's College Basketball — Kalshi uses KXNCAAMB prefix)
            'KXNCAAMBGAME': 'winner', 'KXNCAAMBSPREAD': 'spread', 'KXNCAAMBTOTAL': 'total',
            'KXNCAAMB1HWINNER': '1h_winner', 'KXNCAAMB1HSPREAD': '1h_spread', 'KXNCAAMB1HTOTAL': '1h_total',
            'KXMARMAD': 'prop',  # March Madness Champion
            # NCAAB Women's
            'KXNCAAWBGAME': 'winner',
            # NCAAF
            'KXNCAAFGAME': 'winner', 'KXNCAAFSPREAD': 'spread', 'KXNCAAFTOTAL': 'total',
            # Soccer
            'KXEPLGAME': 'winner', 'KXEPLSPREAD': 'spread', 'KXEPLTOTAL': 'total',
            'KXEPLGOAL': 'total', 'KXEPLBTTS': 'prop',
            'KXUCLGAME': 'winner', 'KXUCLSPREAD': 'spread', 'KXUCLTOTAL': 'total',
            'KXUCLGOAL': 'total', 'KXUCLBTTS': 'prop',
            # Tennis
            'KXATPMATCH': 'winner',
            'KXWTAMATCH': 'winner',
        }
        SPORTS_SERIES = {
            'nba': ['KXNBAGAME', 'KXNBASPREAD', 'KXNBATOTAL',
                    'KXNBAPTS', 'KXNBAREB', 'KXNBAAST', 'KXNBA3PT',
                    'KXNBASTL', 'KXNBABLK', 'KXNBAMVP'],
            'nfl': ['KXNFLGAME', 'KXNFLSPREAD', 'KXNFLTOTAL'],
            'nhl': ['KXNHLGAME', 'KXNHLSPREAD', 'KXNHLTOTAL', 'KXNHLGOAL'],
            'mlb': ['KXMLBGAME', 'KXMLBSPREAD', 'KXMLBTOTAL', 'KXMLBSTGAME'],
            'mls': ['KXMLSGAME', 'KXMLSSPREAD', 'KXMLSTOTAL', 'KXMLSBTTS'],
            'ncaab': ['KXNCAAMBGAME', 'KXNCAAMBSPREAD', 'KXNCAAMBTOTAL',
                      'KXNCAAMB1HWINNER', 'KXNCAAMB1HSPREAD', 'KXNCAAMB1HTOTAL',
                      'KXMARMAD', 'KXNCAAWBGAME'],
            'ncaaf': ['KXNCAAFGAME', 'KXNCAAFSPREAD', 'KXNCAAFTOTAL'],
            'epl': ['KXEPLGAME', 'KXEPLSPREAD', 'KXEPLTOTAL', 'KXEPLGOAL', 'KXEPLBTTS'],
            'ucl': ['KXUCLGAME', 'KXUCLSPREAD', 'KXUCLTOTAL', 'KXUCLGOAL', 'KXUCLBTTS'],
            'tennis': ['KXATPMATCH', 'KXWTAMATCH'],
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
                    # Enrich each market with the type based on series prefix
                    mtype = SERIES_TYPE_MAP.get(series, 'prop')
                    for m in markets:
                        m['market_type'] = mtype
                        m['series_ticker'] = series  # API returns None, fill it
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
        
        # Filter out stale/postponed markets (e.g. postponed games still technically 'open'
        # but with expected_expiration_time far in the past and zero recent activity)
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        before_filter = len(unique_markets)
        filtered_markets = []
        for m in unique_markets:
            exp_str = m.get('expected_expiration_time', '')
            if exp_str:
                try:
                    exp_time = datetime.fromisoformat(exp_str.replace('Z', '+00:00'))
                    days_past = (now - exp_time).days
                    # If expected expiration was > 30 days ago, always skip (clearly stale)
                    if days_past > 30:
                        continue
                    # If expected expiration was > 7 days ago AND no recent volume, skip
                    if days_past > 7 and m.get('volume_24h', 0) == 0 and m.get('liquidity', 0) == 0:
                        continue
                except:
                    pass
            filtered_markets.append(m)
        unique_markets = filtered_markets
        if before_filter != len(unique_markets):
            print(f'🗑️ Filtered {before_filter - len(unique_markets)} stale/postponed markets')
        
        # Sort by event_ticker for grouping
        unique_markets.sort(key=lambda m: m.get('event_ticker', ''))
        unique_markets = unique_markets[:limit]

        # Overlay WS cache prices where available (fresher than Kalshi API snapshot)
        ws_overlaid = 0
        for m in unique_markets:
            t = m.get('ticker', '')
            ws_p = ws_manager.get_price(t) if ws_manager else None
            if ws_p and (ws_p.get('yes_bid', 0) > 0 or ws_p.get('no_bid', 0) > 0):
                m['yes_bid'] = ws_p['yes_bid']
                m['no_bid']  = ws_p['no_bid']
                m['yes_ask'] = ws_p['yes_ask']
                m['no_ask']  = ws_p['no_ask']
                # Clear dollar fields so frontend uses integer cents
                for df in ['yes_bid_dollars', 'no_bid_dollars', 'yes_ask_dollars', 'no_ask_dollars']:
                    m.pop(df, None)
                ws_overlaid += 1
        if ws_overlaid:
            print(f'📡 Overlaid WS prices on {ws_overlaid}/{len(unique_markets)} markets')

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


@app.route('/api/prices/batch', methods=['POST'])
def get_batch_prices():
    """Batch-fetch best bid/ask prices for multiple tickers using orderbook + WS cache.
    Request body: { "tickers": ["TICKER1", "TICKER2", ...] }
    Returns: { "prices": { "TICKER1": { yes_bid, no_bid, yes_ask, no_ask, source }, ... } }
    Caps at 20 tickers per call to respect rate limits.
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.get_json() or {}
        tickers = data.get('tickers', [])
        if not tickers:
            return jsonify({'prices': {}})

        # Cap at 60 tickers per batch — rate limiter handles throttling
        tickers = tickers[:60]

        prices = {}
        for ticker in tickers:
            # 1. Try WS cache first (fastest, real-time for subscribed tickers)
            ws_price = ws_manager.get_price(ticker) if ws_manager else None
            if ws_price and (ws_price.get('yes_bid', 0) > 0 or ws_price.get('no_bid', 0) > 0):
                prices[ticker] = {
                    'yes_bid': ws_price.get('yes_bid', 0),
                    'no_bid':  ws_price.get('no_bid', 0),
                    'yes_ask': ws_price.get('yes_ask', 0),
                    'no_ask':  ws_price.get('no_ask', 0),
                    'source': 'ws',
                }
                continue

            # 2. Fallback: fetch orderbook (depth=1 for just best level)
            try:
                api_rate_limiter.wait()
                ob_data = kalshi_client.get_market_orderbook(ticker, depth=1)
                ob = ob_data.get('orderbook', ob_data)
                y_levels = ob.get('yes', [])
                n_levels = ob.get('no', [])
                # Sort descending by price (best bid first)
                y_sorted = sorted(y_levels, key=lambda x: x[0] if isinstance(x, list) else x.get('price', 0), reverse=True)
                n_sorted = sorted(n_levels, key=lambda x: x[0] if isinstance(x, list) else x.get('price', 0), reverse=True)
                best_yes_bid = (y_sorted[0][0] if isinstance(y_sorted[0], list) else y_sorted[0].get('price', 0)) if y_sorted else 0
                best_no_bid  = (n_sorted[0][0] if isinstance(n_sorted[0], list) else n_sorted[0].get('price', 0)) if n_sorted else 0
                prices[ticker] = {
                    'yes_bid': best_yes_bid,
                    'no_bid':  best_no_bid,
                    'yes_ask': 100 - best_no_bid if best_no_bid > 0 else 0,
                    'no_ask':  100 - best_yes_bid if best_yes_bid > 0 else 0,
                    'source': 'orderbook',
                }
            except Exception as ob_err:
                # Skip this ticker silently
                continue

        return jsonify({'prices': prices})

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
                
                yes_data = (yes_status.get('order', yes_status) if isinstance(yes_status, dict) else {}) if yes_status else {}
                no_data  = (no_status.get('order', no_status) if isinstance(no_status, dict) else {}) if no_status else {}
                yes_filled = yes_data.get('fill_count', 0)
                no_filled = no_data.get('fill_count', 0)
                
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


# ─── ESPN Box Score proxy for live player stats ───────────────────────────────
_boxscore_cache = {}  # {game_id: {'data': {...}, 'ts': float}}
_BOXSCORE_TTL = 30    # seconds

@app.route('/api/boxscore/<sport>/<game_id>', methods=['GET'])
def get_boxscore(sport, game_id):
    """
    Proxy ESPN boxscore API to get live per-player stats.
    Returns a simplified dict: {player_name: {pts, reb, ast, stl, blk, ...}}.
    Cached for 30 seconds to avoid hammering ESPN.
    """
    sport_map = {
        'nba': 'basketball/nba',
        'ncaab': 'basketball/mens-college-basketball',
        'nfl': 'football/nfl',
        'mlb': 'baseball/mlb',
        'nhl': 'hockey/nhl',
    }
    sport_path = sport_map.get(sport.lower())
    if not sport_path:
        return jsonify({'error': f'Unknown sport: {sport}'}), 400

    cache_key = f'{sport}_{game_id}'
    now = time.time()
    cached = _boxscore_cache.get(cache_key)
    if cached and now - cached['ts'] < _BOXSCORE_TTL:
        return jsonify(cached['data'])

    try:
        url = f'https://site.api.espn.com/apis/site/v2/sports/{sport_path}/summary?event={game_id}'
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        raw = resp.json()

        players = {}
        # Parse boxscore from summary
        for team_box in raw.get('boxscore', {}).get('players', []):
            team_name = team_box.get('team', {}).get('abbreviation', '?')
            for stat_group in team_box.get('statistics', []):
                labels = stat_group.get('labels', [])   # e.g. ['MIN','FG','3PT','FT','OREB','DREB','REB','AST','STL','BLK','TO','PF','PTS']
                for athlete in stat_group.get('athletes', []):
                    name = athlete.get('athlete', {}).get('displayName', '?')
                    short_name = athlete.get('athlete', {}).get('shortName', name)
                    stats = athlete.get('stats', [])
                    stat_dict = {}
                    for i, label in enumerate(labels):
                        if i < len(stats):
                            stat_dict[label.lower()] = stats[i]
                    stat_dict['team'] = team_name
                    stat_dict['name'] = name
                    stat_dict['short_name'] = short_name
                    # Use lowercase full name as key for easy lookup
                    players[name.lower()] = stat_dict

        # Also include game status
        game_status = ''
        header = raw.get('header', {})
        competitions = header.get('competitions', [{}])
        if competitions:
            game_status = competitions[0].get('status', {}).get('type', {}).get('shortDetail', '')

        result = {
            'players': players,
            'game_status': game_status,
            'game_id': game_id,
        }
        _boxscore_cache[cache_key] = {'data': result, 'ts': now}
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e), 'players': {}}), 200


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

# ─── WebSocket Manager: real-time price/fill/order monitoring ─────────────────
import websocket as _ws_lib

class KalshiWSManager:
    """
    Manages a single authenticated WebSocket connection to Kalshi.
    Subscribes to orderbook_delta, ticker, fill, and user_orders channels
    for the tickers that active bots care about.

    Keeps a local price cache so the monitor loop can read prices instantly
    instead of making REST calls.
    """

    def __init__(self):
        self._ws = None
        self._thread = None
        self._connected = False
        self._cmd_id = 0
        self._lock = threading.Lock()

        # Local caches updated by WS messages
        self.ticker_cache = {}    # {market_ticker: {yes_bid, yes_ask, no_bid, no_ask, ...}}
        self.fill_events = []     # Recent fill events (capped at 200)
        self.order_events = []    # Recent user_order events (capped at 200)
        self._subscribed_tickers = set()
        self._sids = {}           # {channel: sid}

    @property
    def connected(self):
        return self._connected and self._ws is not None

    def _next_id(self):
        self._cmd_id += 1
        return self._cmd_id

    # ── Connect ──────────────────────────────────────────────────
    def connect(self, kalshi_api):
        """Open WS connection using credentials from the KalshiAPI instance."""
        if self._connected:
            return
        self._api = kalshi_api
        url = kalshi_api.ws_url
        headers = kalshi_api.ws_auth_headers()
        # websocket-client expects header list ["Key: Value", ...]
        header_list = [f'{k}: {v}' for k, v in headers.items()]

        def on_open(ws):
            self._connected = True
            print('🔌 Kalshi WS connected')

        def on_message(ws, message):
            try:
                data = json.loads(message)
                self._handle_message(data)
            except Exception as e:
                print(f'⚠ WS message parse error: {e}')

        def on_error(ws, error):
            print(f'⚠ Kalshi WS error: {error}')

        def on_close(ws, close_status_code, close_msg):
            self._connected = False
            print(f'🔌 Kalshi WS closed: {close_status_code} {close_msg}')
            # Auto-reconnect after 5 seconds
            threading.Timer(5.0, lambda: self._auto_reconnect(kalshi_api)).start()

        try:
            self._ws = _ws_lib.WebSocketApp(
                url,
                header=header_list,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
            )
            self._thread = threading.Thread(
                target=self._ws.run_forever,
                kwargs={'ping_interval': 10, 'ping_timeout': 5,
                        'ping_payload': 'heartbeat'},
                daemon=True,
            )
            self._thread.start()
        except Exception as e:
            print(f'❌ WS connect failed: {e}')

    def _auto_reconnect(self, kalshi_api):
        """Try to reconnect after a disconnect."""
        if self._connected:
            return
        print('🔄 WS auto-reconnect...')
        try:
            self.connect(kalshi_api)
            # Re-subscribe after reconnect
            time.sleep(1)
            if self._subscribed_tickers:
                self.subscribe(list(self._subscribed_tickers))
        except Exception as e:
            print(f'❌ WS reconnect failed: {e}')

    def disconnect(self):
        """Close the WS connection."""
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
        self._connected = False
        self._ws = None

    # ── Subscribe / Unsubscribe ────────────────────────────────
    def subscribe(self, tickers):
        """Subscribe to ticker, fill, and user_orders channels for given market tickers."""
        if not self._connected or not self._ws:
            return
        tickers = [t for t in tickers if t]
        if not tickers:
            return
        new_tickers = [t for t in tickers if t not in self._subscribed_tickers]
        if not new_tickers and self._sids:
            return  # Already subscribed

        with self._lock:
            # Market-data channels (need market_tickers)
            for channel in ['ticker']:
                cmd = {
                    'id': self._next_id(),
                    'cmd': 'subscribe',
                    'params': {
                        'channels': [channel],
                        'market_tickers': new_tickers,
                    }
                }
                self._ws.send(json.dumps(cmd))

            # Private channels — fill and user_orders for these tickers
            for channel in ['fill', 'user_orders']:
                cmd = {
                    'id': self._next_id(),
                    'cmd': 'subscribe',
                    'params': {
                        'channels': [channel],
                        'market_tickers': new_tickers,
                    }
                }
                self._ws.send(json.dumps(cmd))

            self._subscribed_tickers.update(new_tickers)
            print(f'📡 WS subscribed to {len(new_tickers)} tickers: {new_tickers[:5]}...')

    def add_ticker(self, ticker):
        """Add a single ticker to existing subscriptions (or start fresh)."""
        if ticker in self._subscribed_tickers:
            return
        if not self._sids:
            # No existing subs — do a fresh subscribe
            self.subscribe([ticker])
            return
        # Use update_subscription to add to existing sids
        with self._lock:
            for channel, sid in self._sids.items():
                if channel in ('ticker', 'fill', 'user_orders'):
                    cmd = {
                        'id': self._next_id(),
                        'cmd': 'update_subscription',
                        'params': {
                            'sids': [sid],
                            'market_tickers': [ticker],
                            'action': 'add_markets',
                        }
                    }
                    self._ws.send(json.dumps(cmd))
            self._subscribed_tickers.add(ticker)

    # ── Message handler ──────────────────────────────────────
    def _handle_message(self, data):
        msg_type = data.get('type', '')
        msg = data.get('msg', {})

        if msg_type == 'subscribed':
            channel = msg.get('channel', '')
            sid = data.get('msg', {}).get('sid') or data.get('sid')
            if sid and channel:
                self._sids[channel] = sid
            return

        if msg_type == 'ticker':
            ticker = msg.get('market_ticker', '')
            if ticker:
                self.ticker_cache[ticker] = {
                    'yes_bid': msg.get('yes_bid', 0),
                    'yes_ask': msg.get('yes_ask', 0),
                    'no_bid': 100 - msg.get('yes_ask', 0) if not msg.get('no_bid') else 0,
                    'no_ask': 100 - msg.get('yes_bid', 0) if not msg.get('no_ask') else 0,
                    'price': msg.get('price', 0),
                    'volume': msg.get('volume', 0),
                    'ts': msg.get('ts', 0),
                    '_local_ts': time.time(),
                }
                # Compute no_bid/no_ask properly (Kalshi reports yes side)
                # no_bid = 100 - yes_ask, no_ask = 100 - yes_bid
                self.ticker_cache[ticker]['no_bid'] = 100 - msg.get('yes_ask', 100)
                self.ticker_cache[ticker]['no_ask'] = 100 - msg.get('yes_bid', 0)
            return

        if msg_type == 'fill':
            self.fill_events.insert(0, msg)
            if len(self.fill_events) > 200:
                self.fill_events = self.fill_events[:200]
            ticker = msg.get('market_ticker', '')
            order_id = msg.get('order_id', '')
            side = msg.get('side', '')
            count = msg.get('count', 0)
            print(f'💰 WS FILL: {side} {count}x {ticker} (order {order_id[:8]}...)')
            return

        if msg_type == 'user_order':
            self.order_events.insert(0, msg)
            if len(self.order_events) > 200:
                self.order_events = self.order_events[:200]
            return

        if msg_type == 'error':
            code = msg.get('code', '?')
            emsg = msg.get('msg', '')
            print(f'⚠ WS error [{code}]: {emsg}')
            return

    # ── Price lookups ───────────────────────────────────────────
    def get_price(self, ticker, max_age_s=60):
        """Get cached price data for a ticker. Returns None if not cached or stale (>max_age_s)."""
        entry = self.ticker_cache.get(ticker)
        if entry and max_age_s > 0:
            cache_age = time.time() - entry.get('_local_ts', 0)
            if cache_age > max_age_s:
                return None  # stale — force REST fallback
        return entry

    def get_fills_for_order(self, order_id):
        """Get all WS fill events for a given order_id."""
        return [f for f in self.fill_events if f.get('order_id') == order_id]

    def get_total_fills(self, order_id):
        """Sum up fill counts for an order_id from WS events."""
        return sum(f.get('count', 0) for f in self.fill_events if f.get('order_id') == order_id)


# Global WS manager instance
ws_manager = KalshiWSManager()

# ─── Monitor lock: prevent concurrent monitor calls from double-executing ─────
monitor_lock = threading.Lock()

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
SL_GRACE_MINUTES     = 2    # Arb SL: bid must stay below trigger for this long before firing
                            # Gives volatility time to bounce back before cutting the arb

# ─── ESPN Live Game Cache (for auto-phase detection) ──────────────────────────
_espn_cache = {'data': {}, 'ts': 0}  # {team_abbr: {'live': bool, 'game_time': str, 'status': str}}
_ESPN_CACHE_TTL = 60  # seconds

# Kalshi 3-letter codes that differ from ESPN abbreviations
_KALSHI_TO_ESPN = {
    'WAS': 'WSH', 'NYK': 'NY', 'NOP': 'NO', 'SAS': 'SA',
    'GSW': 'GS', 'UTA': 'UTAH', 'PHX': 'PHO',
}

# Reverse map ESPN → Kalshi for game time lookups
_ESPN_TO_KALSHI = {v: k for k, v in _KALSHI_TO_ESPN.items()}


def _parse_game_date(event_ticker: str) -> str:
    """Parse game date from event ticker like KXNBAGAME-26MAR05LALDEN → 'Mar 5'.
    Returns empty string if unable to parse."""
    import re as _re
    parts = event_ticker.split('-')
    if len(parts) < 2:
        return ''
    date_match = _re.match(r'^(\d{2})([A-Z]{3})(\d{2})', parts[1])
    if not date_match:
        return ''
    year_2d = date_match.group(1)
    month_abbr = date_match.group(2)  # 'MAR', 'APR', etc.
    day = int(date_match.group(3))
    # Format nicely: "Mar 5"
    month_map = {'JAN': 'Jan', 'FEB': 'Feb', 'MAR': 'Mar', 'APR': 'Apr',
                 'MAY': 'May', 'JUN': 'Jun', 'JUL': 'Jul', 'AUG': 'Aug',
                 'SEP': 'Sep', 'OCT': 'Oct', 'NOV': 'Nov', 'DEC': 'Dec'}
    month = month_map.get(month_abbr.upper(), month_abbr.capitalize())
    return f'{month} {day}'

def _refresh_espn_cache():
    """Fetch all ESPN scoreboards and cache team info including game times."""
    global _espn_cache
    if time.time() - _espn_cache['ts'] < _ESPN_CACHE_TTL:
        return
    team_info = {}  # {ABBR: {'live': bool, 'game_time': 'HH:MM', 'status': 'pre'|'in'|'post'}}
    sport_paths = {
        'nba': 'basketball/nba',
        'nhl': 'hockey/nhl',
        'nfl': 'football/nfl',
        'mlb': 'baseball/mlb',
        'ncaab': 'basketball/mens-college-basketball',
    }
    for sport, path in sport_paths.items():
        try:
            url = f'https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard'
            resp = requests.get(url, timeout=4)
            resp.raise_for_status()
            events = resp.json().get('events', [])
            for ev in events:
                comp = (ev.get('competitions') or [{}])[0]
                status = (ev.get('status') or {}).get('type', {}).get('state', 'pre')
                is_live = status == 'in'
                # Game start time (ISO 8601) → local time string
                game_dt_str = ev.get('date', '')  # e.g. "2026-03-05T00:00Z"
                game_time = ''
                if game_dt_str:
                    try:
                        from datetime import datetime as _dt, timezone as _tz, timedelta as _td
                        dt_utc = _dt.fromisoformat(game_dt_str.replace('Z', '+00:00'))
                        # Convert to ET (UTC-5, approximate — good enough for display)
                        dt_et = dt_utc - _td(hours=5)
                        game_time = dt_et.strftime('%-I:%M %p')
                    except Exception:
                        pass
                for team in comp.get('competitors', []):
                    abbr = (team.get('team') or {}).get('abbreviation', '')
                    if abbr:
                        abbr_upper = abbr.upper()
                        # Get scores for game context
                        competitors = comp.get('competitors', [])
                        home_score = 0
                        away_score = 0
                        for c in competitors:
                            try:
                                sc = int(c.get('score', 0))
                            except (ValueError, TypeError):
                                sc = 0
                            if c.get('homeAway') == 'home':
                                home_score = sc
                            else:
                                away_score = sc
                        # Period/quarter info
                        ev_status = ev.get('status', {})
                        period = ev_status.get('period', 0)
                        clock = ev_status.get('displayClock', '')
                        status_detail = (ev_status.get('type', {}).get('shortDetail', ''))

                        team_info[abbr_upper] = {
                            'live': is_live,
                            'game_time': game_time,
                            'status': status,
                            'period': period,
                            'clock': clock,
                            'status_detail': status_detail,
                            'home_score': home_score,
                            'away_score': away_score,
                            'score_diff': abs(home_score - away_score),
                        }
                        # Also store under Kalshi code if different
                        kalshi_code = _ESPN_TO_KALSHI.get(abbr_upper)
                        if kalshi_code:
                            team_info[kalshi_code] = team_info[abbr_upper]
        except Exception:
            continue
    _espn_cache = {'data': team_info, 'ts': time.time()}
    live_teams = [k for k, v in team_info.items() if v.get('live')]
    if live_teams:
        print(f'🏟 ESPN cache refreshed: {len(live_teams)} live teams: {", ".join(sorted(live_teams))}')


def _parse_ticker_teams(ticker: str):
    """Extract team codes from a Kalshi ticker. Returns (t1, t2) or (None, None)."""
    parts = ticker.split('-')
    if len(parts) < 2:
        return None, None
    import re as _re
    stripped = _re.sub(r'^\d{2}[A-Z]{3}\d{2}', '', parts[1])
    if len(stripped) < 6:
        return None, None
    return stripped[:3].upper(), stripped[3:6].upper()


def _is_game_live(ticker: str) -> bool:
    """Check if the game referenced by a Kalshi ticker is currently live."""
    _refresh_espn_cache()
    info = _espn_cache['data']
    if not info:
        return False
    t1, t2 = _parse_ticker_teams(ticker)
    if not t1:
        return False
    for code in [t1, t2]:
        espn_code = _KALSHI_TO_ESPN.get(code, code)
        entry = info.get(code) or info.get(espn_code)
        if entry and entry.get('live'):
            return True
    return False


def _get_game_context(ticker: str) -> dict:
    """Get live game context (quarter, score diff, clock) for trade logging."""
    _refresh_espn_cache()
    info = _espn_cache['data']
    if not info:
        return {}
    t1, t2 = _parse_ticker_teams(ticker)
    if not t1:
        return {}
    for code in [t1, t2]:
        espn_code = _KALSHI_TO_ESPN.get(code, code)
        entry = info.get(code) or info.get(espn_code)
        if entry and entry.get('status') == 'in':
            return {
                'period': entry.get('period', 0),
                'clock': entry.get('clock', ''),
                'score_diff': entry.get('score_diff', 0),
                'status_detail': entry.get('status_detail', ''),
            }
    return {}


def _get_game_time(ticker: str) -> str:
    """Get game start time from ESPN cache for a given ticker. Returns e.g. '7:30 PM' or ''."""
    _refresh_espn_cache()
    info = _espn_cache['data']
    if not info:
        return ''
    t1, t2 = _parse_ticker_teams(ticker)
    if not t1:
        return ''
    for code in [t1, t2]:
        espn_code = _KALSHI_TO_ESPN.get(code, code)
        entry = info.get(code) or info.get(espn_code)
        if entry and entry.get('game_time'):
            return entry['game_time']
    return ''


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


# ═══════════════════════════════════════════════════════════════════
# STRAIGHT BET — single-side limit order (no arb bot, no monitoring)
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/order/place', methods=['POST'])
def place_straight_order():
    """
    Place a simple one-sided limit order — buy YES or buy NO at a specified price.
    No dual-arb logic, no bot monitoring. Just a plain limit order on Kalshi.
    Optionally creates a watch-bot to auto stop-loss / take-profit.
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json
        ticker   = data.get('ticker')
        side     = data.get('side', 'yes')         # 'yes' or 'no'
        price    = int(data.get('price', 0))        # limit price in cents
        quantity = int(data.get('quantity', 1))
        add_watch = data.get('add_watch', False)    # auto-create watch bot for SL
        stop_loss_cents = int(data.get('stop_loss_cents', 5))
        take_profit_cents = int(data.get('take_profit_cents', 0))
        fair_value_cents = data.get('fair_value_cents')  # from OddsJam no-vig calc (optional)

        if not ticker:
            return jsonify({'error': 'Missing ticker'}), 400
        if price < 1 or price > 99:
            return jsonify({'error': f'Price must be 1-99¢, got {price}'}), 400
        if quantity < 1:
            return jsonify({'error': 'Quantity must be at least 1'}), 400

        # Place limit order
        order_kwargs = {
            'ticker': ticker,
            'side': side,
            'action': 'buy',
            'count': quantity,
        }
        if side == 'yes':
            order_kwargs['yes_price'] = price
        else:
            order_kwargs['no_price'] = price

        api_rate_limiter.wait()
        order_resp = kalshi_client.create_order(**order_kwargs)
        order_id = order_resp['order']['order_id']

        # Optionally create a watch bot for SL/TP + fill monitoring
        watch_bot_id = None
        if add_watch:
            # Check if the order filled immediately (at or above ask)
            api_rate_limiter.wait()
            order_check = kalshi_client.get_order(order_id)
            order_obj = order_check.get('order', order_check)
            initial_fill_qty = order_obj.get('amount_filled', 0)

            watch_bot_id = f"watch_{ticker}_{side}_{int(time.time())}"
            active_bots[watch_bot_id] = {
                'type':             'watch',
                'ticker':           ticker,
                'side':             side,
                'entry_price':      price,
                'quantity':         quantity,
                'stop_loss_cents':  stop_loss_cents,
                'take_profit_cents': take_profit_cents,
                'fair_value_cents': fair_value_cents,
                'has_sl_tp':        True,
                'status':           'watching',
                'created_at':       time.time(),
                'order_id':         order_id,
                'order_filled':     initial_fill_qty >= quantity,
                'fill_qty':         initial_fill_qty,
            }
            save_state()
            # Subscribe WS to this ticker so we get real-time prices
            if ws_manager.connected:
                ws_manager.add_ticker(ticker)

        cost_dollars = (price * quantity) / 100
        payout_dollars = quantity  # $1 per contract at settlement
        profit_dollars = payout_dollars - cost_dollars

        return jsonify({
            'success':    True,
            'order_id':   order_id,
            'side':       side,
            'price':      price,
            'quantity':   quantity,
            'cost':       cost_dollars,
            'potential_profit': profit_dollars,
            'watch_bot_id': watch_bot_id,
            'message':    f'{side.upper()} limit buy: {quantity}× at {price}¢ (cost ${cost_dollars:.2f}, pays ${payout_dollars:.2f} if wins)'
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
        stop_loss_cents = max(1, int(data.get('stop_loss_cents', 5)))  # ¢ drop to trigger stop loss (min 1¢)
        # Auto-detect game phase from ESPN — no manual setting needed
        game_phase = 'live' if _is_game_live(ticker) else 'pregame'
        repeat_count   = int(data.get('repeat_count', 0))      # 0 = no repeat, N = repeat N more times (N+1 total runs)
        arb_width      = int(data.get('arb_width', 0))         # remember target width for repeat

        if not ticker or yes_price is None or no_price is None:
            return jsonify({'error': 'Missing required fields: ticker, yes_price, no_price'}), 400

        profit_per = 100 - yes_price - no_price
        if profit_per <= 0:
            return jsonify({'error': f'Not an arb: yes({yes_price}¢) + no({no_price}¢) = {yes_price+no_price}¢ ≥ 100¢'}), 400

        # ── PRICE VALIDATION: fetch ORDERBOOK for real-time best bids ──────────
        # The market endpoint returns stale prices; orderbook is real-time
        try:
            api_rate_limiter.wait()
            ob_data = kalshi_client.get_market_orderbook(ticker)
            ob = ob_data.get('orderbook', ob_data)
            yes_levels = sorted(ob.get('yes', []), key=lambda x: x[0] if isinstance(x, list) else x.get('price', 0), reverse=True)
            no_levels  = sorted(ob.get('no',  []), key=lambda x: x[0] if isinstance(x, list) else x.get('price', 0), reverse=True)
            live_yes_bid = (yes_levels[0][0] if isinstance(yes_levels[0], list) else yes_levels[0].get('price', 0)) if yes_levels else 0
            live_no_bid  = (no_levels[0][0]  if isinstance(no_levels[0], list)  else no_levels[0].get('price', 0))  if no_levels  else 0

            # Rule: NEVER place a limit buy ABOVE the current bid.
            if yes_price > live_yes_bid and live_yes_bid > 0:
                return jsonify({'error': f'YES price {yes_price}¢ is ABOVE current bid {live_yes_bid}¢ — market has moved. Refresh and retry.'}), 400
            if no_price > live_no_bid and live_no_bid > 0:
                return jsonify({'error': f'NO price {no_price}¢ is ABOVE current bid {live_no_bid}¢ — market has moved. Refresh and retry.'}), 400

            # Also check the spread still makes sense
            live_total = live_yes_bid + live_no_bid
            if live_total >= 100:
                return jsonify({'error': f'Market bids now total {live_total}¢ ≥ 100 — no arb exists. Refresh and retry.'}), 400

            print(f'✅ Price validation (orderbook): YES {yes_price}¢ ≤ bid {live_yes_bid}¢, NO {no_price}¢ ≤ bid {live_no_bid}¢')
        except Exception as pv_err:
            print(f'⚠ Price validation skipped: {pv_err}')

        # ── FAVORITE-FIRST ANCHORING ──────────────────────────────
        # Post ONLY the favorite side (higher bid = more liquidity, fills faster,
        # less adverse selection). The underdog order is posted by the monitor
        # AFTER the favorite fills. This prevents the dangerous scenario where
        # the underdog fills first and the market moves against us (82% loss rate
        # when NO fills first in historical data).
        fav_side = 'yes' if live_yes_bid >= live_no_bid else 'no'
        dog_side = 'no' if fav_side == 'yes' else 'yes'
        fav_price = yes_price if fav_side == 'yes' else no_price
        dog_price = no_price if fav_side == 'yes' else yes_price

        if fav_side == 'yes':
            fav_order = kalshi_client.create_order(
                ticker=ticker, side='yes', action='buy',
                count=quantity, yes_price=yes_price
            )
        else:
            fav_order = kalshi_client.create_order(
                ticker=ticker, side='no', action='buy',
                count=quantity, no_price=no_price
            )
        fav_order_id = fav_order['order']['order_id']

        print(f'🎯 FAV-FIRST: {fav_side.upper()} posted at {fav_price}¢ '
              f'(bid={live_yes_bid if fav_side=="yes" else live_no_bid}¢) — '
              f'{dog_side.upper()} at {dog_price}¢ queued for after fill')

        # Subscribe WS to this ticker for real-time price updates
        if ws_manager.connected:
            ws_manager.add_ticker(ticker)

        bot_id = f"{ticker}_{int(time.time())}"
        active_bots[bot_id] = {
            'ticker':           ticker,
            'yes_price':        yes_price,
            'no_price':         no_price,
            'quantity':         quantity,
            'stop_loss_cents':  stop_loss_cents,
            'profit_per':       profit_per,
            'game_phase':       game_phase,
            'status':           'fav_posted',     # fav_posted → (yes_filled|no_filled) → completed | stopped
            'fav_side':         fav_side,
            'dog_side':         dog_side,
            'fav_price':        fav_price,
            'dog_price':        dog_price,
            'fav_order_id':     fav_order_id,
            'yes_order_id':     fav_order_id if fav_side == 'yes' else None,
            'no_order_id':      fav_order_id if fav_side == 'no' else None,
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
            'fav_side':     fav_side,
            'fav_order_id': fav_order_id,
            'profit_per':   profit_per,
            'game_phase':   game_phase,
            'repeat_count': repeat_count,
            'message':      f'[{game_phase.upper()}] FAV-FIRST: {fav_side.upper()} at {fav_price}¢ posted — '
                            f'{dog_side.upper()} at {dog_price}¢ queued after fill → {profit_per}¢ profit/contract'
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
        order_data = order_resp.get('order', order_resp) if isinstance(order_resp, dict) else {}
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
    remaining_to_sell = count  # Track how many we still need to sell
    total_sold = 0
    last_sell_price = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            # Before each attempt, check actual position to avoid overselling
            if attempt > 1:
                try:
                    api_rate_limiter.wait()
                    pos_resp = kalshi_client.get_positions(ticker=ticker)
                    positions = pos_resp.get('market_positions', pos_resp.get('positions', []))
                    actual_held = 0
                    for p in positions:
                        if p.get('ticker') == ticker:
                            pos_qty = p.get('position', 0)
                            if side == 'yes' and pos_qty > 0:
                                actual_held = pos_qty
                            elif side == 'no' and pos_qty < 0:
                                actual_held = abs(pos_qty)
                    if actual_held == 0:
                        # Position already fully sold (previous partial fills cleared it)
                        print(f'✅ execute_sell({reason}): position already cleared after partial fills')
                        return True, {'order_id': 'partial_cleared', 'filled': count,
                                      'sell_price': last_sell_price or 0,
                                      'verified_cleared': True, 'remaining': 0,
                                      'actual_fill_price': last_sell_price}
                    remaining_to_sell = actual_held
                    print(f'   Retry attempt {attempt}: actual position = {actual_held} {side} (was {count})')
                except Exception as pos_err:
                    print(f'⚠ Position check before retry failed: {pos_err} — using original count')

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
                # Bid is 0 — try selling at 1¢ (minimum). If this is a settled/
                # nearly-settled market, Kalshi will either fill it or reject it.
                # Better than spinning forever holding a worthless position.
                cur_bid = 1
                print(f'⚠ execute_sell({reason}) attempt {attempt}: {side} bid is 0¢ — trying sell at 1¢ (emergency exit)')

            # Place limit sell at the current bid
            sell_kwargs = {
                'ticker': ticker,
                'side': side,
                'action': 'sell',
                'count': remaining_to_sell,
            }
            if side == 'yes':
                sell_kwargs['yes_price'] = cur_bid
            else:
                sell_kwargs['no_price'] = cur_bid

            api_rate_limiter.wait()
            resp = kalshi_client.create_order(**sell_kwargs)
            resp_ord = resp.get('order', resp) if isinstance(resp, dict) else {}
            order_id = resp_ord.get('order_id')

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
            order_data = check.get('order', check) if isinstance(check, dict) else {}
            filled = order_data.get('filled_count', order_data.get('fill_count', 0))

            if filled >= remaining_to_sell:
                # VERIFY: confirm position is actually gone on Kalshi
                cleared, remaining = verify_position_cleared(ticker, side, count)
                actual_price = get_actual_fill_price(order_id, side)
                sell_price = actual_price if actual_price else cur_bid
                print(f'✅ execute_sell({reason}): {side} {remaining_to_sell}x {ticker} SOLD at {sell_price}¢ (attempt {attempt}) | verified={cleared}')
                return True, {'order_id': order_id, 'filled': filled, 'sell_price': sell_price,
                              'verified_cleared': cleared, 'remaining': remaining,
                              'actual_fill_price': actual_price}

            # Wait a bit more and check again
            time.sleep(1.5)
            api_rate_limiter.wait()
            check2 = kalshi_client.get_order(order_id)
            order_data2 = check2.get('order', check2) if isinstance(check2, dict) else {}
            filled2 = order_data2.get('filled_count', order_data2.get('fill_count', 0))

            if filled2 >= remaining_to_sell:
                # VERIFY: confirm position is actually gone on Kalshi
                cleared, remaining = verify_position_cleared(ticker, side, count)
                actual_price = get_actual_fill_price(order_id, side)
                sell_price = actual_price if actual_price else cur_bid
                print(f'✅ execute_sell({reason}): {side} {remaining_to_sell}x {ticker} SOLD at {sell_price}¢ (attempt {attempt}, 2nd check) | verified={cleared}')
                return True, {'order_id': order_id, 'filled': filled2, 'sell_price': sell_price,
                              'verified_cleared': cleared, 'remaining': remaining,
                              'actual_fill_price': actual_price}

            # Not fully filled — cancel remaining and retry at the NEW bid
            last_sell_price = cur_bid  # Track for partial fill P&L
            total_sold += filled2
            print(f'⚠ execute_sell({reason}) attempt {attempt}: {side} {remaining_to_sell}x {ticker} not filled at {cur_bid}¢ ({filled2}/{remaining_to_sell}), cancelling...')
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

        # ── CRITICAL: prevent concurrent monitor calls from double-executing ──
        acquired = monitor_lock.acquire(blocking=False)
        if not acquired:
            return jsonify({'success': True, 'actions': [], 'active_bots': 0, 'skipped': 'monitor already running'})

        try:
            return _run_monitor()
        finally:
            monitor_lock.release()

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _run_monitor():
    """Internal monitor logic — must only be called while holding monitor_lock."""
    try:
        # Auto-reset P&L if the date has changed
        auto_reset_daily_pnl()

        actions = []
        active_statuses = ('fav_posted', 'pending_fills', 'yes_filled', 'no_filled', 'watching', 'waiting_repeat')

        # ── Auto-phase: switch pregame → live when ESPN shows game in progress ──
        for bot_id, bot in list(active_bots.items()):
            if bot.get('game_phase') == 'pregame' and bot['status'] in active_statuses:
                if bot.get('type') == 'watch':
                    continue
                try:
                    if _is_game_live(bot['ticker']):
                        bot['game_phase'] = 'live'
                        bot['posted_at'] = time.time()  # restart timeout counters
                        actions.append({'bot_id': bot_id, 'action': 'auto_phase_live'})
                        print(f'🏟 AUTO-PHASE: {bot_id} switched to LIVE (ESPN detected game in progress)')
                except Exception:
                    pass

        for bot_id, bot in list(active_bots.items()):
            if bot['status'] not in active_statuses:
                continue
            try:
                ticker  = bot['ticker']
                qty     = bot['quantity']
                stop    = max(1, bot.get('stop_loss_cents', 5))  # enforce min 1¢
                now     = time.time()
                age_min = (now - bot.get('posted_at', now)) / 60.0
                phase   = bot.get('game_phase', 'pregame')

                # ── Settlement guard: skip if market is closed/settled ──
                if bot.get('type') != 'watch':  # arb bots only
                    try:
                        api_rate_limiter.wait()
                        mkt_check = kalshi_client.get_market(ticker)
                        mkt_status = mkt_check.get('market', mkt_check).get('status', 'active')
                        if mkt_status in ('closed', 'settled', 'finalized'):
                            # Check if one leg was filled — that's a LOSS, not a completion
                            try:
                                # Handle fav_posted bots where one order ID may be None
                                yes_f = 0
                                no_f = 0
                                if bot.get('yes_order_id'):
                                    api_rate_limiter.wait()
                                    yes_resp_s = kalshi_client.get_order(bot['yes_order_id'])
                                    yes_ord_s = yes_resp_s.get('order', yes_resp_s) if isinstance(yes_resp_s, dict) else {}
                                    yes_f = yes_ord_s.get('filled_count', yes_ord_s.get('fill_count', 0))
                                if bot.get('no_order_id'):
                                    api_rate_limiter.wait()
                                    no_resp_s = kalshi_client.get_order(bot['no_order_id'])
                                    no_ord_s = no_resp_s.get('order', no_resp_s) if isinstance(no_resp_s, dict) else {}
                                    no_f = no_ord_s.get('filled_count', no_ord_s.get('fill_count', 0))
                            except Exception:
                                yes_f = bot.get('yes_fill_qty', 0)
                                no_f  = bot.get('no_fill_qty', 0)

                            if yes_f >= qty and no_f >= qty:
                                # Both legs filled — true completion, profit locked
                                actual_yes = get_actual_fill_price(bot['yes_order_id'], 'yes')
                                actual_no  = get_actual_fill_price(bot['no_order_id'], 'no')
                                real_yes = actual_yes if actual_yes else bot['yes_price']
                                real_no  = actual_no  if actual_no  else bot['no_price']
                                profit_cents = (100 - real_yes - real_no) * qty
                                bot['status'] = 'completed'
                                bot['completed_at'] = now
                                bot['repeat_count'] = 0
                                session_pnl['gross_profit_cents'] += profit_cents
                                session_pnl['completed_bots'] += 1
                                trade_history.insert(0, {
                                    'bot_id': bot_id, 'ticker': ticker,
                                    'yes_price': real_yes, 'no_price': real_no,
                                    'quantity': qty, 'profit_cents': profit_cents,
                                    'result': 'completed', 'timestamp': now,
                                    'note': f'market {mkt_status} — both legs filled',
                                    'game_phase': bot.get('game_phase', ''),
                                })
                                print(f'🏁 SETTLED COMPLETE: {bot_id} — both legs filled, +{profit_cents}¢')
                            elif yes_f >= qty and no_f < qty:
                                # YES filled, NO never filled — market settled as loss
                                # Can't sell now (market closed) — record the loss
                                # YES side: if YES outcome won, we get $1 per contract (profit)
                                #           if NO outcome won, we lose our cost (yes_price * qty)
                                # We already bought YES at yes_price. Market settled.
                                # The position auto-settles on Kalshi, so just record it.
                                if bot.get('no_order_id'):
                                    try:
                                        api_rate_limiter.wait()
                                        kalshi_client.cancel_order(bot['no_order_id'])
                                    except Exception:
                                        pass
                                bot['status'] = 'stopped'
                                bot['repeat_count'] = 0
                                bot['stopped_at'] = now
                                loss = bot['yes_price'] * yes_f  # worst-case: lost the entire cost
                                session_pnl['gross_loss_cents'] += loss
                                session_pnl['stopped_bots'] += 1
                                trade_history.insert(0, {
                                    'bot_id': bot_id, 'ticker': ticker,
                                    'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                    'quantity': yes_f, 'loss_cents': loss,
                                    'result': 'settled_loss_yes', 'timestamp': now,
                                    'note': f'market {mkt_status} — YES filled but NO never filled',
                                    'game_phase': bot.get('game_phase', ''),
                                })
                                print(f'⚠ SETTLED LOSS: {bot_id} — YES filled ({yes_f}×{bot["yes_price"]}¢) but NO unfilled, market {mkt_status}')
                            elif no_f >= qty and yes_f < qty:
                                # NO filled, YES never filled — same as above but for NO side
                                if bot.get('yes_order_id'):
                                    try:
                                        api_rate_limiter.wait()
                                        kalshi_client.cancel_order(bot['yes_order_id'])
                                    except Exception:
                                        pass
                                bot['status'] = 'stopped'
                                bot['repeat_count'] = 0
                                bot['stopped_at'] = now
                                loss = bot['no_price'] * no_f
                                session_pnl['gross_loss_cents'] += loss
                                session_pnl['stopped_bots'] += 1
                                trade_history.insert(0, {
                                    'bot_id': bot_id, 'ticker': ticker,
                                    'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                    'quantity': no_f, 'loss_cents': loss,
                                    'result': 'settled_loss_no', 'timestamp': now,
                                    'note': f'market {mkt_status} — NO filled but YES never filled',
                                    'game_phase': bot.get('game_phase', ''),
                                })
                                print(f'⚠ SETTLED LOSS: {bot_id} — NO filled ({no_f}×{bot["no_price"]}¢) but YES unfilled, market {mkt_status}')
                            else:
                                # Neither leg filled — no cost, just clean up
                                bot['status'] = 'completed'
                                bot['completed_at'] = now
                                print(f'🏁 MARKET SETTLED: {bot_id} — no fills, clean exit')
                            actions.append({'bot_id': bot_id, 'action': 'market_settled', 'market_status': mkt_status})
                            save_state()
                            continue
                    except Exception:
                        pass  # If API fails, proceed with normal monitoring

                # ── FAV-FIRST: favorite order posted, waiting for fill ────
                if bot.get('status') == 'fav_posted':
                    fav_side = bot.get('fav_side', 'yes')
                    fav_order_id = bot.get('fav_order_id')
                    if not fav_order_id:
                        # Legacy bot without fav_posted data — skip
                        bot['status'] = 'pending_fills'
                        continue

                    # Check fill status of favorite order
                    try:
                        api_rate_limiter.wait()
                        fav_resp = kalshi_client.get_order(fav_order_id)
                        fav_ord = fav_resp.get('order', fav_resp) if isinstance(fav_resp, dict) else {}
                        fav_filled = fav_ord.get('filled_count', fav_ord.get('fill_count', 0))
                    except Exception as fav_err:
                        print(f'⚠ Fav order check failed for {bot_id}: {fav_err}')
                        continue

                    if fav_filled >= qty:
                        # ── Favorite filled! Now post the underdog ──
                        dog_side = bot.get('dog_side', 'no' if fav_side == 'yes' else 'yes')
                        dog_price = bot.get('dog_price', bot['no_price'] if dog_side == 'no' else bot['yes_price'])

                        # Fetch fresh orderbook to verify arb is still viable
                        try:
                            api_rate_limiter.wait()
                            ob_data = kalshi_client.get_market_orderbook(ticker)
                            ob = ob_data.get('orderbook', ob_data)
                            if dog_side == 'no':
                                dog_levels = sorted(ob.get('no', []),
                                    key=lambda x: x[0] if isinstance(x, list) else x.get('price', 0), reverse=True)
                                live_dog_bid = (dog_levels[0][0] if isinstance(dog_levels[0], list) else dog_levels[0].get('price', 0)) if dog_levels else 0
                            else:
                                dog_levels = sorted(ob.get('yes', []),
                                    key=lambda x: x[0] if isinstance(x, list) else x.get('price', 0), reverse=True)
                                live_dog_bid = (dog_levels[0][0] if isinstance(dog_levels[0], list) else dog_levels[0].get('price', 0)) if dog_levels else 0

                            # NEVER post above the current bid
                            if dog_price > live_dog_bid and live_dog_bid > 0:
                                dog_price = live_dog_bid
                                print(f'📉 Adjusted {dog_side.upper()} price to bid {live_dog_bid}¢ (was {bot.get("dog_price")}¢)')
                        except Exception as ob_err:
                            print(f'⚠ Orderbook check for underdog failed: {ob_err} — using planned price')

                        # Verify arb width still makes sense
                        fav_price = bot.get('fav_price', bot['yes_price'] if fav_side == 'yes' else bot['no_price'])
                        actual_profit = 100 - fav_price - dog_price
                        min_width = max(1, bot.get('arb_width', bot.get('profit_per', 3)) // 2)  # accept half the target width
                        if actual_profit < min_width:
                            print(f'⚠ FAV-FIRST arb no longer viable: {fav_side}@{fav_price} + {dog_side}@{dog_price} = {fav_price+dog_price}¢ '
                                  f'(profit {actual_profit}¢ < min {min_width}¢) — will SL the favorite')
                            # Arb collapsed — don't post underdog, let SL handle the filled favorite
                            if fav_side == 'yes':
                                bot['status'] = 'yes_filled'
                                bot['yes_fill_qty'] = fav_filled
                            else:
                                bot['status'] = 'no_filled'
                                bot['no_fill_qty'] = fav_filled
                            bot['first_fill_at'] = now
                            bot['first_leg'] = fav_side
                            bot['posted_at'] = now
                            continue

                        # Post the underdog order
                        try:
                            api_rate_limiter.wait()
                            if dog_side == 'no':
                                dog_order = kalshi_client.create_order(
                                    ticker=ticker, side='no', action='buy',
                                    count=qty, no_price=dog_price)
                                bot['no_order_id'] = dog_order['order']['order_id']
                                bot['no_price'] = dog_price
                                bot['yes_fill_qty'] = fav_filled
                                bot['status'] = 'yes_filled'
                            else:
                                dog_order = kalshi_client.create_order(
                                    ticker=ticker, side='yes', action='buy',
                                    count=qty, yes_price=dog_price)
                                bot['yes_order_id'] = dog_order['order']['order_id']
                                bot['yes_price'] = dog_price
                                bot['no_fill_qty'] = fav_filled
                                bot['status'] = 'no_filled'

                            bot['first_fill_at'] = now
                            bot['first_leg'] = fav_side
                            bot['posted_at'] = now
                            bot['profit_per'] = 100 - bot['yes_price'] - bot['no_price']

                            print(f'🎯 FAV-FIRST FILL: {bot_id} {fav_side.upper()} filled at {fav_price}¢ → '
                                  f'posted {dog_side.upper()} at {dog_price}¢ '
                                  f'(profit target: {bot["profit_per"]}¢)')
                            actions.append({'bot_id': bot_id, 'action': 'fav_filled_dog_posted',
                                           'fav_side': fav_side, 'fav_price': fav_price,
                                           'dog_side': dog_side, 'dog_price': dog_price,
                                           'profit_per': bot['profit_per']})
                            save_state()
                        except Exception as dog_err:
                            print(f'⚠ Underdog order failed for {bot_id}: {dog_err} — will retry next cycle')
                    else:
                        # Favorite not yet filled — check for repost if stale
                        if phase == 'live' and age_min >= REPOST_AFTER_MINUTES:
                            # Repost favorite at current bid (never above)
                            try:
                                ws_price = ws_manager.get_price(ticker)
                                if ws_price:
                                    cur_fav_bid = ws_price.get(f'{fav_side}_bid', 0)
                                else:
                                    api_rate_limiter.wait()
                                    mkt = kalshi_client.get_market(ticker)
                                    m = mkt.get('market', mkt)
                                    d = m.get(f'{fav_side}_bid_dollars')
                                    cur_fav_bid = round(float(d) * 100) if d else m.get(f'{fav_side}_bid', 0)

                                new_fav_price = min(cur_fav_bid, 98) if cur_fav_bid > 0 else bot['fav_price']
                                api_rate_limiter.wait()
                                kalshi_client.cancel_order(fav_order_id)
                                api_rate_limiter.wait()
                                if fav_side == 'yes':
                                    new_fav = kalshi_client.create_order(
                                        ticker=ticker, side='yes', action='buy',
                                        count=qty, yes_price=new_fav_price)
                                else:
                                    new_fav = kalshi_client.create_order(
                                        ticker=ticker, side='no', action='buy',
                                        count=qty, no_price=new_fav_price)
                                new_fav_id = new_fav['order']['order_id']
                                bot['fav_order_id'] = new_fav_id
                                if fav_side == 'yes':
                                    bot['yes_order_id'] = new_fav_id
                                    bot['yes_price'] = new_fav_price
                                    bot['fav_price'] = new_fav_price
                                else:
                                    bot['no_order_id'] = new_fav_id
                                    bot['no_price'] = new_fav_price
                                    bot['fav_price'] = new_fav_price
                                bot['posted_at'] = now
                                bot['repost_count'] = bot.get('repost_count', 0) + 1
                                print(f'🔄 FAV REPOST: {bot_id} {fav_side.upper()} at {new_fav_price}¢ '
                                      f'(repost #{bot["repost_count"]})')
                                actions.append({'bot_id': bot_id, 'action': 'fav_reposted',
                                               'fav_side': fav_side, 'new_price': new_fav_price})
                            except Exception as rp_err:
                                print(f'⚠ Fav repost failed for {bot_id}: {rp_err}')

                        # Cancel unfilled favorite after STALE_CANCEL_MINUTES if live
                        elif phase == 'live' and age_min >= STALE_CANCEL_MINUTES:
                            try:
                                api_rate_limiter.wait()
                                kalshi_client.cancel_order(fav_order_id)
                            except Exception:
                                pass
                            bot['status'] = 'completed'
                            bot['completed_at'] = now
                            print(f'⏰ FAV STALE: {bot_id} favorite {fav_side.upper()} unfilled after {age_min:.1f}m — cancelled')
                            actions.append({'bot_id': bot_id, 'action': 'fav_stale_cancelled'})
                    continue

                # ── Watch Bots: monitor existing positions ───────────
                if bot.get('type') == 'watch':
                    watch_side = bot.get('side', 'yes')
                    entry = bot.get('entry_price', 50)
                    sl = bot.get('stop_loss_cents', 5)
                    tp = bot.get('take_profit_cents', 0)
                    has_sl_tp = bot.get('has_sl_tp', sl > 0 or tp > 0)

                    # ── Settlement guard for watch bots ──────────────
                    try:
                        api_rate_limiter.wait()
                        mkt_check_w = kalshi_client.get_market(ticker)
                        mkt_status_w = mkt_check_w.get('market', mkt_check_w).get('status', 'active')
                        if mkt_status_w in ('closed', 'settled', 'finalized'):
                            if not bot.get('order_filled', False):
                                # Order never filled on a settled market — cancel & clean up
                                if bot.get('order_id'):
                                    try:
                                        api_rate_limiter.wait()
                                        kalshi_client.cancel_order(bot['order_id'])
                                    except Exception:
                                        pass
                                bot['status'] = 'stopped'
                                bot['stopped_at'] = now
                                print(f'🏁 WATCH SETTLED (unfilled): {bot_id} — market {mkt_status_w}, order never filled')
                                actions.append({'bot_id': bot_id, 'action': 'watch_settled_unfilled'})
                                save_state()
                                continue
                            else:
                                # Position was filled — market settled, Kalshi auto-settles it
                                bot['status'] = 'completed'
                                bot['completed_at'] = now
                                print(f'🏁 WATCH SETTLED (filled): {bot_id} — market {mkt_status_w}, position auto-settles on Kalshi')
                                actions.append({'bot_id': bot_id, 'action': 'watch_settled_filled'})
                                save_state()
                                continue
                    except Exception as ws_err:
                        pass  # If API fails, proceed with normal monitoring

                    # ── Manual watch bots (no order_id) are pre-filled positions ──
                    if not bot.get('order_id'):
                        if not bot.get('order_filled'):
                            bot['order_filled'] = True
                            bot['filled_at'] = now
                            bot['has_sl_tp'] = True
                            has_sl_tp = True
                            save_state()
                            print(f'👁 Watch {bot_id}: manual position — marking as filled')

                    # ── Step 1: Check if the limit order has filled ──
                    if not bot.get('order_filled', False) and bot.get('order_id'):
                        try:
                            api_rate_limiter.wait()
                            order_check = kalshi_client.get_order(bot['order_id'])
                            order_obj = order_check.get('order', order_check)
                            filled_qty = order_obj.get('amount_filled', 0)
                            bot['fill_qty'] = filled_qty
                            order_status = order_obj.get('status', '')

                            if filled_qty >= qty:
                                bot['order_filled'] = True
                                bot['filled_at'] = now
                                # Sync quantity to actual Kalshi position (user may have
                                # had fewer contracts than they ordered)
                                try:
                                    api_rate_limiter.wait()
                                    pos_resp = kalshi_client.get_positions(ticker=ticker)
                                    positions = pos_resp.get('market_positions', [])
                                    actual_pos = 0
                                    for p in positions:
                                        if watch_side == 'yes':
                                            actual_pos = max(actual_pos, p.get('yes_contracts', 0) + p.get('total_traded', 0) if p.get('yes_contracts', 0) > 0 else p.get('yes_contracts', 0))
                                        else:
                                            actual_pos = max(actual_pos, p.get('no_contracts', 0))
                                    if watch_side == 'yes':
                                        actual_pos = max(0, sum(p.get('yes_contracts', 0) for p in positions))
                                    else:
                                        actual_pos = max(0, sum(p.get('no_contracts', 0) for p in positions))
                                    if actual_pos > 0 and actual_pos != qty:
                                        print(f'🔄 Watch {bot_id}: syncing qty {qty}→{actual_pos} (actual position)')
                                        bot['quantity'] = actual_pos
                                except Exception as pos_err:
                                    print(f'⚠ Position sync for {bot_id}: {pos_err}')
                                actions.append({
                                    'bot_id': bot_id, 'action': 'straight_bet_filled',
                                    'ticker': ticker, 'side': watch_side,
                                    'price': entry, 'quantity': qty
                                })
                                print(f'💰 STRAIGHT BET FILLED: {bot_id} — {watch_side.upper()} {qty}× at {entry}¢')
                                save_state()
                            elif order_status in ('canceled', 'cancelled', 'expired', 'declined'):
                                # Order was cancelled/expired — remove tracker
                                bot['status'] = 'stopped'
                                bot['stopped_at'] = now
                                actions.append({
                                    'bot_id': bot_id, 'action': 'straight_bet_cancelled',
                                    'ticker': ticker, 'side': watch_side
                                })
                                print(f'❌ STRAIGHT BET CANCELLED: {bot_id} — {order_status}')
                                save_state()
                                continue
                        except Exception as fill_err:
                            print(f'⚠ Fill check error for {bot_id}: {fill_err}')

                    # ── Step 2: Always fetch live bid (even pre-fill) so UI shows it ──
                    try:
                        ws_price_pre = ws_manager.get_price(ticker)
                        if ws_price_pre:
                            bot['live_bid'] = ws_price_pre.get(f'{watch_side}_bid', 0)
                        else:
                            api_rate_limiter.wait()
                            mkt_pre = kalshi_client.get_market(ticker)
                            mkt_pre_data = mkt_pre.get('market', mkt_pre)
                            d_pre = mkt_pre_data.get(f'{watch_side}_bid_dollars')
                            if d_pre:
                                bot['live_bid'] = round(float(d_pre) * 100)
                            else:
                                bot['live_bid'] = mkt_pre_data.get(f'{watch_side}_bid', 0)
                        bot['last_price_update'] = now
                    except Exception as bid_err:
                        print(f'⚠ Watch live_bid fetch for {bot_id}: {bid_err}')

                    # If order hasn't filled yet, skip SL/TP monitoring
                    if not bot.get('order_filled', False):
                        continue

                    # ── Step 3: If no SL/TP configured, auto-complete after fill ──
                    if not has_sl_tp:
                        bot['status'] = 'completed'
                        bot['completed_at'] = now
                        save_state()
                        continue

                    # Use the live_bid we already fetched above
                    cur_bid = bot.get('live_bid', 0)

                    # Stop-loss: sell at 1¢ (gets price improvement to actual bid)
                    if cur_bid <= entry - sl:
                        # ── REST VERIFY: double-check bid via REST API before firing ──
                        # WS can send stale/incorrect bids (e.g. Clowney 15+ showed 21¢
                        # when real bid was 60¢). One REST call prevents false SL fires.
                        try:
                            api_rate_limiter.wait()
                            mkt_verify = kalshi_client.get_market(ticker)
                            mkt_v_data = mkt_verify.get('market', mkt_verify)
                            d_verify = mkt_v_data.get(f'{watch_side}_bid_dollars')
                            if d_verify:
                                rest_bid = round(float(d_verify) * 100)
                            else:
                                rest_bid = mkt_v_data.get(f'{watch_side}_bid', 0)
                            if rest_bid > entry - sl:
                                # REST says bid is actually fine — WS was stale
                                print(f'🛡 WATCH SL BLOCKED: {bot_id} WS bid {cur_bid}¢ but REST bid {rest_bid}¢ > trigger {entry - sl}¢ — WS was stale')
                                bot['live_bid'] = rest_bid  # correct the cached bid
                                cur_bid = rest_bid
                                actions.append({'bot_id': bot_id, 'action': 'watch_sl_blocked_stale_ws',
                                               'ws_bid': bot.get('live_bid', 0), 'rest_bid': rest_bid})
                                # Skip this SL — bid is not actually breached
                            else:
                                # REST confirms SL breach — update cur_bid to REST value
                                print(f'✅ WATCH SL CONFIRMED: {bot_id} REST bid {rest_bid}¢ ≤ trigger {entry - sl}¢ (WS was {cur_bid}¢)')
                                cur_bid = rest_bid
                                bot['live_bid'] = rest_bid
                        except Exception as rest_err:
                            print(f'⚠ Watch SL REST verify failed for {bot_id}: {rest_err} — proceeding with WS bid')

                        # Re-check after REST verify — bid may have been corrected
                        if cur_bid > entry - sl:
                            continue

                        # SAFETY: re-check bot hasn't already been stopped
                        if bot['status'] in ('stopped', 'completed'):
                            print(f'⛔ SKIPPING duplicate watch SL for {bot_id} — already {bot["status"]}')
                            continue
                        sold, sell_info = execute_sell(ticker, watch_side, qty, reason=f'watch_SL_{bot_id}')
                        if sold:
                            actual_sell = sell_info.get('actual_fill_price') or sell_info.get('sell_price', cur_bid)
                            loss = (entry - actual_sell) * qty
                            bot['status'] = 'stopped'
                            bot['stopped_at'] = now
                            session_pnl['gross_loss_cents'] += loss
                            session_pnl['stopped_bots'] += 1
                            trade_history.insert(0, {
                        'bot_id': bot_id, 'ticker': ticker, 'type': 'watch',
                        'side': watch_side, 'entry_price': entry,
                        'exit_bid': actual_sell, 'quantity': qty,
                        'loss_cents': loss, 'result': 'stop_loss_watch',
                        'timestamp': now,
                        'placed_at': bot.get('created_at', now),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                        'stop_loss_cents': sl,
                        'game_context': _get_game_context(ticker),
                    })
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_watch',
                                           'loss_cents': loss})
                        else:
                            print(f'⚠ Watch SL sell FAILED for {bot_id} — will retry next cycle')
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_watch_FAILED',
                                           'info': str(sell_info)})
                    # Take-profit
                    elif tp > 0 and cur_bid >= entry + tp:
                        # SAFETY: re-check bot hasn't already been stopped
                        if bot['status'] in ('stopped', 'completed'):
                            print(f'⛔ SKIPPING duplicate watch TP for {bot_id} — already {bot["status"]}')
                            continue
                        sold, sell_info = execute_sell(ticker, watch_side, qty, reason=f'watch_TP_{bot_id}')
                        if sold:
                            actual_sell = sell_info.get('actual_fill_price') or sell_info.get('sell_price', cur_bid)
                            profit = (actual_sell - entry) * qty
                            bot['status'] = 'completed'
                            bot['completed_at'] = now
                            session_pnl['gross_profit_cents'] += profit
                            session_pnl['completed_bots'] += 1
                            trade_history.insert(0, {
                        'bot_id': bot_id, 'ticker': ticker, 'type': 'watch',
                        'side': watch_side, 'entry_price': entry,
                        'exit_bid': actual_sell, 'quantity': qty,
                        'profit_cents': profit, 'result': 'take_profit_watch',
                        'timestamp': now,
                        'placed_at': bot.get('created_at', now),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                        'stop_loss_cents': sl,
                        'take_profit_cents': tp,
                        'game_context': _get_game_context(ticker),
                    })
                            actions.append({'bot_id': bot_id, 'action': 'take_profit_watch',
                                           'profit_cents': profit})
                        else:
                            print(f'⚠ Watch TP sell FAILED for {bot_id} — will retry next cycle')
                            actions.append({'bot_id': bot_id, 'action': 'take_profit_watch_FAILED',
                                           'info': str(sell_info)})
                    continue

                # ── WAITING REPEAT: keep checking for spread to reopen ─────
                if bot['status'] == 'waiting_repeat':
                    target_width = bot.get('arb_width', bot.get('profit_per', 5))
                    wait_age_min = (now - bot.get('waiting_repeat_since', now)) / 60.0

                    # Give up after 15 minutes of waiting
                    if wait_age_min > 15:
                        bot['status'] = 'completed'
                        print(f'⏰ REPEAT TIMEOUT: {bot_id} waited {wait_age_min:.1f}m — giving up on repeat')
                        actions.append({'bot_id': bot_id, 'action': 'repeat_timeout'})
                        continue

                    # Check current market prices via ORDERBOOK (real-time)
                    fresh_yes_bid = 0
                    fresh_no_bid  = 0
                    try:
                        api_rate_limiter.wait()
                        ob_data = kalshi_client.get_market_orderbook(ticker)
                        ob = ob_data.get('orderbook', ob_data)
                        y_levels = sorted(ob.get('yes', []), key=lambda x: x[0] if isinstance(x, list) else x.get('price', 0), reverse=True)
                        n_levels = sorted(ob.get('no',  []), key=lambda x: x[0] if isinstance(x, list) else x.get('price', 0), reverse=True)
                        fresh_yes_bid = (y_levels[0][0] if isinstance(y_levels[0], list) else y_levels[0].get('price', 0)) if y_levels else 0
                        fresh_no_bid  = (n_levels[0][0] if isinstance(n_levels[0], list) else n_levels[0].get('price', 0)) if n_levels else 0
                    except Exception as ob_err:
                        print(f'⚠ Orderbook fetch for repeat check failed: {ob_err}')
                        # Fallback to WS cache
                        ws_price = ws_manager.get_price(ticker)
                        if ws_price:
                            fresh_yes_bid = ws_price.get('yes_bid', 0)
                            fresh_no_bid  = ws_price.get('no_bid', 0)

                    # Check if bids are high enough to place orders below them
                    # that still achieve the target width.
                    # We need: yes_bid + no_bid >= 100 - target_width
                    # (so we can shave from bids and still have room)
                    bid_sum = fresh_yes_bid + fresh_no_bid
                    target_total = 100 - target_width
                    if bid_sum >= target_total and fresh_yes_bid > 0 and fresh_no_bid > 0:
                        # Spread reopened — place new orders
                        try:
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

                            if new_profit >= target_width:
                                # Favorite-first: post only the favorite side
                                rep_fav_side = 'yes' if yes_is_fav else 'no'
                                rep_dog_side = 'no' if yes_is_fav else 'yes'
                                rep_fav_price = new_yes if yes_is_fav else new_no
                                rep_dog_price = new_no if yes_is_fav else new_yes

                                api_rate_limiter.wait()
                                if rep_fav_side == 'yes':
                                    fav_ord = kalshi_client.create_order(
                                        ticker=ticker, side='yes', action='buy',
                                        count=qty, yes_price=rep_fav_price)
                                else:
                                    fav_ord = kalshi_client.create_order(
                                        ticker=ticker, side='no', action='buy',
                                        count=qty, no_price=rep_fav_price)
                                fav_ord_id = fav_ord['order']['order_id']

                                bot['yes_price']    = new_yes
                                bot['no_price']     = new_no
                                bot['profit_per']   = new_profit
                                bot['fav_side']     = rep_fav_side
                                bot['dog_side']     = rep_dog_side
                                bot['fav_price']    = rep_fav_price
                                bot['dog_price']    = rep_dog_price
                                bot['fav_order_id'] = fav_ord_id
                                bot['yes_order_id'] = fav_ord_id if rep_fav_side == 'yes' else None
                                bot['no_order_id']  = fav_ord_id if rep_fav_side == 'no' else None
                                bot['yes_fill_qty'] = 0
                                bot['no_fill_qty']  = 0
                                bot['status']       = 'fav_posted'
                                bot['posted_at']    = time.time()
                                bot['repost_count'] = 0
                                bot['first_fill_at'] = None
                                bot['first_leg']     = None
                                if 'completed_at' in bot:
                                    del bot['completed_at']

                                cycle = bot.get('repeats_done', 0)
                                total = bot.get('repeat_count', 0)
                                print(f'🔄 REPEAT ARB cycle {cycle + 1}/{total + 1}: '
                                      f'{bot_id} FAV {rep_fav_side.upper()} {rep_fav_price}¢ posted — '
                                      f'{rep_dog_side.upper()} {rep_dog_price}¢ queued → {new_profit}¢ profit '
                                      f'(waited {wait_age_min:.1f}m)')
                                actions.append({
                                    'bot_id': bot_id, 'action': 'repeat_cycle',
                                    'cycle': cycle + 1, 'total': total + 1,
                                    'yes_price': new_yes, 'no_price': new_no,
                                    'profit_per': new_profit,
                                })
                                save_state()
                        except Exception as rep_err:
                            print(f'⚠ Repeat arb order failed: {rep_err} — will retry next cycle')
                    continue

                # ── Rate-limited fill checks ──────────────────────────────
                # Guard: fav_posted bots are handled above; this is for
                # legacy pending_fills bots with both order IDs set.
                if not bot.get('yes_order_id') or not bot.get('no_order_id'):
                    # Bot has a missing order ID — likely a fav_posted that
                    # slipped through. Reset to fav_posted for proper handling.
                    if bot.get('fav_order_id'):
                        bot['status'] = 'fav_posted'
                    continue

                api_rate_limiter.wait()
                yes_resp = kalshi_client.get_order(bot['yes_order_id'])
                api_rate_limiter.wait()
                no_resp  = kalshi_client.get_order(bot['no_order_id'])

                # Kalshi API may return {order: {...}} or the order directly
                yes_ord = yes_resp.get('order', yes_resp) if isinstance(yes_resp, dict) else {}
                no_ord  = no_resp.get('order', no_resp)   if isinstance(no_resp, dict) else {}
                yes_filled = yes_ord.get('filled_count', yes_ord.get('fill_count', 0))
                no_filled  = no_ord.get('filled_count',  no_ord.get('fill_count', 0))

                # Debug: log fill detection
                if yes_filled > 0 or no_filled > 0:
                    print(f'📊 FILL CHECK {bot_id}: YES={yes_filled}/{qty} NO={no_filled}/{qty} | resp_keys={list(yes_resp.keys()) if isinstance(yes_resp, dict) else "?"}')

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
                        'arb_width': bot.get('arb_width', bot.get('profit_per', 0)),
                        'first_leg': bot.get('first_leg', ''),
                        'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                        'game_phase': bot.get('game_phase', ''),
                        'stop_loss_cents': bot.get('stop_loss_cents', 0),
                        'game_context': _get_game_context(ticker),
                    })
                    actions.append({'bot_id': bot_id, 'action': 'completed', 'profit_cents': profit_cents})

                    # Track cumulative P&L on the bot itself
                    bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) + profit_cents

                    # ── REPEAT ARB: update bot in-place if repeats remain ──
                    repeats_done_now = bot.get('repeats_done', 0) + 1
                    bot['repeats_done'] = repeats_done_now
                    repeat_total = bot.get('repeat_count', 0)

                    if repeats_done_now <= repeat_total:
                        # Don't try to repeat immediately — the spread likely
                        # closed when our fills consumed liquidity.
                        # Instead, enter waiting_repeat and let the monitor loop
                        # check for spread reopening on subsequent cycles.
                        bot['status'] = 'waiting_repeat'
                        bot['waiting_repeat_since'] = time.time()
                        print(f'🔄 REPEAT: {bot_id} entering waiting_repeat — '
                              f'cycle {repeats_done_now}/{repeat_total}, '
                              f'watching for {bot.get("arb_width", bot["profit_per"])}¢ spread to reopen')
                        actions.append({
                            'bot_id': bot_id, 'action': 'waiting_repeat',
                            'cycle': repeats_done_now, 'total': repeat_total,
                        })

                    continue

                # ── Fetch current market prices (WS cache → REST fallback) ─
                ws_price = ws_manager.get_price(ticker)
                if ws_price:
                    yes_bid = ws_price.get('yes_bid', 0)
                    no_bid  = ws_price.get('no_bid', 0)
                    yes_ask = ws_price.get('yes_ask', 0)
                    no_ask  = ws_price.get('no_ask', 0)
                else:
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
                # PREGAME: Patient mode — but with SAFETY stop-loss.
                # Orders sit in the book, no repost/resize. However, if one
                # side fills and the bid drops past stop_loss, we MUST exit
                # to prevent catastrophic losses.
                # ═══════════════════════════════════════════════════════════
                if phase == 'pregame':
                    # Update status labels for UI display
                    if yes_filled >= qty and no_filled < qty:
                        bot['status'] = 'yes_filled'
                        if not bot.get('first_fill_at'):
                            bot['first_fill_at'] = now
                            bot['first_leg'] = 'yes'
                        # SAFETY STOP-LOSS even in pregame
                        if yes_bid <= bot['yes_price'] - stop:
                            print(f'🛑 PREGAME SAFETY SL: {bot_id} YES bid {yes_bid}¢ dropped below {bot["yes_price"] - stop}¢')
                            sold, sell_info = execute_sell(ticker, 'yes', yes_filled, reason=f'pregame_SL_yes_{bot_id}')
                            if sold:
                                try:
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['no_order_id'])
                                except Exception:
                                    pass
                                bot['status'] = 'stopped'
                                bot['repeat_count'] = 0  # Kill repeats on stop-loss
                                bot['stopped_at'] = now
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
                                    'arb_width': bot.get('arb_width', bot.get('profit_per', 0)),
                                    'first_leg': bot.get('first_leg', 'yes'),
                                    'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                                    'game_phase': 'pregame',
                                    'stop_loss_cents': bot.get('stop_loss_cents', 0),
                                    'game_context': _get_game_context(ticker),
                                })
                                bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) - loss
                                actions.append({'bot_id': bot_id, 'action': 'stop_loss_yes',
                                                'entry': bot['yes_price'], 'exit_bid': actual_sell,
                                                'loss_cents': loss, 'verified': verified,
                                                'note': 'pregame safety SL'})
                    elif no_filled >= qty and yes_filled < qty:
                        bot['status'] = 'no_filled'
                        if not bot.get('first_fill_at'):
                            bot['first_fill_at'] = now
                            bot['first_leg'] = 'no'
                        # SAFETY STOP-LOSS even in pregame
                        if no_bid <= bot['no_price'] - stop:
                            print(f'🛑 PREGAME SAFETY SL: {bot_id} NO bid {no_bid}¢ dropped below {bot["no_price"] - stop}¢')
                            sold, sell_info = execute_sell(ticker, 'no', no_filled, reason=f'pregame_SL_no_{bot_id}')
                            if sold:
                                try:
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['yes_order_id'])
                                except Exception:
                                    pass
                                bot['status'] = 'stopped'
                                bot['repeat_count'] = 0  # Kill repeats on stop-loss
                                bot['stopped_at'] = now
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
                                    'arb_width': bot.get('arb_width', bot.get('profit_per', 0)),
                                    'first_leg': bot.get('first_leg', 'no'),
                                    'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                                    'game_phase': 'pregame',
                                    'stop_loss_cents': bot.get('stop_loss_cents', 0),
                                    'game_context': _get_game_context(ticker),
                                })
                                bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) - loss
                                actions.append({'bot_id': bot_id, 'action': 'stop_loss_no',
                                                'entry': bot['no_price'], 'exit_bid': actual_sell,
                                                'loss_cents': loss, 'verified': verified,
                                                'note': 'pregame safety SL'})
                    # No repost, no resize — just wait (unless SL triggered above).
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
                    new_profit = 100 - new_yes - new_no
                    min_width = bot.get('arb_width', bot.get('profit_per', 3))
                    if new_profit >= min_width:
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
                    # Repost NO — NEVER above current bid, and PRESERVE arb width
                    target_w = bot.get('arb_width', bot.get('profit_per', 5))
                    max_no_for_width = 100 - bot['yes_price'] - target_w  # preserve width
                    new_no_price = min(no_bid, max_no_for_width, 98)
                    new_no_price = max(1, new_no_price)
                    if new_no_price > no_bid:
                        print(f'⚠ Resize NO skipped: cap {new_no_price}¢ > bid {no_bid}¢ — would overpay')
                    else:
                        try:
                            api_rate_limiter.wait()
                            kalshi_client.cancel_order(bot['no_order_id'])
                            api_rate_limiter.wait()
                            nn = kalshi_client.create_order(ticker=ticker, side='no', action='buy',
                                                            count=yes_filled, no_price=new_no_price)
                            bot.update({'no_order_id': nn['order']['order_id'],
                                        'quantity': yes_filled, 'no_price': new_no_price,
                                        'profit_per': 100 - bot['yes_price'] - new_no_price,
                                        'posted_at': now})
                            print(f'🔄 Resize NO: {bot_id} YES@{bot["yes_price"]}¢ + NO@{new_no_price}¢ → {100 - bot["yes_price"] - new_no_price}¢ width (target {target_w}¢)')
                            actions.append({'bot_id': bot_id, 'action': 'partial_resize_no',
                                            'yes_filled': yes_filled, 'new_no': new_no_price})
                        except Exception as pe:
                            print(f"Partial resize NO failed for {bot_id}: {pe}")
                    continue

                if no_filled > 0 and yes_filled == 0 and age_min >= STALE_CANCEL_MINUTES:
                    # Repost YES — NEVER above current bid, and PRESERVE arb width
                    target_w = bot.get('arb_width', bot.get('profit_per', 5))
                    max_yes_for_width = 100 - bot['no_price'] - target_w  # preserve width
                    new_yes_price = min(yes_bid, max_yes_for_width, 98)
                    new_yes_price = max(1, new_yes_price)
                    if new_yes_price > yes_bid:
                        print(f'⚠ Resize YES skipped: cap {new_yes_price}¢ > bid {yes_bid}¢ — would overpay')
                    else:
                        try:
                            api_rate_limiter.wait()
                            kalshi_client.cancel_order(bot['yes_order_id'])
                            api_rate_limiter.wait()
                            ny = kalshi_client.create_order(ticker=ticker, side='yes', action='buy',
                                                            count=no_filled, yes_price=new_yes_price)
                            bot.update({'yes_order_id': ny['order']['order_id'],
                                        'quantity': no_filled, 'yes_price': new_yes_price,
                                        'profit_per': 100 - new_yes_price - bot['no_price'],
                                        'posted_at': now})
                            print(f'🔄 Resize YES: {bot_id} YES@{new_yes_price}¢ + NO@{bot["no_price"]}¢ → {100 - new_yes_price - bot["no_price"]}¢ width (target {target_w}¢)')
                            actions.append({'bot_id': bot_id, 'action': 'partial_resize_yes',
                                            'no_filled': no_filled, 'new_yes': new_yes_price})
                        except Exception as pe:
                            print(f"Partial resize YES failed for {bot_id}: {pe}")
                    continue

                # ── YES fully filled, NO still open — check stop loss ──────
                if yes_filled >= qty and no_filled < qty:
                    bot['status'] = 'yes_filled'
                    if not bot.get('first_fill_at'):
                        bot['first_fill_at'] = now
                        bot['first_leg'] = 'yes'
                    sl_trigger = bot['yes_price'] - stop
                    if yes_bid <= sl_trigger:
                        # Bid is below SL trigger — start or continue grace timer
                        if not bot.get('sl_breach_since'):
                            bot['sl_breach_since'] = now
                            bot['sl_last_bid'] = yes_bid
                            grace_left = SL_GRACE_MINUTES
                            print(f'⏳ SL GRACE: {bot_id} YES bid {yes_bid}¢ ≤ trigger {sl_trigger}¢ — '
                                  f'waiting {SL_GRACE_MINUTES}m for recovery before firing')
                        grace_elapsed = (now - bot['sl_breach_since']) / 60.0
                        grace_left = max(0, SL_GRACE_MINUTES - grace_elapsed)
                        prev_bid = bot.get('sl_last_bid', yes_bid)
                        bot['sl_last_bid'] = yes_bid  # track for next cycle

                        if grace_elapsed < SL_GRACE_MINUTES:
                            # Still in grace period — don't fire yet
                            actions.append({'bot_id': bot_id, 'action': 'sl_grace_yes',
                                           'bid': yes_bid, 'trigger': sl_trigger,
                                           'grace_left_min': round(grace_left, 1)})
                            continue

                        # Grace period expired — but check if bid is recovering
                        hard_cap = SL_GRACE_MINUTES * 2  # absolute max wait
                        if yes_bid > prev_bid and grace_elapsed < hard_cap:
                            # Bid is moving UP — defer sell, let it recover
                            print(f'📈 SL DEFERRED: {bot_id} YES bid {yes_bid}¢ recovering '
                                  f'(was {prev_bid}¢) — holding despite grace expired')
                            actions.append({'bot_id': bot_id, 'action': 'sl_recovering_yes',
                                           'bid': yes_bid, 'prev_bid': prev_bid,
                                           'trigger': sl_trigger})
                            continue

                        # Bid still dropping/flat or hard cap reached — fire SL now
                        # SAFETY: re-check bot hasn't already been stopped
                        if bot['status'] in ('stopped', 'completed'):
                            print(f'⛔ SKIPPING duplicate SL YES for {bot_id} — already {bot["status"]}')
                            continue
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
                                no_ord_data = no_check.get('order', no_check) if isinstance(no_check, dict) else {}
                                no_status = no_ord_data.get('status', '')
                                if no_status not in ('canceled', 'cancelled'):
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['no_order_id'])
                            except Exception:
                                pass
                            bot['status'] = 'stopped'
                            bot['repeat_count'] = 0  # Kill repeats on stop-loss
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
                                'arb_width': bot.get('arb_width', bot.get('profit_per', 0)),
                                'first_leg': bot.get('first_leg', 'yes'),
                                'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                                'game_phase': bot.get('game_phase', 'live'),
                                'stop_loss_cents': bot.get('stop_loss_cents', 0),
                                'game_context': _get_game_context(ticker),
                            })
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_yes',
                                            'entry': bot['yes_price'], 'exit_bid': actual_sell,
                                            'loss_cents': loss, 'verified': verified})

                            # Track cumulative P&L on the bot (stop-loss = no repeat)
                            bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) - loss

                        else:
                            # Sell FAILED — track retries, force-exit if stuck too long
                            bot['sl_retry_count'] = bot.get('sl_retry_count', 0) + 1
                            retries = bot['sl_retry_count']
                            print(f'⚠ Arb SL YES sell FAILED for {bot_id} — retry #{retries}, hedge kept')

                            if retries >= 10:
                                # CIRCUIT BREAKER: force-exit after 10 failed sell attempts
                                # Market likely has no buyers — position will settle on Kalshi
                                print(f'🔴 FORCE EXIT: {bot_id} — {retries} sell attempts failed, force-stopping')
                                try:
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['no_order_id'])
                                except Exception:
                                    pass
                                bot['status'] = 'stopped'
                                bot['repeat_count'] = 0
                                bot['stopped_at'] = now
                                loss = bot['yes_price'] * yes_filled  # worst-case: full cost lost
                                session_pnl['gross_loss_cents'] += loss
                                session_pnl['stopped_bots'] += 1
                                trade_history.insert(0, {
                                    'bot_id': bot_id, 'ticker': ticker,
                                    'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                    'quantity': yes_filled, 'loss_cents': loss,
                                    'result': 'force_exit_yes', 'timestamp': now,
                                    'note': f'sell failed {retries}x — forced exit, position settles on Kalshi',
                                    'game_phase': bot.get('game_phase', 'live'),
                                })
                                bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) - loss
                                actions.append({'bot_id': bot_id, 'action': 'force_exit_yes', 'retries': retries})
                            else:
                                actions.append({'bot_id': bot_id, 'action': 'stop_loss_yes_RETRY', 'retry': retries})
                    else:
                        # Bid recovered above trigger — reset grace timer
                        if bot.get('sl_breach_since'):
                            print(f'✅ SL RECOVERED: {bot_id} YES bid {yes_bid}¢ > trigger {sl_trigger}¢ — grace timer reset')
                            bot['sl_breach_since'] = None
                            bot['sl_retry_count'] = 0
                    continue  # ← prevent fall-through to NO check

                # ── NO fully filled, YES still open — check stop loss ──────
                if no_filled >= qty and yes_filled < qty:
                    bot['status'] = 'no_filled'
                    if not bot.get('first_fill_at'):
                        bot['first_fill_at'] = now
                        bot['first_leg'] = 'no'
                    sl_trigger_no = bot['no_price'] - stop
                    if no_bid <= sl_trigger_no:
                        # Bid is below SL trigger — start or continue grace timer
                        if not bot.get('sl_breach_since'):
                            bot['sl_breach_since'] = now
                            bot['sl_last_bid'] = no_bid
                            print(f'⏳ SL GRACE: {bot_id} NO bid {no_bid}¢ ≤ trigger {sl_trigger_no}¢ — '
                                  f'waiting {SL_GRACE_MINUTES}m for recovery before firing')
                        grace_elapsed_no = (now - bot['sl_breach_since']) / 60.0
                        grace_left_no = max(0, SL_GRACE_MINUTES - grace_elapsed_no)
                        prev_bid_no = bot.get('sl_last_bid', no_bid)
                        bot['sl_last_bid'] = no_bid  # track for next cycle

                        if grace_elapsed_no < SL_GRACE_MINUTES:
                            # Still in grace period — don't fire yet
                            actions.append({'bot_id': bot_id, 'action': 'sl_grace_no',
                                           'bid': no_bid, 'trigger': sl_trigger_no,
                                           'grace_left_min': round(grace_left_no, 1)})
                            continue

                        # Grace period expired — but check if bid is recovering
                        hard_cap_no = SL_GRACE_MINUTES * 2  # absolute max wait
                        if no_bid > prev_bid_no and grace_elapsed_no < hard_cap_no:
                            # Bid is moving UP — defer sell, let it recover
                            print(f'📈 SL DEFERRED: {bot_id} NO bid {no_bid}¢ recovering '
                                  f'(was {prev_bid_no}¢) — holding despite grace expired')
                            actions.append({'bot_id': bot_id, 'action': 'sl_recovering_no',
                                           'bid': no_bid, 'prev_bid': prev_bid_no,
                                           'trigger': sl_trigger_no})
                            continue

                        # Bid still dropping/flat or hard cap reached — fire SL now
                        # SAFETY: re-check bot hasn't already been stopped
                        if bot['status'] in ('stopped', 'completed'):
                            print(f'⛔ SKIPPING duplicate SL NO for {bot_id} — already {bot["status"]}')
                            continue
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
                                yes_ord_data = yes_check.get('order', yes_check) if isinstance(yes_check, dict) else {}
                                yes_status = yes_ord_data.get('status', '')
                                if yes_status not in ('canceled', 'cancelled'):
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['yes_order_id'])
                            except Exception:
                                pass
                            bot['status'] = 'stopped'
                            bot['repeat_count'] = 0  # Kill repeats on stop-loss
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
                                'arb_width': bot.get('arb_width', bot.get('profit_per', 0)),
                                'first_leg': bot.get('first_leg', 'no'),
                                'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                                'game_phase': bot.get('game_phase', 'live'),
                                'stop_loss_cents': bot.get('stop_loss_cents', 0),
                                'game_context': _get_game_context(ticker),
                            })
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_no',
                                            'entry': bot['no_price'], 'exit_bid': actual_sell,
                                            'loss_cents': loss, 'verified': verified})

                            # Track cumulative P&L on the bot (stop-loss = no repeat)
                            bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) - loss

                        else:
                            # Sell FAILED — track retries, force-exit if stuck too long
                            bot['sl_retry_count'] = bot.get('sl_retry_count', 0) + 1
                            retries = bot['sl_retry_count']
                            print(f'⚠ Arb SL NO sell FAILED for {bot_id} — retry #{retries}, hedge kept')

                            if retries >= 10:
                                # CIRCUIT BREAKER: force-exit after 10 failed sell attempts
                                print(f'🔴 FORCE EXIT: {bot_id} — {retries} sell attempts failed, force-stopping')
                                try:
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['yes_order_id'])
                                except Exception:
                                    pass
                                bot['status'] = 'stopped'
                                bot['repeat_count'] = 0
                                bot['stopped_at'] = now
                                loss = bot['no_price'] * no_filled  # worst-case: full cost lost
                                session_pnl['gross_loss_cents'] += loss
                                session_pnl['stopped_bots'] += 1
                                trade_history.insert(0, {
                                    'bot_id': bot_id, 'ticker': ticker,
                                    'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                    'quantity': no_filled, 'loss_cents': loss,
                                    'result': 'force_exit_no', 'timestamp': now,
                                    'note': f'sell failed {retries}x — forced exit, position settles on Kalshi',
                                    'game_phase': bot.get('game_phase', 'live'),
                                })
                                bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) - loss
                                actions.append({'bot_id': bot_id, 'action': 'force_exit_no', 'retries': retries})
                            else:
                                actions.append({'bot_id': bot_id, 'action': 'stop_loss_no_RETRY', 'retry': retries})
                    else:
                        # Bid recovered above trigger — reset grace timer
                        if bot.get('sl_breach_since'):
                            print(f'✅ SL RECOVERED: {bot_id} NO bid {no_bid}¢ > trigger {sl_trigger_no}¢ — grace timer reset')
                            bot['sl_breach_since'] = None
                            bot['sl_retry_count'] = 0

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


@app.route('/api/bot/history/stats', methods=['GET'])
def history_stats():
    """Compute analytics from trade history for the optimization dashboard."""
    arb_trades = [t for t in trade_history if t.get('type') != 'watch']
    watch_trades = [t for t in trade_history if t.get('type') == 'watch']

    arb_wins = [t for t in arb_trades if t.get('result') == 'completed']
    arb_losses = [t for t in arb_trades if t.get('result', '').startswith('stop_loss')]

    # Fill rate by width
    width_stats = {}  # {width: {wins, losses, total_profit, total_loss}}
    for t in arb_trades:
        w = t.get('arb_width', 0)
        if w <= 0:
            continue
        if w not in width_stats:
            width_stats[w] = {'wins': 0, 'losses': 0, 'total_profit': 0, 'total_loss': 0, 'fill_durations': []}
        if t['result'] == 'completed':
            width_stats[w]['wins'] += 1
            width_stats[w]['total_profit'] += t.get('profit_cents', 0)
        else:
            width_stats[w]['losses'] += 1
            width_stats[w]['total_loss'] += t.get('loss_cents', 0)
        if t.get('fill_duration_s') is not None:
            width_stats[w]['fill_durations'].append(t['fill_duration_s'])

    # Compute averages per width
    width_breakdown = []
    for w, s in sorted(width_stats.items()):
        total = s['wins'] + s['losses']
        fill_rate = round(s['wins'] / total * 100, 1) if total > 0 else 0
        avg_fill_dur = round(sum(s['fill_durations']) / len(s['fill_durations'])) if s['fill_durations'] else None
        avg_profit = round(s['total_profit'] / s['wins']) if s['wins'] > 0 else 0
        avg_loss = round(s['total_loss'] / s['losses']) if s['losses'] > 0 else 0
        width_breakdown.append({
            'width': w, 'wins': s['wins'], 'losses': s['losses'],
            'fill_rate': fill_rate, 'net_cents': s['total_profit'] - s['total_loss'],
            'avg_profit_cents': avg_profit, 'avg_loss_cents': avg_loss,
            'avg_fill_duration_s': avg_fill_dur,
        })

    # Fill rate by width+SL combo (with breakeven comparison)
    combo_stats = {}  # key: "width_sl" → {wins, losses, total_profit, total_loss}
    for t in arb_trades:
        w = t.get('arb_width', 0)
        sl = t.get('stop_loss_cents', 0)
        if w <= 0 or sl <= 0:
            continue
        key = f'{w}_{sl}'
        if key not in combo_stats:
            combo_stats[key] = {'width': w, 'sl': sl, 'wins': 0, 'losses': 0,
                                'total_profit': 0, 'total_loss': 0}
        if t['result'] == 'completed':
            combo_stats[key]['wins'] += 1
            combo_stats[key]['total_profit'] += t.get('profit_cents', 0)
        else:
            combo_stats[key]['losses'] += 1
            combo_stats[key]['total_loss'] += t.get('loss_cents', 0)

    combo_breakdown = []
    for key, cs in sorted(combo_stats.items(), key=lambda x: (-x[1]['width'], x[1]['sl'])):
        total = cs['wins'] + cs['losses']
        fill_rate = round(cs['wins'] / total * 100, 1) if total > 0 else 0
        breakeven_pct = round(cs['sl'] / (cs['sl'] + cs['width']) * 100, 1)
        edge = round(fill_rate - breakeven_pct, 1)
        combo_breakdown.append({
            'width': cs['width'], 'sl': cs['sl'],
            'wins': cs['wins'], 'losses': cs['losses'],
            'fill_rate': fill_rate, 'breakeven_pct': breakeven_pct,
            'edge': edge,  # positive = profitable, negative = losing
            'net_cents': cs['total_profit'] - cs['total_loss'],
        })

    # Phase breakdown
    phase_stats = {'pregame': {'wins': 0, 'losses': 0}, 'live': {'wins': 0, 'losses': 0}}
    for t in arb_trades:
        p = t.get('game_phase', 'live')
        if p not in phase_stats:
            phase_stats[p] = {'wins': 0, 'losses': 0}
        if t['result'] == 'completed':
            phase_stats[p]['wins'] += 1
        else:
            phase_stats[p]['losses'] += 1

    # Quarter/period breakdown
    quarter_stats = {}
    for t in arb_trades:
        gc = t.get('game_context', {})
        period = gc.get('period', 0)
        if period <= 0:
            continue
        q_key = f'Q{period}' if period <= 4 else f'OT'
        if q_key not in quarter_stats:
            quarter_stats[q_key] = {'wins': 0, 'losses': 0}
        if t['result'] == 'completed':
            quarter_stats[q_key]['wins'] += 1
        else:
            quarter_stats[q_key]['losses'] += 1

    # Score differential breakdown (close game vs blowout)
    margin_stats = {'close_0_5': {'wins': 0, 'losses': 0}, 'mid_6_15': {'wins': 0, 'losses': 0}, 'blowout_16plus': {'wins': 0, 'losses': 0}}
    for t in arb_trades:
        gc = t.get('game_context', {})
        diff = gc.get('score_diff', -1)
        if diff < 0:
            continue
        if diff <= 5:
            bucket = 'close_0_5'
        elif diff <= 15:
            bucket = 'mid_6_15'
        else:
            bucket = 'blowout_16plus'
        if t['result'] == 'completed':
            margin_stats[bucket]['wins'] += 1
        else:
            margin_stats[bucket]['losses'] += 1

    # First leg analysis
    first_leg_stats = {'yes': {'wins': 0, 'losses': 0}, 'no': {'wins': 0, 'losses': 0}}
    for t in arb_trades:
        fl = t.get('first_leg', '')
        if fl in first_leg_stats:
            if t['result'] == 'completed':
                first_leg_stats[fl]['wins'] += 1
            else:
                first_leg_stats[fl]['losses'] += 1

    # Average fill duration (overall)
    all_durations = [t['fill_duration_s'] for t in arb_trades if t.get('fill_duration_s') is not None]
    win_durations = [t['fill_duration_s'] for t in arb_wins if t.get('fill_duration_s') is not None]
    loss_durations = [t['fill_duration_s'] for t in arb_losses if t.get('fill_duration_s') is not None]

    total_arb = len(arb_wins) + len(arb_losses)
    total_profit = sum(t.get('profit_cents', 0) for t in arb_wins)
    total_loss = sum(t.get('loss_cents', 0) for t in arb_losses)

    return jsonify({
        'arb_total': total_arb,
        'arb_wins': len(arb_wins),
        'arb_losses': len(arb_losses),
        'arb_fill_rate': round(len(arb_wins) / total_arb * 100, 1) if total_arb > 0 else 0,
        'arb_net_cents': total_profit - total_loss,
        'arb_avg_profit': round(total_profit / len(arb_wins)) if arb_wins else 0,
        'arb_avg_loss': round(total_loss / len(arb_losses)) if arb_losses else 0,
        'avg_fill_duration_s': round(sum(all_durations) / len(all_durations)) if all_durations else None,
        'avg_win_duration_s': round(sum(win_durations) / len(win_durations)) if win_durations else None,
        'avg_loss_duration_s': round(sum(loss_durations) / len(loss_durations)) if loss_durations else None,
        'width_breakdown': width_breakdown,
        'combo_breakdown': combo_breakdown,
        'phase_stats': phase_stats,
        'quarter_stats': quarter_stats,
        'margin_stats': margin_stats,
        'first_leg_stats': first_leg_stats,
        'watch_total': len(watch_trades),
        'watch_wins': len([t for t in watch_trades if t.get('result') == 'take_profit_watch']),
        'watch_losses': len([t for t in watch_trades if t.get('result') == 'stop_loss_watch']),
    })


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
    """Cancel a bot and its outstanding limit orders.
    SAFETY: If one side has filled contracts, sell them first to avoid orphaned positions.
    """
    if bot_id not in active_bots:
        return jsonify({'error': 'Bot not found'}), 404

    bot = active_bots[bot_id]
    cancelled = []
    sold_positions = []
    warnings = []
    ticker = bot.get('ticker', '')

    if kalshi_client:
        yes_filled = bot.get('yes_fill_qty', 0)
        no_filled = bot.get('no_fill_qty', 0)
        qty = bot.get('quantity', 1)
        bot_type = bot.get('type', 'arb')

        # ── Handle watch bots ──
        if bot_type == 'watch':
            watch_side = bot.get('side', 'yes')
            if bot.get('order_filled', False):
                # Position exists — sell it before deleting
                watch_qty = bot.get('fill_qty', bot.get('quantity', 1))
                sold, sell_info = execute_sell(ticker, watch_side, watch_qty, reason=f'cancel_watch_{bot_id}')
                if sold:
                    sold_positions.append(f'{watch_side.upper()} {watch_qty}x')
                else:
                    warnings.append(f'FAILED to sell {watch_side.upper()} {watch_qty}x — position may still be open on Kalshi!')
            elif bot.get('order_id'):
                try:
                    kalshi_client.cancel_order(bot['order_id'])
                    cancelled.append(watch_side.upper())
                except Exception:
                    pass

        # ── Handle arb bots ──
        else:
            # SELL any filled positions FIRST (prevents orphaned exposure)
            if yes_filled >= qty:
                sold, sell_info = execute_sell(ticker, 'yes', yes_filled, reason=f'cancel_sell_yes_{bot_id}')
                if sold:
                    sold_positions.append(f'YES {yes_filled}x')
                else:
                    warnings.append(f'FAILED to sell YES {yes_filled}x — position may still be open on Kalshi!')
            elif bot.get('yes_order_id'):
                try:
                    kalshi_client.cancel_order(bot['yes_order_id'])
                    cancelled.append('YES')
                except Exception:
                    pass

            if no_filled >= qty:
                sold, sell_info = execute_sell(ticker, 'no', no_filled, reason=f'cancel_sell_no_{bot_id}')
                if sold:
                    sold_positions.append(f'NO {no_filled}x')
                else:
                    warnings.append(f'FAILED to sell NO {no_filled}x — position may still be open on Kalshi!')
            elif bot.get('no_order_id'):
                try:
                    kalshi_client.cancel_order(bot['no_order_id'])
                    cancelled.append('NO')
                except Exception:
                    pass

    del active_bots[bot_id]
    save_state()

    result = {'success': True, 'cancelled_orders': cancelled, 'sold_positions': sold_positions}
    if warnings:
        result['warnings'] = warnings
    return jsonify(result)


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
            'nba': ['KXNBAGAME', 'KXNBASPREAD', 'KXNBATOTAL',
                    'KXNBAPTS', 'KXNBAREB', 'KXNBAAST', 'KXNBA3PT',
                    'KXNBASTL', 'KXNBABLK', 'KXNBAMVP'],
            'nfl': ['KXNFLGAME', 'KXNFLSPREAD', 'KXNFLTOTAL'],
            'nhl': ['KXNHLGAME', 'KXNHLSPREAD', 'KXNHLTOTAL', 'KXNHLGOAL'],
            'mlb': ['KXMLBGAME', 'KXMLBSPREAD', 'KXMLBTOTAL', 'KXMLBSTGAME'],
            'mls': ['KXMLSGAME', 'KXMLSSPREAD', 'KXMLSTOTAL', 'KXMLSBTTS'],
            'ncaab': ['KXNCAAMBGAME', 'KXNCAAMBSPREAD', 'KXNCAAMBTOTAL',
                      'KXNCAAMB1HWINNER', 'KXNCAAMB1HSPREAD', 'KXNCAAMB1HTOTAL',
                      'KXMARMAD', 'KXNCAAWBGAME'],
            'epl': ['KXEPLGAME', 'KXEPLSPREAD', 'KXEPLTOTAL', 'KXEPLGOAL', 'KXEPLBTTS'],
            'ucl': ['KXUCLGAME', 'KXUCLSPREAD', 'KXUCLTOTAL', 'KXUCLGOAL', 'KXUCLBTTS'],
            'tennis': ['KXATPMATCH', 'KXWTAMATCH'],
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

        # Filter stale/postponed markets
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        def _is_stale(m):
            exp_str = m.get('expected_expiration_time', '')
            if not exp_str: return False
            try:
                exp_time = datetime.fromisoformat(exp_str.replace('Z','+00:00'))
                days_past = (now - exp_time).days
                if days_past > 30: return True
                if days_past > 7 and m.get('volume_24h',0) == 0 and m.get('liquidity',0) == 0: return True
            except: pass
            return False
        all_markets = [m for m in all_markets if not _is_stale(m)]

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

            # ── Spread & Liquidity ─────────────────────────────────
            yes_spread = (yes_ask - yes_bid) if yes_ask and yes_bid else 99
            no_spread  = (no_ask  - no_bid)  if no_ask  and no_bid  else 99
            total_spread = yes_spread + no_spread

            # ── Balance: how close both sides are to 50/50 ─────────
            min_bid_val = min(yes_bid, no_bid)
            max_bid_val = max(yes_bid, no_bid, 1)
            balance = round(min_bid_val / max_bid_val, 2)

            # Skip garbage: extreme-outcome markets that will never
            # fill both sides (e.g. YES 5¢ / NO 92¢)
            if min_bid_val < 5:
                continue

            # Skip extreme width — phantom bids on dead markets
            if width > 50:
                continue

            # ── Liquidity score (0-1): tight spread = high ─────────
            # Perfect spread = 1¢ each side (total 2) → liquidity 1.0
            # 5¢ each side (total 10) → liquidity 0.2
            # No ask data (total 198) → essentially 0
            liquidity = round(min(1.0, 2.0 / max(1, total_spread)), 3)

            # ── Live game detection ────────────────────────────────
            ticker_str = m.get('ticker', '')
            event_ticker = m.get('event_ticker', '')
            is_live = _is_game_live(ticker_str)

            # ── Game date & time ───────────────────────────────────
            game_date = _parse_game_date(event_ticker)
            game_time = _get_game_time(ticker_str)  # from ESPN (today's games only)

            # ── CATCH SCORE ────────────────────────────────────────
            # How quickly and reliably you'll catch the width as
            # price oscillates during live play.
            #
            # Formula: width × balance × live_multiplier
            #
            # NOTE: Liquidity (1/spread) is intentionally EXCLUDED.
            # On Kalshi's single order book, spread ≈ width, so
            # width × (1/width) = 1 — the terms cancel out and
            # everything scores ~1.  Dropping liquidity lets width
            # and balance differentiate properly.
            #
            # Sweet spot: 3-8¢ width, balanced bids, live game.
            # Extreme odds (5¢/92¢) → low balance → low score.
            live_mult = 3.0 if is_live else 1.0
            catch_score = round(width * balance * live_mult, 1)

            # ── Catch speed label ──────────────────────────────────
            if catch_score >= 15:
                catch_speed = 'prime'    # best opportunities
            elif catch_score >= 8:
                catch_speed = 'fast'     # good fill speed
            elif catch_score >= 3:
                catch_speed = 'moderate' # decent, may take time
            else:
                catch_speed = 'slow'     # wide spread or unbalanced

            # ── Queue-jump prices: bid + 1 to be first in line ──
            qj_yes = yes_bid + 1
            qj_no  = no_bid + 1
            qj_profit = 100 - qj_yes - qj_no  # can be negative if bids already tight

            opportunities.append({
                'ticker':        ticker_str,
                'title':         m.get('title', ''),
                'event_ticker':  event_ticker,
                'series_ticker': m.get('series_ticker', ''),
                'yes_bid':       yes_bid,
                'no_bid':        no_bid,
                'yes_ask':       yes_ask or 0,
                'no_ask':        no_ask or 0,
                'yes_spread':    yes_spread if yes_spread < 99 else 0,
                'no_spread':     no_spread if no_spread < 99 else 0,
                'width':         width,
                'suggested_yes': sug_yes,
                'suggested_no':  sug_no,
                'profit_posted': posted_profit,
                'qj_yes':        qj_yes,
                'qj_no':         qj_no,
                'qj_profit':     qj_profit,
                'catch_score':   catch_score,
                'catch_speed':   catch_speed,
                'liquidity':     liquidity,
                'balance':       balance,
                'min_bid':       min_bid_val,
                'is_live':       is_live,
                'game_date':     game_date,
                'game_time':     game_time,
            })

        opportunities.sort(key=lambda x: x['catch_score'], reverse=True)
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
    Middle spread scanner — opposing-team NO+NO strategy.

    For a game between Team A and Team B, a "middle" buys:
      - NO on "Team A wins by over X" (wins unless A wins by X+)
      - NO on "Team B wins by over Y" (wins unless B wins by Y+)

    Since only one team can win, AT LEAST ONE NO always wins (100¢ payout).
    If the game margin falls in the "middle" (within X of A or within Y of B),
    BOTH NOs win → 200¢ payout.

    Guaranteed profit if combined NO cost < 100¢.
    Middle bonus if both hit.
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated. Please login first.'}), 401

        sport_filter = request.args.get('sport', '')

        # Fetch all spread markets
        SPREAD_SERIES = {
            'nba': ['KXNBASPREAD'],
            'nfl': ['KXNFLSPREAD'],
            'nhl': ['KXNHLSPREAD'],
            'mlb': ['KXMLBSPREAD'],
            'ncaab': ['KXNCAABSPREAD'],
        }
        if sport_filter and sport_filter.lower() not in ('', 'all'):
            series_to_fetch = SPREAD_SERIES.get(sport_filter.lower(), [])
        else:
            series_to_fetch = []
            for ss in SPREAD_SERIES.values():
                series_to_fetch.extend(ss)

        all_spreads = []
        for series in series_to_fetch:
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

        import re

        # ── Parse each market to extract team + spread number ─────────
        # Title format: "Orlando wins by over 7.5 Points?"
        # or: "TOR -3.5" etc.
        # Ticker format: KXNBASPREAD-26MAR03OKCCHI-OKC24
        #   last segment = {TEAM_CODE}{SPREAD_TIER_DIGITS}
        parsed_markets = []
        for m in all_spreads:
            title = m.get('title', '')
            ticker = m.get('ticker', '')
            et = m.get('event_ticker', '')

            # Extract spread number and team from title
            sp_match = re.search(r'(\w[\w\s\.]+?)\s+wins?\s+by\s+over\s+([\d.]+)', title, re.IGNORECASE)
            if not sp_match:
                sp_match = re.search(r'([A-Z]{2,5})\s+([+-]?[\d.]+)', title)
            if not sp_match:
                continue

            team_name = sp_match.group(1).strip()
            spread_num = float(sp_match.group(2))

            # Use event_ticker as game_id (same for all spread tiers)
            game_id = et

            # Extract team code from the LAST segment of the market ticker
            # e.g. 'KXNHLSPREAD-26MAR05NYILA-NYI2' → last='NYI2' → team='NYI'
            # e.g. 'KXNBASPREAD-26MAR03OKCCHI-OKC24' → last='OKC24' → team='OKC'
            ticker_parts = ticker.split('-')
            team_code = ''
            if len(ticker_parts) >= 3:
                last_seg = ticker_parts[-1]
                # Team code = alphabetic prefix (strip trailing digits)
                code_match = re.match(r'^([A-Z]+)', last_seg)
                team_code = code_match.group(1) if code_match else last_seg

            if not team_code:
                team_code = team_name[:3].upper()

            parsed_markets.append({
                'market': m,
                'game_id': game_id,
                'team_code': team_code,
                'team_name': team_name,
                'spread': spread_num,
                'yes_bid': tc(m, 'yes_bid'),
                'no_bid': tc(m, 'no_bid'),
                'yes_ask': tc(m, 'yes_ask'),
                'no_ask': tc(m, 'no_ask'),
            })

        # ── Group by game ─────────────────────────────────────────────
        games = {}
        for pm in parsed_markets:
            gid = pm['game_id']
            if gid not in games:
                games[gid] = []
            games[gid].append(pm)

        middles = []
        for game_id, markets in games.items():
            if len(markets) < 2:
                continue

            # Separate into teams
            teams = {}
            for pm in markets:
                tc_key = pm['team_code']
                if tc_key not in teams:
                    teams[tc_key] = []
                teams[tc_key].append(pm)

            team_codes = list(teams.keys())
            if len(team_codes) < 2:
                continue

            # ── Build cross-team pairs (opposing NO + NO) ─────────────
            for i in range(len(team_codes)):
                for j in range(i + 1, len(team_codes)):
                    tc_a = team_codes[i]
                    tc_b = team_codes[j]

                    for mkt_a in teams[tc_a]:
                        for mkt_b in teams[tc_b]:
                            no_a = mkt_a['no_bid']
                            no_b = mkt_b['no_bid']
                            if no_a <= 0 or no_b <= 0:
                                continue

                            # Skip phantom bids on extreme spreads
                            # (e.g. 3¢ NO bid on "wins by 29.5+" = dead market)
                            if no_a < 15 or no_b < 15:
                                continue

                            cost = no_a + no_b
                            # Middle zone: game margin between
                            #   "Team A wins by ≤ spread_a" and
                            #   "Team B wins by ≤ spread_b"
                            # Width in points = spread_a + spread_b
                            middle_width = mkt_a['spread'] + mkt_b['spread']

                            # Payoffs
                            guaranteed_profit = 100 - cost   # one NO always wins
                            middle_profit = 200 - cost       # both NOs win

                            # Suggested prices: always target total < 100¢ for
                            # guaranteed arb.  Place at 48¢ each (96¢ total = 4¢
                            # guaranteed), capped at the current NO bid so we
                            # don't overpay.  During live play, volatility can
                            # push prices down to fill these.
                            target_total = 96  # 4¢ guaranteed profit
                            sug_a = min(target_total // 2, no_a)
                            sug_b = min(target_total - sug_a, no_b)
                            sug_a = max(1, sug_a)
                            sug_b = max(1, sug_b)
                            suggested_profit = 100 - sug_a - sug_b

                            # ── Spread & liquidity for each NO leg ────────
                            no_spread_a = (mkt_a['no_ask'] - mkt_a['no_bid']) if mkt_a['no_ask'] and mkt_a['no_bid'] else 99
                            no_spread_b = (mkt_b['no_ask'] - mkt_b['no_bid']) if mkt_b['no_ask'] and mkt_b['no_bid'] else 99
                            total_spread = no_spread_a + no_spread_b
                            liquidity = round(min(1.0, 2.0 / max(1, total_spread)), 3)

                            # ── Balance: how close the two NO bids are ────
                            min_no = min(no_a, no_b)
                            max_no = max(no_a, no_b, 1)
                            balance = round(min_no / max_no, 2)

                            # ── Live game detection ───────────────────────
                            ticker_a_str = mkt_a['market'].get('ticker', '')
                            event_ticker_a = mkt_a['market'].get('event_ticker', '')
                            is_live = _is_game_live(ticker_a_str)
                            live_mult = 3.0 if is_live else 1.0

                            # ── Game date & time ─────────────────────────
                            game_date = _parse_game_date(event_ticker_a)
                            game_time = _get_game_time(ticker_a_str)

                            # ── CATCH SCORE for middles ───────────────────
                            # Same philosophy: width × liquidity × balance × live
                            # But width here is middle_width (spread points) and
                            # guaranteed_profit matters too.
                            base = middle_width * 2 + max(0, guaranteed_profit)
                            catch_score = round(base * liquidity * balance * live_mult, 1)

                            # ── Catch speed label ─────────────────────────
                            if catch_score >= 15:
                                catch_speed = 'prime'
                            elif catch_score >= 6:
                                catch_speed = 'fast'
                            elif catch_score >= 2:
                                catch_speed = 'moderate'
                            else:
                                catch_speed = 'slow'

                            middles.append({
                                'game_id': game_id,
                                'team_a': tc_a,
                                'team_b': tc_b,
                                'team_a_name': mkt_a['team_name'],
                                'team_b_name': mkt_b['team_name'],
                                'spread_a': mkt_a['spread'],
                                'spread_b': mkt_b['spread'],
                                'middle_width': middle_width,
                                'no_a_bid': no_a,
                                'no_b_bid': no_b,
                                'no_spread_a': no_spread_a if no_spread_a < 99 else 0,
                                'no_spread_b': no_spread_b if no_spread_b < 99 else 0,
                                'cost': cost,
                                'guaranteed_profit': guaranteed_profit,
                                'middle_profit': middle_profit,
                                'suggested_a': sug_a,
                                'suggested_b': sug_b,
                                'suggested_profit': suggested_profit,
                                'ticker_a': mkt_a['market']['ticker'],
                                'ticker_b': mkt_b['market']['ticker'],
                                'title_a': mkt_a['market']['title'],
                                'title_b': mkt_b['market']['title'],
                                'catch_score': catch_score,
                                'catch_speed': catch_speed,
                                'liquidity': liquidity,
                                'balance': balance,
                                'is_live': is_live,
                                'game_date': game_date,
                                'game_time': game_time,
                            })

        # Sort: guaranteed arbs first, then by catch_score
        middles.sort(key=lambda x: (x['guaranteed_profit'] > 0, x['catch_score']), reverse=True)

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
            'has_sl_tp':         True,
            'status':            'watching',
            'order_filled':      True,     # manual position — already placed
            'fill_qty':          quantity,
            'filled_at':         time.time(),
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

    # ── Auto-login at startup if config.json exists ──
    # This ensures bots are monitored immediately after a restart,
    # without waiting for the frontend to call /api/auto-login.
    try:
        config_path = os.path.join(os.path.dirname(__file__), 'config.json')
        if os.path.exists(config_path):
            with open(config_path) as f:
                config = json.load(f)
            api_key_id = config.get('api_key_id')
            key_file = config.get('private_key_path', 'kalshi_private_key.pem')
            demo = config.get('demo', False)
            key_path = os.path.join(os.path.dirname(__file__), key_file)
            if api_key_id and os.path.exists(key_path):
                kalshi_client = KalshiAPI(api_key_id, key_path, demo=demo)
                balance = kalshi_client.get_balance()
                bal_usd = balance.get('balance', 0) / 100
                print(f'✅ AUTO-LOGIN at startup: balance=${bal_usd:.2f}')
                # Start WebSocket
                try:
                    ws_manager.connect(kalshi_client)
                    active_tickers = list({b['ticker'] for b in active_bots.values()
                                           if b.get('status') in ('pending_fills', 'yes_filled', 'no_filled', 'watching')})
                    if active_tickers:
                        threading.Timer(2.0, lambda: ws_manager.subscribe(active_tickers)).start()
                except Exception as ws_err:
                    print(f'⚠ WS connect at startup failed (non-fatal): {ws_err}')

                # ── Immediate SL sweep: fire any stop-losses that triggered while offline ──
                active_count = len([b for b in active_bots.values()
                                    if b.get('status') in ('pending_fills', 'yes_filled', 'no_filled', 'watching')])
                if active_count > 0:
                    print(f'🔍 STARTUP SL SWEEP: checking {active_count} active bots for overdue stop-losses...')
                    with app.test_request_context():
                        acquired = monitor_lock.acquire(blocking=True, timeout=10)
                        if acquired:
                            try:
                                result = _run_monitor()
                                print(f'🔍 STARTUP SL SWEEP complete')
                            except Exception as sweep_err:
                                print(f'⚠ Startup SL sweep error: {sweep_err}')
                            finally:
                                monitor_lock.release()
                        else:
                            print(f'⚠ Could not acquire monitor lock for startup sweep')
            else:
                print('⚠ config.json found but missing api_key_id or private key — skipping auto-login')
    except Exception as e:
        print(f'⚠ Auto-login at startup failed (non-fatal): {e}')

    app.run(debug=False, host='0.0.0.0', port=5001, threaded=True)
