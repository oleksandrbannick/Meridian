"""
Kalshi Arbitrage Bot Backend
Flask server providing API endpoints for the trading bot
"""

from flask import Flask, jsonify, request, send_from_directory, make_response
from flask_cors import CORS
from kalshi_api import KalshiAPI
import os
import json
import requests
from typing import Dict, List, Optional
import time
import threading
import re
from datetime import datetime, date, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Global variables
kalshi_client: Optional[KalshiAPI] = None
stop_loss_percentage = 0.05  # 5% stop loss default


@app.route('/')
def index():
    """Serve the frontend — no-cache so Cloudflare/mobile always gets fresh code"""
    resp = make_response(send_from_directory(app.static_folder, 'index.html'))
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    return resp


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files — disable cache for JS/HTML/CSS"""
    resp = make_response(send_from_directory(app.static_folder, path))
    if path.endswith(('.js', '.html', '.css')):
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        resp.headers['Pragma'] = 'no-cache'
        resp.headers['Expires'] = '0'
    return resp


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

        with open(config_path) as f:
            config = json.load(f)

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


_GAME_SERIES = {'KXNBAGAME','KXNHLGAME','KXNFLGAME','KXMLBGAME','KXMLSGAME',
                'KXNCAAMBGAME','KXNCAAWBGAME','KXNCAAFGAME','KXEPLGAME',
                'KXUCLGAME','KXATPMATCH','KXWTAMATCH','KXWBCGAME','KXVTBGAME',
                'KXBSLGAME','KXABAGAME','KXMLBSTGAME'}

def _capture_opening_lines(markets):
    """Record first-seen YES price for each GAME market — never overwrite once stored."""
    global _opening_lines
    new_captures = 0
    for m in markets:
        ticker = m.get('ticker', '')
        if not ticker or ticker in _opening_lines:
            continue
        series = (m.get('series_ticker') or ticker.split('-')[0]).upper()
        if series not in _GAME_SERIES:
            continue
        yes_bid = m.get('yes_bid') or m.get('yes_bid_dollars', 0)
        try:
            yes_bid = float(yes_bid or 0)
        except (TypeError, ValueError):
            continue
        if yes_bid < 2:  # dollar value — convert to cents
            yes_bid = yes_bid * 100
        yes_bid = int(round(yes_bid))
        if yes_bid <= 0:
            continue
        _opening_lines[ticker] = {'yes_price': yes_bid, 'captured_at': time.time()}
        new_captures += 1
    if new_captures:
        print(f'📌 Captured {new_captures} opening lines')
        save_state()


@app.route('/api/opening-lines', methods=['GET'])
def get_opening_lines():
    return jsonify(_opening_lines)


@app.route('/api/markets', methods=['GET'])
def get_markets():
    """Get sports markets by querying Kalshi series tickers directly"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated. Please login first.'}), 401
            
        status = request.args.get('status', 'open')
        limit = int(request.args.get('limit', 5000))
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
            'KXNCAAMBPTS': 'prop', 'KXNCAAMBREB': 'prop', 'KXNCAAMBAST': 'prop',
            'KXNCAAMB3PT': 'prop', 'KXNCAAMBSTL': 'prop', 'KXNCAAMBBLK': 'prop',
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
            # World Baseball Classic
            'KXWBCGAME': 'winner',
            # International Basketball
            'KXVTBGAME': 'winner',   # Russia VTB United League
            'KXBSLGAME': 'winner',   # Turkey BSL
            'KXABAGAME': 'winner',   # Adriatic ABA League
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
                      'KXNCAAMBPTS', 'KXNCAAMBREB', 'KXNCAAMBAST',
                      'KXNCAAMB3PT', 'KXNCAAMBSTL', 'KXNCAAMBBLK',
                      'KXMARMAD'],
            'ncaaw': ['KXNCAAWBGAME'],
            'ncaaf': ['KXNCAAFGAME', 'KXNCAAFSPREAD', 'KXNCAAFTOTAL'],
            'epl': ['KXEPLGAME', 'KXEPLSPREAD', 'KXEPLTOTAL', 'KXEPLGOAL', 'KXEPLBTTS'],
            'ucl': ['KXUCLGAME', 'KXUCLSPREAD', 'KXUCLTOTAL', 'KXUCLGOAL', 'KXUCLBTTS'],
            'tennis': ['KXATPMATCH', 'KXWTAMATCH'],
            'wbc': ['KXWBCGAME'],
            'intl': ['KXVTBGAME', 'KXBSLGAME', 'KXABAGAME'],
        }
        
        # Determine which series to fetch
        if sport_filter and sport_filter.lower() != 'all':
            series_to_fetch = SPORTS_SERIES.get(sport_filter.lower(), [])
        else:
            series_to_fetch = []
            for sport_series in SPORTS_SERIES.values():
                series_to_fetch.extend(sport_series)
        
        # Fetch markets from each series in parallel
        # Use 6 workers to stay under Kalshi's 10 req/s rate limit,
        # and retry on 429 with exponential backoff so no series gets silently dropped.
        all_markets = []
        series_counts = {}

        def _fetch_series(series):
            series_markets = []
            cursor = None
            mtype = SERIES_TYPE_MAP.get(series, 'prop')
            while True:
                # Retry each page up to 3 times on 429
                page_result = None
                for attempt in range(3):
                    try:
                        page_result = kalshi_client.get_markets_by_series(
                            series, status=status, limit=200, cursor=cursor)
                        break
                    except requests.exceptions.HTTPError as e:
                        if e.response is not None and e.response.status_code == 429:
                            wait = 1.5 * (attempt + 1)
                            print(f'⏳ Rate-limited on {series}, retry {attempt+1}/3 in {wait}s')
                            time.sleep(wait)
                            continue
                        print(f'⚠️ HTTP error fetching {series}: {e}')
                        return series, series_markets
                    except Exception as e:
                        print(f'⚠️ Error fetching {series}: {e}')
                        return series, series_markets
                if page_result is None:
                    print(f'❌ Exhausted retries for {series}')
                    return series, series_markets
                markets = page_result.get('markets', [])
                if not markets:
                    break
                markets = [m for m in markets if 'mve_selected_legs' not in m
                           and 'KXMVECROSSCATEGORY' not in m.get('ticker', '')]
                for m in markets:
                    m['market_type'] = mtype
                    m['series_ticker'] = series  # API returns None, fill it
                series_markets.extend(markets)
                cursor = page_result.get('cursor')
                if not cursor or len(page_result.get('markets', [])) < 200:
                    break
            return series, series_markets

        with ThreadPoolExecutor(max_workers=6) as executor:
            for series, series_markets in executor.map(_fetch_series, series_to_fetch):
                if series_markets:
                    series_counts[series] = len(series_markets)
                    all_markets.extend(series_markets)
        
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
        if limit and limit < len(unique_markets):
            unique_markets = unique_markets[:limit]

        # Capture opening lines for GAME markets not yet stored
        # Only capture once — first observation is the closest to true pre-game line
        _capture_opening_lines(unique_markets)

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



@app.route('/api/scoreboard/<sport>', methods=['GET'])
def get_scoreboard(sport):
    """Proxy ESPN public scoreboard API to avoid CORS issues.
    For tennis (atp/wta), flattens the groupings→competitions structure
    into a flat events list that looks like team sports, so the frontend
    parseESPNGame() works with minimal changes."""
    sport_map = {
        'nba': 'basketball/nba',
        'nfl': 'football/nfl',
        'mlb': 'baseball/mlb',
        'nhl': 'hockey/nhl',
        'ncaab': 'basketball/mens-college-basketball',
        'ncaaw': 'basketball/womens-college-basketball',
        'ncaaf': 'football/college-football',
        'mls': 'soccer/usa.1',
        'epl': 'soccer/eng.1',
        'ucl': 'soccer/uefa.champions',
        'atp': 'tennis/atp',
        'wta': 'tennis/wta',
    }
    sport_path = sport_map.get(sport.lower())
    if not sport_path:
        return jsonify({'error': f'Unknown sport: {sport}'}), 400

    try:
        url = f'https://site.api.espn.com/apis/site/v2/sports/{sport_path}/scoreboard'
        # NCAAB/NCAAW: groups=50 includes NIT/CBI/CIT games (default only shows conference tournaments)
        params = {}
        if sport.lower() in ('ncaab', 'ncaaw'):
            params['groups'] = '50'
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()

        # Tennis: flatten groupings → competitions into events
        if sport.lower() in ('atp', 'wta'):
            data = _flatten_tennis_scoreboard(data)

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _tennis_player_code(display_name: str) -> str:
    """Generate 3-letter Kalshi-style code from a player's full name.
    e.g. 'Ekaterina Alexandrova' → 'ALE', 'Coco Gauff' → 'GAU'"""
    if not display_name:
        return ''
    last = display_name.strip().split()[-1]
    return last[:3].upper() if len(last) >= 3 else last.upper()


def _flatten_tennis_scoreboard(data: dict) -> dict:
    """Transform ESPN tennis scoreboard so each match is a top-level event
    with competitors that have team.abbreviation (3-letter last-name code).
    This lets the frontend parseESPNGame() handle tennis like any team sport."""
    flat_events = []
    for ev in data.get('events', []):
        tournament = ev.get('name', '')
        for grp in ev.get('groupings', []):
            for comp in grp.get('competitions', []):
                competitors = comp.get('competitors', [])
                # Build match name from player last names
                names = []
                for c in competitors:
                    ath = c.get('athlete', {})
                    dn = ath.get('displayName', '')
                    if dn:
                        names.append(dn.split()[-1])
                match_name = ' vs '.join(names) if names else 'Match'

                # Compute sets won from linescores
                home_ls = []
                away_ls = []
                for c in competitors:
                    ls = [s.get('value', 0) for s in c.get('linescores', [])]
                    if c.get('homeAway') == 'home':
                        home_ls = ls
                    else:
                        away_ls = ls
                home_sets = sum(1 for i in range(min(len(home_ls), len(away_ls)))
                                if home_ls[i] > away_ls[i])
                away_sets = sum(1 for i in range(min(len(home_ls), len(away_ls)))
                                if away_ls[i] > home_ls[i])

                # Transform competitors to look like team-sport format
                xformed = []
                for c in competitors:
                    ath = c.get('athlete', {})
                    display_name = ath.get('displayName', '')
                    last_name = display_name.split()[-1] if display_name else ''
                    abbr = _tennis_player_code(display_name)
                    side = c.get('homeAway', '')
                    score = str(home_sets if side == 'home' else away_sets)
                    # Build set scores string for display: "7-5 6-4 3-2"
                    set_scores_str = ''
                    paired_ls = home_ls if side == 'home' else away_ls
                    other_ls = away_ls if side == 'home' else home_ls
                    set_parts = []
                    for i in range(min(len(paired_ls), len(other_ls))):
                        set_parts.append(f'{int(paired_ls[i])}-{int(other_ls[i])}')
                    set_scores_str = ' '.join(set_parts)
                    xformed.append({
                        'homeAway': side,
                        'winner': c.get('winner', False),
                        'score': score,
                        'team': {
                            'abbreviation': abbr,
                            'shortDisplayName': last_name,
                            'displayName': display_name,
                            'logo': (ath.get('headshot') or {}).get('href', '')
                                    or (ath.get('flag') or {}).get('href', ''),
                        },
                        'linescores': c.get('linescores', []),
                        'setScores': set_scores_str,
                    })

                flat_events.append({
                    'id': comp.get('id', ''),
                    'date': comp.get('date') or comp.get('startDate') or ev.get('date', ''),
                    'name': f'{match_name} ({tournament})',
                    'shortName': match_name,
                    'status': comp.get('status', {}),
                    'competitions': [{
                        'competitors': xformed,
                        'venue': comp.get('venue', {}),
                    }],
                })
    data['events'] = flat_events
    return data


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
        'ncaaw': 'basketball/womens-college-basketball',
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
_opening_lines = {}  # ticker -> {'yes_price': int, 'captured_at': float} — pre-game closing line

# ─── Activity Log ─────────────────────────────────────────────────────────────
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'activity_log.jsonl')
_log_lock = threading.Lock()

def bot_log(event: str, bot_id: str = '', details: dict = None, level: str = 'INFO'):
    """Write a structured log entry. Every bot decision gets logged here.
    
    Events:
      BOT_CREATED, ORDER_PLACED, ORDER_CANCELLED, ORDER_FILLED,
      FAV_POSTED, FAV_FILLED, DOG_POSTED, FAV_REPOSTED, FAV_STALE_CANCELLED,
      SL_TRIGGERED, SL_BLOCKED_STALE, SL_FIRED, SL_FAILED,
      TP_TRIGGERED, TP_FIRED, TP_FAILED,
      REPOST, RESIZE, SETTLEMENT, MARKET_SETTLED,
      WATCH_FILLED, WATCH_SL, WATCH_TP, WATCH_SETTLED,
      REPEAT_STARTED, REPEAT_TIMEOUT,
      MONITOR_CYCLE, ERROR
    """
    entry = {
        'ts': datetime.now(timezone.utc).isoformat(),
        'epoch': time.time(),
        'event': event,
        'level': level,
        'bot_id': bot_id,
    }
    # Snapshot bot state if it exists
    if bot_id and bot_id in active_bots:
        b = active_bots[bot_id]
        entry['bot_snapshot'] = {
            'type': b.get('type', 'arb'),
            'ticker': b.get('ticker'),
            'status': b.get('status'),
            'side': b.get('side'),
            'yes_price': b.get('yes_price'),
            'no_price': b.get('no_price'),
            'entry_price': b.get('entry_price'),
            'quantity': b.get('quantity'),
            'yes_fill_qty': b.get('yes_fill_qty', 0),
            'no_fill_qty': b.get('no_fill_qty', 0),
            'fill_qty': b.get('fill_qty', 0),
            'live_bid': b.get('live_bid'),
            'stop_loss_cents': b.get('stop_loss_cents'),
            'game_phase': b.get('game_phase'),
            'fav_side': b.get('fav_side'),
            'profit_per': b.get('profit_per'),
            'repost_count': b.get('repost_count', 0),
            'fair_value_cents': b.get('fair_value_cents'),
        }
    if details:
        entry['details'] = details
    
    with _log_lock:
        try:
            with open(LOG_FILE, 'a') as f:
                f.write(json.dumps(entry, default=str) + '\n')
        except Exception as e:
            print(f'⚠ bot_log write failed: {e}')
    
    # Also print a compact summary to console
    det_str = f' | {details}' if details else ''
    print(f'📋 [{level}] {event} {bot_id}{det_str}')

# ─── State Persistence ────────────────────────────────────────────────────────
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.json')

def save_state():
    """Persist active_bots and trade_history to disk so they survive restarts."""
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump({
                'active_bots': active_bots,
                'trade_history': trade_history[:2000],
                'session_pnl': session_pnl,
                'opening_lines': _opening_lines,
            }, f, indent=2, default=str)
    except Exception as e:
        print(f'⚠ save_state: {e}')

BACKUP_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data_backup.json')

def load_state():
    """Load persisted bots and history from disk."""
    global active_bots, trade_history, session_pnl, _opening_lines
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                data = json.load(f)
            active_bots = data.get('active_bots', {})
            trade_history = data.get('trade_history', [])
            _opening_lines = data.get('opening_lines', {})
            saved = data.get('session_pnl')
            if saved:
                for k in ('gross_profit_cents','gross_loss_cents','completed_bots','stopped_bots'):
                    if k in saved:
                        session_pnl[k] = saved[k]
            print(f'✅ Loaded: {len(active_bots)} bots, {len(trade_history)} history, {len(_opening_lines)} opening lines')
            # Write a backup on startup so we can always recover
            if trade_history:
                try:
                    import shutil
                    shutil.copy2(DATA_FILE, BACKUP_FILE)
                    print(f'📦 Backup written: {len(trade_history)} trades')
                except Exception as be:
                    print(f'⚠ backup: {be}')
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
                yb = msg.get('yes_bid', 0)
                ya = msg.get('yes_ask', 0)
                self.ticker_cache[ticker] = {
                    'yes_bid': yb,
                    'yes_ask': ya,
                    # Only compute implied prices when real liquidity exists on the opposite side
                    'no_bid': (100 - ya) if ya > 0 else 0,
                    'no_ask': (100 - yb) if yb > 0 else 0,
                    'price': msg.get('price', 0),
                    'volume': msg.get('volume', 0),
                    'ts': msg.get('ts', 0),
                    '_local_ts': time.time(),
                }
                # ── Real-time flip threshold check on every WS tick ──
                try:
                    yes_bid_rt = yb
                    no_bid_rt  = (100 - ya) if ya > 0 else 0
                    _ws_realtime_flip_check(ticker, yes_bid_rt, no_bid_rt)
                except Exception as flip_err:
                    print(f'⚠ WS real-time flip check error: {flip_err}')
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
            # ── Real-time fill handling: update bot fill counts + trigger actions ──
            try:
                _ws_realtime_fill_handler(ticker, order_id, side, count)
            except Exception as fh_err:
                print(f'⚠ WS real-time fill handler error: {fh_err}')
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

# ─── WS Flip lock: prevent WS real-time flip and monitor from double-firing ───
ws_flip_lock = threading.Lock()


def _ws_realtime_flip_check(ticker, yes_bid, no_bid):
    """
    Real-time flip threshold check triggered directly from the WebSocket
    ticker handler. Fires the instant a price update arrives — no polling delay.

    Only acts on bots that:
      - Are on this ticker
      - Have exactly one leg filled (yes_filled or no_filled status)
      - Have a favorite entry >= flip_threshold
      - Current bid has dropped to <= flip_threshold

    The actual sell is dispatched to a background thread so the WS handler
    doesn't block on API calls.
    """
    if not active_bots or not kalshi_client:
        return

    for bot_id, bot in list(active_bots.items()):
        if bot.get('ticker') != ticker:
            continue
        if bot.get('type') == 'watch':
            continue
        status = bot.get('status', '')
        if status not in ('yes_filled', 'no_filled'):
            continue
        # Already being handled by a WS flip sell or already stopped
        if bot.get('_ws_flip_selling') or status in ('stopped', 'completed'):
            continue

        flip_thresh = bot.get('flip_threshold', FLIP_THRESHOLD_CENTS)
        qty = bot['quantity']

        # YES filled, check if yes_bid has flipped
        if status == 'yes_filled':
            yes_filled = bot.get('yes_fill_qty', 0)
            entry_yes = bot['yes_price']
            # Dynamic trigger: max(entry-15, floor) but capped so room >= 10¢
            effective_trigger = max(entry_yes - FLIP_ENTRY_MARGIN, min(flip_thresh, entry_yes - 10))
            if yes_filled >= qty and entry_yes >= flip_thresh and yes_bid < effective_trigger:
                # Mark immediately to prevent monitor double-fire
                bot['_ws_flip_selling'] = True
                print(f'⚡ WS REAL-TIME FLIP: {bot_id} YES bid {yes_bid}¢ < {effective_trigger}¢ (entry {entry_yes}¢, thresh {flip_thresh}¢) — selling NOW')
                threading.Thread(
                    target=_execute_ws_flip,
                    args=(bot_id, 'yes', entry_yes, yes_bid, effective_trigger, yes_filled, flip_thresh),
                    daemon=True
                ).start()

        # NO filled, check if no_bid has flipped
        elif status == 'no_filled':
            no_filled = bot.get('no_fill_qty', 0)
            entry_no = bot['no_price']
            # Dynamic trigger: max(entry-15, floor) but capped so room >= 10¢
            effective_trigger = max(entry_no - FLIP_ENTRY_MARGIN, min(flip_thresh, entry_no - 10))
            if no_filled >= qty and entry_no >= flip_thresh and no_bid < effective_trigger:
                bot['_ws_flip_selling'] = True
                print(f'⚡ WS REAL-TIME FLIP: {bot_id} NO bid {no_bid}¢ < {effective_trigger}¢ (entry {entry_no}¢, thresh {flip_thresh}¢) — selling NOW')
                threading.Thread(
                    target=_execute_ws_flip,
                    args=(bot_id, 'no', entry_no, no_bid, effective_trigger, no_filled, flip_thresh),
                    daemon=True
                ).start()


def _execute_ws_flip(bot_id, filled_side, entry_price, trigger_bid, flip_thresh, filled_qty, floor=None):
    """
    Execute the flip sell in a background thread (called from WS handler).
    Uses ws_flip_lock to prevent race with monitor.
    """
    with ws_flip_lock:
        bot = active_bots.get(bot_id)
        if not bot or bot['status'] in ('stopped', 'completed'):
            if bot:
                bot.pop('_ws_flip_selling', None)
            return

        now = time.time()
        ticker = bot['ticker']
        other_side = 'no' if filled_side == 'yes' else 'yes'
        other_order_key = f'{other_side}_order_id'

        bot_log('ARB_FLIP_FIRED', bot_id, {
            'leg': filled_side, 'entry': entry_price,
            'bid': trigger_bid, 'threshold': flip_thresh,
            'floor': floor if floor is not None else flip_thresh,
            'source': 'ws_realtime'
        })

        sold, sell_info = execute_sell(ticker, filled_side, filled_qty,
                                       reason=f'ws_flip_{filled_side}_{bot_id}')
        if sold:
            # Cancel the unfilled other-side order
            try:
                api_rate_limiter.wait()
                kalshi_client.cancel_order(bot[other_order_key])
            except Exception:
                pass
            try:
                api_rate_limiter.wait()
                other_check = kalshi_client.get_order(bot[other_order_key])
                other_data = other_check.get('order', other_check) if isinstance(other_check, dict) else {}
                if other_data.get('status', '') not in ('canceled', 'cancelled'):
                    api_rate_limiter.wait()
                    kalshi_client.cancel_order(bot[other_order_key])
            except Exception:
                pass

            orig_repeat_count = bot.get('repeat_count', 0)
            bot['status'] = 'stopped'
            bot['repeat_count'] = 0
            bot['stopped_at'] = now
            actual_sell = sell_info.get('actual_fill_price') or sell_info.get('sell_price', trigger_bid)
            pnl_cents = (actual_sell - entry_price) * filled_qty  # positive=profit, negative=loss
            verified = sell_info.get('verified_cleared', False)
            if pnl_cents >= 0:
                session_pnl['gross_profit_cents'] += pnl_cents
                session_pnl['completed_bots']     += 1
            else:
                session_pnl['gross_loss_cents'] += abs(pnl_cents)
                session_pnl['stopped_bots']     += 1
            _record_trade({
                'bot_id': bot_id, 'ticker': ticker,
                'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                'quantity': filled_qty,
                'profit_cents': pnl_cents if pnl_cents >= 0 else 0,
                'loss_cents': abs(pnl_cents) if pnl_cents < 0 else 0,
                'result': f'flip_{filled_side}', 'exit_bid': actual_sell,
                'verified_cleared': verified, 'timestamp': now,
                'placed_at': bot.get('created_at', now),
                'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                'arb_width': bot.get('arb_width', bot.get('profit_per', 0)),
                'first_leg': bot.get('first_leg', filled_side),
                'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                'game_phase': bot.get('game_phase', 'live'),
                'flip_threshold': flip_thresh,
                'game_context': _get_game_context(ticker),
                'repeats_done': bot.get('repeats_done', 0),
                'repeat_count': orig_repeat_count,
                'exit_source': 'ws_realtime',
            }, bot)
            bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) + pnl_cents
            print(f'⚡ WS FLIP SOLD: {bot_id} {filled_side.upper()} entry={entry_price}¢ exit={actual_sell}¢ pnl={pnl_cents:+}¢ (real-time)')
            save_state()
        else:
            # Sell failed — clear the flag so monitor can retry
            bot['sl_retry_count'] = bot.get('sl_retry_count', 0) + 1
            print(f'⚠ WS FLIP sell FAILED for {bot_id} — monitor will retry')

        bot.pop('_ws_flip_selling', None)


# ─── WS Fill Lock: prevent WS fill handler and monitor from double-acting ─────
ws_fill_lock = threading.Lock()


def _ws_realtime_fill_handler(ticker, order_id, side, count):
    """
    Real-time fill handler triggered directly from the WebSocket fill event.
    Matches the fill to an active bot and:
      1. Updates fill counts immediately
      2. If fav leg just completed → posts dog leg instantly
      3. If both legs now filled → marks completed instantly

    Actions are dispatched to background threads so the WS handler doesn't block.
    """
    if not active_bots or not kalshi_client:
        return

    for bot_id, bot in list(active_bots.items()):
        if bot.get('ticker') != ticker:
            continue
        if bot.get('type') == 'watch':
            continue
        status = bot.get('status', '')
        if status in ('stopped', 'completed'):
            continue

        # Match fill to this bot's order IDs
        matched_leg = None  # 'yes' or 'no'
        if order_id == bot.get('yes_order_id') or (order_id == bot.get('fav_order_id') and bot.get('fav_side') == 'yes'):
            matched_leg = 'yes'
        elif order_id == bot.get('no_order_id') or (order_id == bot.get('fav_order_id') and bot.get('fav_side') == 'no'):
            matched_leg = 'no'

        if not matched_leg:
            continue

        qty = bot['quantity']

        # Update fill counts — accumulate (WS sends incremental fills)
        if matched_leg == 'yes':
            bot['yes_fill_qty'] = bot.get('yes_fill_qty', 0) + count
            yes_filled = bot['yes_fill_qty']
            no_filled = bot.get('no_fill_qty', 0)
        else:
            bot['no_fill_qty'] = bot.get('no_fill_qty', 0) + count
            no_filled = bot['no_fill_qty']
            yes_filled = bot.get('yes_fill_qty', 0)

        print(f'⚡ WS FILL UPDATE: {bot_id} {matched_leg.upper()} +{count} '
              f'→ YES={yes_filled}/{qty} NO={no_filled}/{qty}')

        # ── Both legs fully filled → instant completion ──
        if yes_filled >= qty and no_filled >= qty:
            if bot.get('_ws_fill_handling'):
                continue
            bot['_ws_fill_handling'] = True
            print(f'⚡ WS INSTANT COMPLETE: {bot_id} — both legs filled!')
            threading.Thread(
                target=_execute_ws_completion,
                args=(bot_id,),
                daemon=True
            ).start()
            break

        # ── Fav leg just completed → instant dog-leg posting ──
        if status == 'fav_posted':
            fav_side = bot.get('fav_side', 'yes')
            fav_filled = yes_filled if fav_side == 'yes' else no_filled
            if fav_filled >= qty:
                if bot.get('_ws_fill_handling'):
                    continue
                bot['_ws_fill_handling'] = True
                print(f'⚡ WS INSTANT FAV FILL: {bot_id} {fav_side.upper()} filled — posting dog leg NOW')
                threading.Thread(
                    target=_execute_ws_dog_post,
                    args=(bot_id,),
                    daemon=True
                ).start()
                break

        break  # Only one bot can match this order_id


def _execute_ws_dog_post(bot_id):
    """
    Post the underdog leg immediately after the favorite fills.
    Called from WS fill handler in a background thread.
    """
    with ws_fill_lock:
        bot = active_bots.get(bot_id)
        if not bot or bot['status'] in ('stopped', 'completed'):
            if bot:
                bot.pop('_ws_fill_handling', None)
            return

        # Double-check status — another thread may have already handled this
        if bot['status'] != 'fav_posted':
            bot.pop('_ws_fill_handling', None)
            return

        now = time.time()
        ticker = bot['ticker']
        qty = bot['quantity']
        fav_side = bot.get('fav_side', 'yes')
        dog_side = bot.get('dog_side', 'no' if fav_side == 'yes' else 'yes')
        dog_price = bot.get('dog_price', bot['no_price'] if dog_side == 'no' else bot['yes_price'])
        fav_price = bot.get('fav_price', bot['yes_price'] if fav_side == 'yes' else bot['no_price'])
        fav_filled = bot.get('yes_fill_qty', 0) if fav_side == 'yes' else bot.get('no_fill_qty', 0)

        try:
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
                    print(f'📉 WS DOG: Adjusted {dog_side.upper()} price to bid {live_dog_bid}¢')
            except Exception as ob_err:
                print(f'⚠ WS DOG: Orderbook check failed: {ob_err} — using planned price')

            # Verify arb width still makes sense
            actual_profit = 100 - fav_price - dog_price
            min_width = max(1, bot.get('arb_width', bot.get('profit_per', 3)) // 2)
            if actual_profit < min_width:
                print(f'⚠ WS DOG: Arb no longer viable for {bot_id}: profit={actual_profit}¢ < min={min_width}¢ — letting SL handle')
                if fav_side == 'yes':
                    bot['status'] = 'yes_filled'
                else:
                    bot['status'] = 'no_filled'
                bot['first_fill_at'] = now
                bot['first_leg'] = fav_side
                bot['posted_at'] = now
                bot.pop('_ws_fill_handling', None)
                save_state()
                return

            # Post the underdog order
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

            # Subscribe to the new order's ticker on WS (already subscribed, but ensure fill tracking)
            if ws_manager and ws_manager.connected:
                ws_manager.add_ticker(ticker)

            bot_log('FAV_FILLED_DOG_POSTED', bot_id, {
                'fav_side': fav_side, 'fav_price': fav_price,
                'dog_side': dog_side, 'dog_price': dog_price,
                'profit_per': bot['profit_per'],
                'source': 'ws_realtime'
            })
            print(f'⚡ WS FAV-FILL → DOG POSTED: {bot_id} {fav_side.upper()} filled at {fav_price}¢ → '
                  f'posted {dog_side.upper()} at {dog_price}¢ '
                  f'(profit target: {bot["profit_per"]}¢) [INSTANT]')
            save_state()

        except Exception as err:
            print(f'⚠ WS DOG post failed for {bot_id}: {err} — monitor will retry')

        bot.pop('_ws_fill_handling', None)

        # ── Race-condition guard: dog side may have filled while we held the lock ──
        # If the WS fill handler already incremented no_fill_qty (or yes_fill_qty)
        # while _ws_fill_handling was True, it would have skipped completion.
        # Re-check now and trigger completion if both legs are done.
        if bot and bot.get('status') not in ('stopped', 'completed', 'waiting_repeat'):
            yes_f = bot.get('yes_fill_qty', 0)
            no_f  = bot.get('no_fill_qty', 0)
            q     = bot.get('quantity', 0)
            if yes_f >= q and no_f >= q:
                print(f'⚡ WS RACE FIX: {bot_id} dog already filled during post — completing now!')
                bot['_ws_fill_handling'] = True
                # Release lock briefly, then call completion
                threading.Thread(
                    target=_execute_ws_completion,
                    args=(bot_id,),
                    daemon=True
                ).start()


def _execute_ws_completion(bot_id):
    """
    Handle both-legs-filled completion instantly from WS fill event.
    Called in a background thread.
    """
    with ws_fill_lock:
        bot = active_bots.get(bot_id)
        if not bot or bot['status'] in ('stopped', 'completed'):
            if bot:
                bot.pop('_ws_fill_handling', None)
            return

        now = time.time()
        ticker = bot['ticker']
        qty = bot['quantity']

        try:
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
            _record_trade({
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
                'flip_threshold': bot.get('flip_threshold', FLIP_THRESHOLD_CENTS),
                'stop_loss_cents': bot.get('stop_loss_cents', 0),
                'game_context': _get_game_context(ticker),
                'repeats_done': bot.get('repeats_done', 0),
                'repeat_count': bot.get('repeat_count', 0),
                'fill_source': 'ws_realtime',
            }, bot)
            bot_log('ARB_COMPLETED', bot_id, {
                'real_yes': real_yes, 'real_no': real_no,
                'profit_cents': profit_cents,
                'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                'source': 'ws_realtime'
            })

            # Track cumulative P&L on the bot itself
            bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) + profit_cents

            print(f'⚡ WS INSTANT COMPLETED: {bot_id} profit={profit_cents}¢ '
                  f'(YES={real_yes}¢ NO={real_no}¢) [INSTANT]')

            # ── REPEAT ARB: if repeats remain, enter waiting_repeat ──
            repeats_done_now = bot.get('repeats_done', 0) + 1
            bot['repeats_done'] = repeats_done_now
            repeat_total = bot.get('repeat_count', 0)

            if repeats_done_now <= repeat_total:
                bot['status'] = 'waiting_repeat'
                bot['waiting_repeat_since'] = time.time()
                print(f'🔄 WS REPEAT: {bot_id} entering waiting_repeat — '
                      f'cycle {repeats_done_now}/{repeat_total}')

            save_state()

        except Exception as err:
            print(f'⚠ WS completion handling failed for {bot_id}: {err} — monitor will handle')

        bot.pop('_ws_fill_handling', None)


# ─── Session P&L (Upgrade #6: P&L dashboard) ──────────────────────────────────

session_pnl = {
    'gross_profit_cents': 0,
    'gross_loss_cents':   0,
    'completed_bots':     0,
    'stopped_bots':       0,
    'session_start':      time.time(),
    'day_key':            date.today().isoformat(),  # for daily auto-reset
}

def auto_reset_daily_pnl():
    """Reset P&L counters if the day has changed since last check."""
    global session_pnl
    today = date.today().isoformat()
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
REPOST_AFTER_MINUTES = 3    # Re-post orders that haven't filled after this long
STALE_CANCEL_MINUTES = 10   # Resize to matched fills after this long

# ── Arb Bot Stop-Loss: Flip Threshold ──────────────────────────────────────────
# Game markets use a FLIP THRESHOLD instead of cent-based stop-loss.
# A favorite entered at ≥60¢ triggers: sell when bid drops to max(entry-15, 60).
# e.g. entry=80¢ → trigger=65¢ (15¢ room); entry=70¢ → trigger=60¢ (floor).
# This caps max loss at 15¢ regardless of entry, while giving high entries
# proportionally more room before cutting. Entries below 60¢ ride to settlement.
# Watch bots (straight bets / props) keep the old instant entry-minus-X SL.
FLIP_THRESHOLD_CENTS = 60   # Default hard floor: trigger never goes below 60¢
FLIP_ENTRY_MARGIN   = 15   # Trigger = max(entry-15, min(floor, entry-10)) — always gives ≥10¢ room
MIN_FAV_ENTRY_CENTS = 65    # Guardrail: never deploy fav side below 65¢ (65-69¢ entries use entry-10 floor)

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
    parts = event_ticker.split('-')
    if len(parts) < 2:
        return ''
    date_match = re.match(r'^(\d{2})([A-Z]{3})(\d{2})', parts[1])
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
        'ncaaw': 'basketball/womens-college-basketball',
        'mls': 'soccer/usa.1',
        'epl': 'soccer/eng.1',
        'ucl': 'soccer/uefa.champions',
        'atp': 'tennis/atp',
        'wta': 'tennis/wta',
    }
    for sport, path in sport_paths.items():
        try:
            url = f'https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard'
            # NCAAB/NCAAW: groups=50 includes NIT/CBI/CIT (default only shows conf tournaments)
            params = {}
            if sport in ('ncaab', 'ncaaw'):
                params['groups'] = '50'
            resp = requests.get(url, params=params, timeout=4)
            resp.raise_for_status()
            raw_data = resp.json()

            # Tennis: flatten groupings into events using shared helper
            if sport in ('atp', 'wta'):
                raw_data = _flatten_tennis_scoreboard(raw_data)

            events = raw_data.get('events', [])
            for ev in events:
                comp = (ev.get('competitions') or [{}])[0]
                ev_status_obj = (ev.get('status') or {}).get('type', {})
                status = ev_status_obj.get('state', 'pre')
                short_detail = ev_status_obj.get('shortDetail', '').lower()
                # ESPN briefly marks halftime as 'post' — treat it as 'in'
                if status == 'post' and 'half' in short_detail:
                    status = 'in'
                is_live = status == 'in'
                # Game start time (ISO 8601) → local time string
                game_dt_str = ev.get('date', '')  # e.g. "2026-03-05T00:00Z"
                game_time = ''
                if game_dt_str:
                    try:
                        dt_utc = datetime.fromisoformat(game_dt_str.replace('Z', '+00:00'))
                        # Convert to ET (UTC-5, approximate — good enough for display)
                        dt_et = dt_utc - timedelta(hours=5)
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
                        is_home = team.get('homeAway') == 'home'
                        team_own_score = home_score if is_home else away_score
                        team_opp_score = away_score if is_home else home_score

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
                            'team_score': team_own_score,   # THIS team's score
                            'opp_score': team_opp_score,    # opponent's score
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


def _detect_sport(ticker: str) -> str:
    """Detect sport from ticker prefix.
    Returns 'nba', 'ncaab', 'nfl', 'nhl', 'mlb', 'mls', 'epl', 'ucl', 'tennis', etc.
    Basketball sports: 'nba', 'ncaab', 'ncaaw', 'intl_basketball'
    """
    prefix = ticker.split('-')[0].upper() if ticker else ''
    if prefix.startswith('KXNBA'):
        return 'nba'
    if prefix.startswith('KXNCAAMB') or prefix.startswith('KXMARMAD'):
        return 'ncaab'
    if prefix.startswith('KXNCAAWB'):
        return 'ncaaw'
    if prefix.startswith('KXNFL') or prefix.startswith('KXNCAAF'):
        return 'nfl'
    if prefix.startswith('KXNHL'):
        return 'nhl'
    if prefix.startswith('KXMLB') or prefix.startswith('KXWBC'):
        return 'mlb'
    if prefix.startswith('KXMLS'):
        return 'mls'
    if prefix.startswith('KXEPL'):
        return 'epl'
    if prefix.startswith('KXUCL'):
        return 'ucl'
    if prefix.startswith('KXATP') or prefix.startswith('KXWTA'):
        return 'tennis'
    if prefix.startswith(('KXVTB', 'KXBSL', 'KXABA')):
        return 'intl_basketball'
    return 'unknown'


def _is_basketball(ticker: str) -> bool:
    """Check if a ticker is for a basketball sport (NBA, NCAAB, NCAAW, intl)."""
    return _detect_sport(ticker) in ('nba', 'ncaab', 'ncaaw', 'intl_basketball')


def _detect_market_type(ticker: str) -> str:
    """Detect market type from ticker prefix: 'spread', 'total', 'moneyline', 'prop', etc."""
    prefix = ticker.split('-')[0].upper() if ticker else ''
    if 'SPREAD' in prefix:
        return 'spread'
    if 'TOTAL' in prefix:
        return 'total'
    if 'GAME' in prefix or 'WINNER' in prefix or 'MATCH' in prefix:
        return 'moneyline'
    if any(k in prefix for k in ('PTS', 'REB', 'AST', '3PT', 'STL', 'BLK', 'GOAL', 'BTTS', 'MVP')):
        return 'prop'
    return 'moneyline'


def _extract_spread_line(ticker: str) -> str:
    """Extract spread line label from a spread ticker.

    For spread tickers like KXNBASPREAD-26MAR07UTAMIL-UTA1:
      - suffix = 'UTA1', team_code = 'UTA', tier_digit = '1'
      - Fetches Kalshi market title (e.g. 'Utah wins by over 3.5 Points?')
      - Returns 'UTA -3.5' (team favored if YES = team wins by that many)

    For non-spread tickers, returns ''.
    """
    if _detect_market_type(ticker) != 'spread':
        return ''
    parts = ticker.split('-')
    if len(parts) < 3:
        return ''
    suffix = parts[-1]  # e.g. 'UTA1', 'ORL3', 'BEL8'
    # Extract team code (alphabetic prefix) and tier digit
    code_match = re.match(r'^([A-Z]+)', suffix)
    team_code = code_match.group(1) if code_match else suffix

    # Try to get spread number from Kalshi market title
    try:
        if kalshi_client:
            api_rate_limiter.wait()
            mkt = kalshi_client.get_market(ticker)
            market_data = mkt.get('market', mkt)
            title = market_data.get('title', '')
            # "Utah wins by over 3.5 Points?" → spread = 3.5
            sp_match = re.search(r'wins?\s+by\s+over\s+([\d.]+)', title, re.IGNORECASE)
            if sp_match:
                return f'{team_code} -{sp_match.group(1)}'
            # Fallback: "UTA -3.5" style
            sp_match2 = re.search(r'([A-Z]{2,5})\s*([+-][\d.]+)', title)
            if sp_match2:
                return f'{sp_match2.group(1)} {sp_match2.group(2)}'
    except Exception as e:
        print(f'⚠ Could not fetch spread line for {ticker}: {e}')

    # Fallback: just show team code without line number
    return team_code


def _enrich_trade_record(record: dict, bot: dict = None) -> dict:
    """Add market_type and spread_line to a trade history record.
    Uses bot data if available, falls back to ticker parsing."""
    ticker = record.get('ticker', '')
    if bot:
        record['market_type'] = bot.get('market_type') or _detect_market_type(ticker)
        record['spread_line'] = bot.get('spread_line', '')
    else:
        record['market_type'] = _detect_market_type(ticker)
        record['spread_line'] = ''
    # Clean team_label for spread tickers — strip trailing digits
    tl = record.get('team_label', '')
    if record['market_type'] == 'spread' and tl:
        record['team_label'] = re.sub(r'\d+$', '', tl)
    # Correct stale pregame phase: if bot was deployed pregame but game is
    # actually live at trade completion time, record it as live.
    if record.get('game_phase') == 'pregame' and ticker and _is_game_live(ticker):
        record['game_phase'] = 'live'
    # Bot category for split P&L tracking
    bot_type = record.get('type') or (bot.get('type') if bot else None) or 'arb'
    if bot_type == 'watch':
        record['bot_category'] = 'bet'
    elif bot_type == 'middle':
        record['bot_category'] = 'middle'
    else:
        record['bot_category'] = 'arb'
    # Sport from series ticker prefix
    series = ticker.split('-')[0].upper() if ticker else ''
    _SPORT_MAP = {
        'KXNBAGAME':'NBA','KXNBASPREAD':'NBA','KXNBATOTAL':'NBA',
        'KXNBAPTS':'NBA','KXNBAREB':'NBA','KXNBAAST':'NBA','KXNBA3PT':'NBA',
        'KXNBASTL':'NBA','KXNBABLK':'NBA','KXNBAMVP':'NBA',
        'KXNFLGAME':'NFL','KXNFLSPREAD':'NFL','KXNFLTOTAL':'NFL',
        'KXNHLGAME':'NHL','KXNHLSPREAD':'NHL','KXNHLTOTAL':'NHL','KXNHLGOAL':'NHL',
        'KXMLBGAME':'MLB','KXMLBSPREAD':'MLB','KXMLBTOTAL':'MLB','KXMLBSTGAME':'MLB',
        'KXMLSGAME':'MLS','KXMLSSPREAD':'MLS','KXMLSTOTAL':'MLS',
        'KXNCAAMBGAME':'NCAAB','KXNCAAMBSPREAD':'NCAAB','KXNCAAMBTOTAL':'NCAAB',
        'KXNCAAMBPTS':'NCAAB','KXNCAAMBREB':'NCAAB','KXNCAAMBAST':'NCAAB',
        'KXNCAAMB3PT':'NCAAB','KXNCAAMBSTL':'NCAAB','KXNCAAMBBLK':'NCAAB',
        'KXNCAAMB1HWINNER':'NCAAB','KXNCAAMB1HSPREAD':'NCAAB','KXNCAAMB1HTOTAL':'NCAAB',
        'KXMARMAD':'NCAAB','KXNCAAWBGAME':'NCAAW',
        'KXNCAAFGAME':'NCAAF','KXNCAAFSPREAD':'NCAAF','KXNCAAFTOTAL':'NCAAF',
        'KXEPLGAME':'EPL','KXEPLSPREAD':'EPL','KXEPLTOTAL':'EPL','KXEPLGOAL':'EPL',
        'KXUCLGAME':'UCL','KXUCLSPREAD':'UCL','KXUCLTOTAL':'UCL','KXUCLGOAL':'UCL',
        'KXATPMATCH':'Tennis','KXWTAMATCH':'Tennis',
        'KXWBCGAME':'WBC','KXVTBGAME':'Volleyball','KXBSLGAME':'Basketball','KXABAGAME':'ABA',
    }
    record['sport'] = _SPORT_MAP.get(series, 'Other')
    return record


def _record_trade(record: dict, bot: dict = None):
    """Insert an enriched trade record into trade_history."""
    _enrich_trade_record(record, bot)
    trade_history.insert(0, record)


def _parse_ticker_teams(ticker: str):
    """Extract team codes from a Kalshi ticker. Returns list of candidate codes.
    Handles variable-length codes (2-6 chars) used by college sports.
    e.g. KXNCAAMBGAME-26MAR06WEBBHP → ['WEB', 'WEBB', 'BHP', 'WEBBH', 'HP', 'WEBBHP']
    """
    parts = ticker.split('-')
    if len(parts) < 2:
        return None, None
    stripped = re.sub(r'^\d{2}[A-Z]{3}\d{2}', '', parts[1])
    if len(stripped) < 4:
        return None, None
    # Try classic 3+3 first
    if len(stripped) >= 6:
        t1, t2 = stripped[:3].upper(), stripped[3:6].upper()
    else:
        t1, t2 = stripped[:2].upper(), stripped[2:].upper()
    return t1, t2


def _get_all_ticker_team_candidates(ticker: str):
    """Get all possible team code substrings from a ticker for ESPN matching.
    Returns a list of candidate codes to try against the ESPN cache."""
    parts = ticker.split('-')
    if len(parts) < 2:
        return []
    stripped = re.sub(r'^\d{2}[A-Z]{3}\d{2}', '', parts[1])
    if not stripped or len(stripped) < 4:
        return []
    candidates = []
    for i in range(2, min(7, len(stripped) - 1)):
        candidates.append(stripped[:i].upper())
        candidates.append(stripped[i:].upper())
    candidates.append(stripped.upper())
    return list(dict.fromkeys(candidates))  # dedupe preserving order


def _is_game_live(ticker: str) -> bool:
    """Check if the game referenced by a Kalshi ticker is currently live.
    
    Primary: Use Kalshi's own expected_expiration_time (same logic as frontend's isKalshiLive).
    A game is "live" if expected expiration is within 3.5 hours and market isn't settled.
    This works for ALL games Kalshi has — NBA, NCAAB, NIT, CBI, etc.
    
    Fallback: ESPN (only for games where Kalshi data isn't available).
    """
    # ── PRIMARY: Check Kalshi market data ──
    try:
        if kalshi_client:
            api_rate_limiter.wait()
            mkt_resp = kalshi_client.get_market(ticker)
            mkt = mkt_resp.get('market', mkt_resp) if isinstance(mkt_resp, dict) else {}
            exp_str = mkt.get('expected_expiration_time', '')
            result = mkt.get('result', '')
            
            # Already settled → not live
            if result and result != '':
                return False
            
            if exp_str:
                exp_time = datetime.fromisoformat(exp_str.replace('Z', '+00:00'))
                now_utc = datetime.now(timezone.utc)
                hours_until_exp = (exp_time - now_utc).total_seconds() / 3600.0
                
                # Game is "live" if expected to end within N hours and hasn't ended yet.
                # Tennis/tournament markets settle end-of-day → use 20h window.
                # Basketball/hockey/etc → 3.5h window.
                is_tennis = ticker.startswith('KXATP') or ticker.startswith('KXWTA')
                max_hours = 20.0 if is_tennis else 3.5
                if -0.5 < hours_until_exp < max_hours:
                    return True
                return False
    except Exception as e:
        print(f'⚠ Kalshi live check failed for {ticker}: {e} — falling back to ESPN')
    
    # ── FALLBACK: ESPN ── (only use if ticker date is today — prevents future markets from matching today's live teams)
    try:
        parts_fb = ticker.split('-')
        if len(parts_fb) >= 2:
            m_fb = re.match(r'^(\d{2})([A-Z]{3})(\d{2})', parts_fb[1])
            if m_fb:
                mo_fb = _MONTH_ABBR.get(m_fb.group(2))
                if mo_fb:
                    fb_date = date(2000 + int(m_fb.group(1)), mo_fb, int(m_fb.group(3)))
                    if fb_date != date.today():
                        return False  # Future (or past) game — never trust ESPN fallback
    except Exception:
        pass
    _refresh_espn_cache()
    info = _espn_cache['data']
    if not info:
        return False
    candidates = _get_all_ticker_team_candidates(ticker)
    if not candidates:
        t1, t2 = _parse_ticker_teams(ticker)
        candidates = [c for c in [t1, t2] if c]
    for code in candidates:
        espn_code = _KALSHI_TO_ESPN.get(code, code)
        entry = info.get(code) or info.get(espn_code)
        if entry and entry.get('live'):
            return True
    return False


def _get_spread_effective_tightness(ticker: str):
    """For spread tickers, return how close the actual lead is to the spread line.
    e.g. BOS -7.5, BOS leads by 9 → abs(9 - 7.5) = 1.5  (barely covering)
    e.g. BOS -7.5, BOS leads by 5 → abs(5 - 7.5) = 2.5  (not covering by 2.5)
    e.g. BOS -7.5, BOS leads by 15 → abs(15 - 7.5) = 7.5 (comfortable)
    Returns None if unable to compute (falls back to raw score_diff)."""
    if _detect_market_type(ticker) != 'spread':
        return None
    # Parse spread team from suffix (e.g. 'KXNBASPREAD-26MAR07UTAMIL-UTA1' → 'UTA')
    parts = ticker.split('-')
    if len(parts) < 3:
        return None
    code_match = re.match(r'^([A-Z]+)', parts[-1])
    if not code_match:
        return None
    spread_team = code_match.group(1)
    # Get spread value from Kalshi market title
    spread_line = _extract_spread_line(ticker)  # e.g. 'UTA -3.5'
    if not spread_line:
        return None
    sp_match = re.search(r'([\d.]+)$', spread_line.strip())
    if not sp_match:
        return None
    spread_pts = float(sp_match.group(1))
    # Look up spread team in fresh ESPN cache
    info = _espn_cache.get('data', {})
    espn_code = _KALSHI_TO_ESPN.get(spread_team, spread_team)
    entry = info.get(spread_team) or info.get(espn_code)
    if not entry or entry.get('status') != 'in':
        return None
    actual_lead = entry.get('team_score', 0) - entry.get('opp_score', 0)
    return abs(actual_lead - spread_pts)


def _get_game_context(ticker: str) -> dict:
    """Get live game context (quarter, score diff, clock) for blocking decisions.
    Always force-refreshes ESPN cache (bypasses TTL) so blocking uses fresh data.
    Also applies the same date guard as _get_game_score_for_ticker to avoid
    matching a different same-team game."""
    # Guard: if ticker is for a future game, no live context exists
    try:
        parts_chk = ticker.split('-')
        if len(parts_chk) >= 2:
            m_chk = re.match(r'^(\d{2})([A-Z]{3})(\d{2})', parts_chk[1])
            if m_chk:
                mo = _MONTH_ABBR.get(m_chk.group(2))
                if mo:
                    ticker_date = date(2000 + int(m_chk.group(1)), mo, int(m_chk.group(3)))
                    if ticker_date > date.today():
                        return {}
    except Exception:
        pass
    # Force-refresh: zero out timestamp so we always get fresh data for blocking
    global _espn_cache
    _espn_cache['ts'] = 0
    _refresh_espn_cache()
    info = _espn_cache['data']
    if not info:
        return {}
    candidates = _get_all_ticker_team_candidates(ticker)
    if not candidates:
        t1, t2 = _parse_ticker_teams(ticker)
        candidates = [c for c in [t1, t2] if c]
    for code in candidates:
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


_MONTH_ABBR = {'JAN':1,'FEB':2,'MAR':3,'APR':4,'MAY':5,'JUN':6,'JUL':7,'AUG':8,'SEP':9,'OCT':10,'NOV':11,'DEC':12}

def _get_game_score_for_ticker(ticker: str) -> dict:
    """Get live game score info for a ticker (for bot list UI display).
    Returns {home_team, away_team, home_score, away_score, period, clock, status_detail, status} or {}."""
    # Guard: skip if ticker date is in the future (avoids showing today's PHI game
    # on a bot whose ticker is for tomorrow's PHI vs CLE game)
    try:
        parts_chk = ticker.split('-')
        if len(parts_chk) >= 2:
            m_chk = re.match(r'^(\d{2})([A-Z]{3})(\d{2})', parts_chk[1])
            if m_chk:
                mo = _MONTH_ABBR.get(m_chk.group(2))
                if mo:
                    ticker_date = date(2000 + int(m_chk.group(1)), mo, int(m_chk.group(3)))
                    if ticker_date > date.today():
                        return {}  # Future game — don't match today's team scores
    except Exception:
        pass
    _refresh_espn_cache()
    info = _espn_cache['data']
    if not info:
        return {}
    candidates = _get_all_ticker_team_candidates(ticker)
    if not candidates:
        t1, t2 = _parse_ticker_teams(ticker)
        candidates = [c for c in [t1, t2] if c]
    # Find any candidate that has score data
    for code in candidates:
        espn_code = _KALSHI_TO_ESPN.get(code, code)
        entry = info.get(code) or info.get(espn_code)
        if entry and (entry.get('status') in ('in', 'post')):
            return {
                'home_score': entry.get('home_score', 0),
                'away_score': entry.get('away_score', 0),
                'score_diff': entry.get('score_diff', 0),
                'period': entry.get('period', 0),
                'clock': entry.get('clock', ''),
                'status_detail': entry.get('status_detail', ''),
                'status': entry.get('status', ''),
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
        bot_log('ORDER_PLACED', watch_bot_id or '', {'ticker': ticker, 'side': side, 'price': price, 'qty': quantity, 'order_id': order_id, 'watch': add_watch, 'fair_value': fair_value_cents})

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
        stop_loss_cents = max(1, int(data.get('stop_loss_cents', 5)))  # ¢ drop for watch bots (props/straight)
        flip_threshold  = int(data.get('flip_threshold', FLIP_THRESHOLD_CENTS))  # arb: sell if bid ≤ this (favorite flipped)
        # Auto-detect game phase from ESPN — no manual setting needed
        # But allow manual override for games ESPN doesn't cover (NIT, CBI, etc.)
        manual_phase = data.get('game_phase')
        if manual_phase in ('live', 'pregame'):
            game_phase = manual_phase
        else:
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

            # Block deployment when either side has NO real bids.
            # A derived price (e.g. YES=87¢ from 100-1-12) isn't a real order —
            # nobody is there to fill it. Both sides need real liquidity.
            if live_yes_bid <= 0:
                return jsonify({'error': f'No YES bids in the orderbook — the YES price is derived, not real. This arb is phantom.'}), 400
            if live_no_bid <= 0:
                return jsonify({'error': f'No NO bids in the orderbook — the NO price is derived, not real. This arb is phantom.'}), 400
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

        # ── Guardrail: don't deploy fav side below MIN_FAV_ENTRY ──
        # Only applies when profit margin is thin (< 25¢) = competitive market
        # where a low fav price means the thesis is actually breaking.
        # When profit is fat (≥ 25¢), both sides are cheap due to illiquidity
        # — that's a legit arb, not a falling knife.
        profit_per = 100 - fav_price - dog_price
        if fav_price < MIN_FAV_ENTRY_CENTS and profit_per < 25:
            return jsonify({
                'error': f'Favorite side ({fav_side.upper()}) entry at {fav_price}¢ is below the {MIN_FAV_ENTRY_CENTS}¢ minimum '
                         f'and profit is only {profit_per}¢. '
                         f'The favorite has dropped too far — this is a falling knife, not a dip buy. '
                         f'Wait for it to recover or skip this market.'
            }), 400

        # ── Guardrail: block deployment in tight basketball games ──
        # Basketball-specific: tight late-game situations are the #1 source of
        # catastrophic flip losses. When score is within 5 points in the
        # decisive stretch, markets swing wildly and trigger cascading stop losses.
        # Data: 62% win rate but -$39 net on tight games — tail risk.
        # Rules by sport:
        #   NBA / NCAAW (4 quarters): block in Q4+ / OT
        #   NCAAB men's (2 halves):  block if 2nd half AND ≤ 10 min remaining
        # Allow override with force_tight=True for manual conviction plays.
        TIGHT_GAME_MAX_DIFF = 5
        force_tight = data.get('force_tight', False)
        if game_phase == 'live' and not force_tight and _is_basketball(ticker):
            gc = _get_game_context(ticker)
            if gc:
                # For spread tickers compare lead vs spread line; for moneyline use raw diff
                if _detect_market_type(ticker) == 'spread':
                    spread_tight = _get_spread_effective_tightness(ticker)
                    sd = spread_tight if spread_tight is not None else gc.get('score_diff', 999)
                    diff_label = f'{sd:.1f}-pt spread margin'
                else:
                    sd = gc.get('score_diff', 999)
                    diff_label = f'{sd}-pt lead'
                period = gc.get('period', 0)
                clock_str = gc.get('clock', '')
                sport = _detect_sport(ticker)

                # Parse clock to minutes remaining (format: "MM:SS" or "M:SS")
                clock_mins = 999
                clock_match = re.match(r'(\d+):(\d+)', clock_str)
                if clock_match:
                    clock_mins = int(clock_match.group(1)) + int(clock_match.group(2)) / 60

                # Determine if we're in the dangerous stretch
                in_danger_zone = False
                zone_label = ''
                if sport == 'ncaab':  # Men's college: 2 halves, then OT periods
                    # period 1 = 1st half, period 2 = 2nd half, period 3+ = OT
                    if period == 2 and clock_mins <= 10 and sd <= TIGHT_GAME_MAX_DIFF:
                        in_danger_zone = True
                        zone_label = f'2nd half ({clock_str} remaining)'
                    elif period >= 3 and sd <= TIGHT_GAME_MAX_DIFF:  # OT
                        in_danger_zone = True
                        ot_num = period - 2
                        zone_label = f'OT{ot_num if ot_num > 1 else ""}'
                else:  # NBA, NCAAW (4 quarters), OT
                    if period >= 4 and sd <= TIGHT_GAME_MAX_DIFF:
                        in_danger_zone = True
                        if period == 4:
                            zone_label = 'Q4'
                        else:
                            ot_num = period - 4
                            zone_label = f'OT{ot_num if ot_num > 1 else ""}'

                if in_danger_zone:
                    return jsonify({
                        'error': f'🛑 TIGHT GAME BLOCKED: {diff_label} in {zone_label}. '
                                 f'Late close games swing wildly and can trigger stop-losses on both sides. '
                                 f'Wait for the lead to grow, or use the force option to override.',
                        'tight_game_blocked': True,
                        'score_diff': sd,
                        'period': period,
                    }), 400

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
            'flip_threshold':   flip_threshold,
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
            'live_yes_bid':     live_yes_bid,
            'live_no_bid':      live_no_bid,
            'live_yes_ask':     0,
            'live_no_ask':      0,
            'last_price_update': time.time(),
            'market_type':      _detect_market_type(ticker),
            'spread_line':      _extract_spread_line(ticker),
        }
        save_state()
        bot_log('BOT_CREATED', bot_id, {'fav_side': fav_side, 'fav_price': fav_price, 'dog_side': dog_side, 'dog_price': dog_price, 'profit_per': profit_per, 'qty': quantity, 'game_phase': game_phase, 'repeat_count': repeat_count})

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
        active_statuses = ('fav_posted', 'pending_fills', 'yes_filled', 'no_filled', 'watching', 'waiting_repeat', 'waiting', 'one_filled', 'both_filled')

        # ── Auto-phase: switch pregame → live when game is in progress ──
        for bot_id, bot in list(active_bots.items()):
            if bot.get('game_phase') == 'pregame' and bot['status'] in active_statuses:
                if bot.get('type') == 'watch':
                    continue
                try:
                    if _is_game_live(bot['ticker']):
                        bot['game_phase'] = 'live'
                        bot['posted_at'] = time.time()  # restart timeout counters
                        actions.append({'bot_id': bot_id, 'action': 'auto_phase_live'})
                        bot_log('AUTO_PHASE_LIVE', bot_id, {'reason': 'Kalshi expected_expiration within window'})
                        print(f'🏟 AUTO-PHASE: {bot_id} switched to LIVE (game in progress)')
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
                        mkt_data = mkt_check.get('market', mkt_check)
                        mkt_status = mkt_data.get('status', 'active')
                        mkt_result = mkt_data.get('result', '')  # 'yes' or 'no' when settled
                        if mkt_status in ('closed', 'settled', 'finalized'):
                            # Check fill status of each leg
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
                                orig_repeat_count = bot.get('repeat_count', 0)
                                bot['repeat_count'] = 0
                                session_pnl['gross_profit_cents'] += profit_cents
                                session_pnl['completed_bots'] += 1
                                _record_trade({
                                    'bot_id': bot_id, 'ticker': ticker,
                                    'yes_price': real_yes, 'no_price': real_no,
                                    'quantity': qty, 'profit_cents': profit_cents,
                                    'result': 'completed', 'timestamp': now,
                                    'note': f'market {mkt_status} — both legs filled',
                                    'game_phase': bot.get('game_phase', ''),
                                    'repeats_done': bot.get('repeats_done', 0),
                                    'repeat_count': orig_repeat_count,
                                }, bot)
                                bot_log('SETTLEMENT_COMPLETE', bot_id, {'profit_cents': profit_cents, 'real_yes': real_yes, 'real_no': real_no, 'market_status': mkt_status})
                                print(f'🏁 SETTLED COMPLETE: {bot_id} — both legs filled, +{profit_cents}¢')
                            elif yes_f >= qty and no_f < qty:
                                # YES filled, NO never filled — check settlement result
                                if bot.get('no_order_id'):
                                    try:
                                        api_rate_limiter.wait()
                                        kalshi_client.cancel_order(bot['no_order_id'])
                                    except Exception:
                                        pass
                                orig_repeat_count = bot.get('repeat_count', 0)
                                bot['repeat_count'] = 0
                                if mkt_result == 'yes':
                                    # YES won — our YES position pays out 100¢ each
                                    profit = (100 - bot['yes_price']) * yes_f
                                    bot['status'] = 'completed'
                                    bot['completed_at'] = now
                                    session_pnl['gross_profit_cents'] += profit
                                    session_pnl['completed_bots'] += 1
                                    _record_trade({
                                        'bot_id': bot_id, 'ticker': ticker,
                                        'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                        'quantity': yes_f, 'profit_cents': profit,
                                        'result': 'settled_win_yes', 'timestamp': now,
                                        'note': f'market settled YES — YES leg won, +{profit}¢',
                                        'game_phase': bot.get('game_phase', ''),
                                        'arb_width': bot.get('arb_width', 0),
                                        'first_leg': bot.get('first_leg', ''),
                                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                                        'repeats_done': bot.get('repeats_done', 0),
                                        'repeat_count': orig_repeat_count,
                                    }, bot)
                                    bot_log('SETTLEMENT_WIN', bot_id, {'leg': 'yes', 'filled_qty': yes_f, 'price': bot['yes_price'], 'profit_cents': profit, 'market_result': mkt_result})
                                    print(f'🏆 SETTLED WIN: {bot_id} — YES filled ({yes_f}×{bot["yes_price"]}¢), market settled YES, +{profit}¢')
                                else:
                                    # YES lost — we lose the cost
                                    bot['status'] = 'stopped'
                                    bot['stopped_at'] = now
                                    loss = bot['yes_price'] * yes_f
                                    session_pnl['gross_loss_cents'] += loss
                                    session_pnl['stopped_bots'] += 1
                                    _record_trade({
                                        'bot_id': bot_id, 'ticker': ticker,
                                        'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                        'quantity': yes_f, 'loss_cents': loss,
                                        'result': 'settled_loss_yes', 'timestamp': now,
                                        'note': f'market settled {mkt_result or "NO"} — YES leg lost, -{loss}¢',
                                        'game_phase': bot.get('game_phase', ''),
                                        'arb_width': bot.get('arb_width', 0),
                                        'first_leg': bot.get('first_leg', ''),
                                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                                        'repeats_done': bot.get('repeats_done', 0),
                                        'repeat_count': orig_repeat_count,
                                    }, bot)
                                    bot_log('SETTLEMENT_LOSS', bot_id, {'leg': 'yes', 'filled_qty': yes_f, 'price': bot['yes_price'], 'loss_cents': loss, 'market_result': mkt_result})
                                    print(f'⚠ SETTLED LOSS: {bot_id} — YES filled ({yes_f}×{bot["yes_price"]}¢), market settled {mkt_result or "NO"}, -{loss}¢')
                            elif no_f >= qty and yes_f < qty:
                                # NO filled, YES never filled — check settlement result
                                if bot.get('yes_order_id'):
                                    try:
                                        api_rate_limiter.wait()
                                        kalshi_client.cancel_order(bot['yes_order_id'])
                                    except Exception:
                                        pass
                                orig_repeat_count = bot.get('repeat_count', 0)
                                bot['repeat_count'] = 0
                                if mkt_result == 'no':
                                    # NO won — our NO position pays out 100¢ each
                                    profit = (100 - bot['no_price']) * no_f
                                    bot['status'] = 'completed'
                                    bot['completed_at'] = now
                                    session_pnl['gross_profit_cents'] += profit
                                    session_pnl['completed_bots'] += 1
                                    _record_trade({
                                        'bot_id': bot_id, 'ticker': ticker,
                                        'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                        'quantity': no_f, 'profit_cents': profit,
                                        'result': 'settled_win_no', 'timestamp': now,
                                        'note': f'market settled NO — NO leg won, +{profit}¢',
                                        'game_phase': bot.get('game_phase', ''),
                                        'arb_width': bot.get('arb_width', 0),
                                        'first_leg': bot.get('first_leg', ''),
                                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                                        'repeats_done': bot.get('repeats_done', 0),
                                        'repeat_count': orig_repeat_count,
                                    }, bot)
                                    bot_log('SETTLEMENT_WIN', bot_id, {'leg': 'no', 'filled_qty': no_f, 'price': bot['no_price'], 'profit_cents': profit, 'market_result': mkt_result})
                                    print(f'🏆 SETTLED WIN: {bot_id} — NO filled ({no_f}×{bot["no_price"]}¢), market settled NO, +{profit}¢')
                                else:
                                    # NO lost — we lose the cost
                                    bot['status'] = 'stopped'
                                    bot['stopped_at'] = now
                                    loss = bot['no_price'] * no_f
                                    session_pnl['gross_loss_cents'] += loss
                                    session_pnl['stopped_bots'] += 1
                                    _record_trade({
                                        'bot_id': bot_id, 'ticker': ticker,
                                        'yes_price': bot['yes_price'], 'no_price': bot['no_price'],
                                        'quantity': no_f, 'loss_cents': loss,
                                        'result': 'settled_loss_no', 'timestamp': now,
                                        'note': f'market settled {mkt_result or "YES"} — NO leg lost, -{loss}¢',
                                        'game_phase': bot.get('game_phase', ''),
                                        'arb_width': bot.get('arb_width', 0),
                                        'first_leg': bot.get('first_leg', ''),
                                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                                        'repeats_done': bot.get('repeats_done', 0),
                                        'repeat_count': orig_repeat_count,
                                    }, bot)
                                    bot_log('SETTLEMENT_LOSS', bot_id, {'leg': 'no', 'filled_qty': no_f, 'price': bot['no_price'], 'loss_cents': loss, 'market_result': mkt_result})
                                    print(f'⚠ SETTLED LOSS: {bot_id} — NO filled ({no_f}×{bot["no_price"]}¢), market settled {mkt_result or "YES"}, -{loss}¢')
                            else:
                                # Neither leg filled — no cost, just clean up
                                bot['status'] = 'completed'
                                bot['completed_at'] = now
                                bot_log('SETTLEMENT_CLEAN', bot_id, {'market_status': mkt_status})
                                print(f'🏁 MARKET SETTLED: {bot_id} — no fills, clean exit')
                            actions.append({'bot_id': bot_id, 'action': 'market_settled', 'market_status': mkt_status})
                            save_state()
                            continue
                    except Exception:
                        pass  # If API fails, proceed with normal monitoring

                # ── FAV-FIRST: favorite order posted, waiting for fill ────
                if bot.get('status') == 'fav_posted':
                    # Skip if WS fill handler is already processing this bot
                    if bot.get('_ws_fill_handling'):
                        print(f'⚡ SKIPPING monitor fav check for {bot_id} — WS real-time already handling')
                        continue
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

                            bot_log('FAV_FILLED_DOG_POSTED', bot_id, {'fav_side': fav_side, 'fav_price': fav_price, 'dog_side': dog_side, 'dog_price': dog_price, 'profit_per': bot['profit_per']})
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

                                # If bid is AT or BELOW our order price, market is moving toward us
                                # (or already there) — the order will fill naturally. Don't repost.
                                # If bid is ABOVE our order price, the market has moved on and our
                                # order is stale/buried — repost at the new level to stay competitive.
                                if cur_fav_bid <= bot['fav_price']:
                                    print(f'⏳ FAV REPOST SKIPPED: {bot_id} bid {cur_fav_bid}¢ <= order {bot["fav_price"]}¢ — market closing toward us, leaving alone')
                                    bot['posted_at'] = now  # reset timer so we re-check in another 3 min
                                    save_state()
                                    continue

                                # Width-aware cap: use the CURRENT live dog-side bid, not the
                                # stale stored price from deployment. Market may have moved
                                # (e.g. YES 79→99, NO 12→1) so we must re-check live.
                                # fav_cap = 100 - live_dog_bid - min_width
                                dog_side_rp  = 'no' if fav_side == 'yes' else 'yes'
                                min_width_rp = bot.get('arb_width', bot.get('profit_per', 3))
                                # Get current dog bid from ws_price (already fetched above) or market
                                if ws_price:
                                    cur_dog_bid = ws_price.get(f'{dog_side_rp}_bid', 0)
                                else:
                                    cur_dog_bid = 0
                                    try:
                                        _m2 = kalshi_client.get_market(ticker)
                                        _mk2 = _m2.get('market', _m2)
                                        _d2 = _mk2.get(f'{dog_side_rp}_bid_dollars')
                                        cur_dog_bid = round(float(_d2) * 100) if _d2 else _mk2.get(f'{dog_side_rp}_bid', 0)
                                    except Exception:
                                        pass
                                # If dog bid is 0, the game is over — no hedge possible.
                                # Cancel the fav and exit instead of reposting into a dead market.
                                if cur_dog_bid == 0:
                                    print(f'🏁 FAV REPOST ABORTED: {bot_id} {dog_side_rp.upper()} bid=0¢ — game likely over, cancelling')
                                    try:
                                        api_rate_limiter.wait()
                                        kalshi_client.cancel_order(fav_order_id)
                                    except Exception:
                                        pass
                                    bot['status'] = 'completed'
                                    bot['completed_at'] = now
                                    bot_log('FAV_NO_HEDGE_MARKET', bot_id, {'fav_side': fav_side, 'dog_side': dog_side_rp, 'fav_bid': cur_fav_bid})
                                    actions.append({'bot_id': bot_id, 'action': 'fav_no_hedge_cancelled'})
                                    save_state()
                                    continue
                                max_fav_for_width = 100 - cur_dog_bid - min_width_rp
                                new_fav_price = min(cur_fav_bid, 98, max_fav_for_width) if cur_fav_bid > 0 else bot['fav_price']
                                new_fav_price = max(1, new_fav_price)
                                # Falling knife guard: don't repost fav below MIN_FAV_ENTRY_CENTS
                                if new_fav_price < MIN_FAV_ENTRY_CENTS:
                                    print(f'🔪 FAV REPOST BLOCKED: {bot_id} {fav_side.upper()} bid={new_fav_price}¢ < {MIN_FAV_ENTRY_CENTS}¢ — falling knife, cancelling')
                                    try:
                                        api_rate_limiter.wait()
                                        kalshi_client.cancel_order(fav_order_id)
                                    except Exception:
                                        pass
                                    bot['status'] = 'completed'
                                    bot['completed_at'] = now
                                    bot_log('FAV_FALLING_KNIFE', bot_id, {'fav_side': fav_side, 'bid': new_fav_price, 'min': MIN_FAV_ENTRY_CENTS})
                                    actions.append({'bot_id': bot_id, 'action': 'fav_falling_knife_cancelled'})
                                    save_state()
                                    continue
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
                                bot_log('FAV_REPOSTED', bot_id, {'fav_side': fav_side, 'new_price': new_fav_price, 'repost_count': bot['repost_count']})
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
                            bot_log('FAV_STALE_CANCELLED', bot_id, {'fav_side': fav_side, 'age_min': round(age_min, 1)})
                            print(f'⏰ FAV STALE: {bot_id} favorite {fav_side.upper()} unfilled after {age_min:.1f}m — cancelled')
                            actions.append({'bot_id': bot_id, 'action': 'fav_stale_cancelled'})

                        # Store live prices for frontend display even while waiting
                        try:
                            ws_p = ws_manager.get_price(ticker)
                            if ws_p:
                                bot['live_yes_bid'] = ws_p.get('yes_bid', 0)
                                bot['live_no_bid']  = ws_p.get('no_bid', 0)
                                bot['live_yes_ask'] = ws_p.get('yes_ask', 0)
                                bot['live_no_ask']  = ws_p.get('no_ask', 0)
                            else:
                                api_rate_limiter.wait()
                                _m = kalshi_client.get_market(ticker)
                                _mk = _m.get('market', _m)
                                def _tc(f):
                                    d = _mk.get(f + '_dollars')
                                    if d: return round(float(d) * 100)
                                    return _mk.get(f, 0)
                                bot['live_yes_bid'] = _tc('yes_bid')
                                bot['live_no_bid']  = _tc('no_bid')
                                bot['live_yes_ask'] = _tc('yes_ask')
                                bot['live_no_ask']  = _tc('no_ask')
                            bot['last_price_update'] = now
                        except Exception:
                            pass
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
                                bot_log('WATCH_SETTLED_UNFILLED', bot_id, {'market_status': mkt_status_w})
                                print(f'🏁 WATCH SETTLED (unfilled): {bot_id} — market {mkt_status_w}, order never filled')
                                actions.append({'bot_id': bot_id, 'action': 'watch_settled_unfilled'})
                                save_state()
                                continue
                            else:
                                # Position was filled — market settled, Kalshi auto-settles it
                                mkt_data_w  = mkt_check_w.get('market', mkt_check_w)
                                mkt_result_w = mkt_data_w.get('result', '').lower()  # 'yes' or 'no'
                                watch_side  = bot.get('side', 'yes')
                                entry       = bot.get('entry_price', 50)
                                qty         = bot.get('quantity', 1)
                                won = (mkt_result_w == watch_side) if mkt_result_w else None
                                if won is True:
                                    profit_cents = (100 - entry) * qty
                                    loss_cents   = 0
                                    res_label    = 'take_profit_watch'
                                    session_pnl['gross_profit_cents'] += profit_cents
                                    session_pnl['completed_bots']     += 1
                                elif won is False:
                                    profit_cents = 0
                                    loss_cents   = entry * qty
                                    res_label    = 'stop_loss_watch'
                                    session_pnl['gross_loss_cents'] += loss_cents
                                    session_pnl['stopped_bots']     += 1
                                else:
                                    # Result unknown yet; skip recording until we know
                                    profit_cents = loss_cents = 0
                                    res_label    = 'settled_unknown'
                                if mkt_result_w:  # only record if we have a result
                                    _record_trade({
                                        'bot_id': bot_id, 'ticker': ticker,
                                        'side': watch_side, 'entry_price': entry,
                                        'quantity': qty,
                                        'profit_cents': profit_cents,
                                        'loss_cents': loss_cents,
                                        'result': res_label,
                                        'timestamp': now,
                                        'placed_at': bot.get('created_at', now),
                                        'type': 'watch',
                                    }, bot)
                                bot['status'] = 'completed'
                                bot['completed_at'] = now
                                bot_log('WATCH_SETTLED_FILLED', bot_id, {'market_status': mkt_status_w, 'result': mkt_result_w, 'won': won})
                                print(f'🏁 WATCH SETTLED (filled): {bot_id} — {mkt_result_w} won, {"profit" if won else "loss"} recorded')
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
                                bot_log('WATCH_ORDER_FILLED', bot_id, {'side': watch_side, 'qty': qty, 'entry': entry})
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
                                bot_log('WATCH_ORDER_CANCELLED', bot_id, {'order_status': order_status})
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
                                bot_log('SL_BLOCKED_STALE_WS', bot_id, {'ws_bid': cur_bid, 'rest_bid': rest_bid, 'trigger': entry - sl}, level='WARN')
                                print(f'🛡 WATCH SL BLOCKED: {bot_id} WS bid {cur_bid}¢ but REST bid {rest_bid}¢ > trigger {entry - sl}¢ — WS was stale')
                                bot['live_bid'] = rest_bid  # correct the cached bid
                                cur_bid = rest_bid
                                actions.append({'bot_id': bot_id, 'action': 'watch_sl_blocked_stale_ws',
                                               'ws_bid': bot.get('live_bid', 0), 'rest_bid': rest_bid})
                                # Skip this SL — bid is not actually breached
                            else:
                                # REST confirms SL breach — update cur_bid to REST value
                                bot_log('SL_CONFIRMED_REST', bot_id, {'rest_bid': rest_bid, 'trigger': entry - sl, 'ws_bid': cur_bid})
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
                            _record_trade({
                        'bot_id': bot_id, 'ticker': ticker, 'type': 'watch',
                        'side': watch_side, 'entry_price': entry,
                        'exit_bid': actual_sell, 'quantity': qty,
                        'loss_cents': loss, 'result': 'stop_loss_watch',
                        'timestamp': now,
                        'placed_at': bot.get('created_at', now),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                        'stop_loss_cents': sl,
                        'game_context': _get_game_context(ticker),
                    }, bot)
                            actions.append({'bot_id': bot_id, 'action': 'stop_loss_watch',
                                           'loss_cents': loss})
                            bot_log('WATCH_SL_FIRED', bot_id, {'entry': entry, 'exit': actual_sell, 'loss_cents': loss, 'sl_trigger': entry - sl, 'live_bid': cur_bid})
                        else:
                            bot_log('WATCH_SL_FAILED', bot_id, {'sell_info': str(sell_info)}, level='ERROR')
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
                            _record_trade({
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
                    }, bot)
                            actions.append({'bot_id': bot_id, 'action': 'take_profit_watch',
                                           'profit_cents': profit})
                            bot_log('WATCH_TP_FIRED', bot_id, {'entry': entry, 'exit': actual_sell, 'profit_cents': profit, 'tp_trigger': entry + tp, 'live_bid': cur_bid})
                        else:
                            bot_log('WATCH_TP_FAILED', bot_id, {'sell_info': str(sell_info)}, level='ERROR')
                            print(f'⚠ Watch TP sell FAILED for {bot_id} — will retry next cycle')
                            actions.append({'bot_id': bot_id, 'action': 'take_profit_watch_FAILED',
                                           'info': str(sell_info)})
                    continue

                # ── WAITING REPEAT: keep checking for spread to reopen ─────
                if bot['status'] == 'waiting_repeat':
                    target_width = bot.get('arb_width', bot.get('profit_per', 5))
                    wait_age_min = (now - bot.get('waiting_repeat_since', now)) / 60.0

                    # Give up after 5 minutes of waiting
                    if wait_age_min > 5:
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

                    # Bail immediately if the game is decided (one side 95+¢)
                    # — spread will never reopen, no point waiting
                    if fresh_yes_bid >= 95 or fresh_no_bid >= 95:
                        bot['status'] = 'completed'
                        print(f'🏁 REPEAT SKIP: {bot_id} game decided (Y={fresh_yes_bid}¢ N={fresh_no_bid}¢) — no spread to exploit')
                        actions.append({'bot_id': bot_id, 'action': 'repeat_game_over'})
                        continue

                    # Also bail if either side has no bids at all
                    if fresh_yes_bid == 0 or fresh_no_bid == 0:
                        # Don't burn API calls — skip this cycle, will timeout naturally
                        actions.append({'bot_id': bot_id, 'action': 'repeat_waiting', 'y_bid': fresh_yes_bid, 'n_bid': fresh_no_bid})
                        continue

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

                            # If underdog can't absorb its share, push overflow to favorite
                            dog_bid = fresh_no_bid if yes_is_fav else fresh_yes_bid
                            dog_max_shave = max(0, dog_bid - 1)
                            if dog_shave > dog_max_shave:
                                overflow = dog_shave - dog_max_shave
                                dog_shave = dog_max_shave
                                fav_shave = fav_shave + overflow

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
                if bot.get('_ws_fill_handling'):
                    # Don't blanket-skip — check if this is a stale flag
                    # (race condition: flag set but completion never triggered)
                    yes_f = bot.get('yes_fill_qty', 0)
                    no_f  = bot.get('no_fill_qty', 0)
                    if yes_f >= qty and no_f >= qty:
                        print(f'⚡ MONITOR FIX: {bot_id} has _ws_fill_handling stuck but both legs filled — completing!')
                        bot.pop('_ws_fill_handling', None)
                        # Fall through to normal completion logic below
                    else:
                        print(f'⚡ SKIPPING monitor fill check for {bot_id} — WS real-time already handling')
                        continue
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
                    _record_trade({
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
                        'flip_threshold': bot.get('flip_threshold', FLIP_THRESHOLD_CENTS),
                        'stop_loss_cents': bot.get('stop_loss_cents', 0),
                        'game_context': _get_game_context(ticker),
                        'repeats_done': bot.get('repeats_done', 0),
                        'repeat_count': bot.get('repeat_count', 0),
                    }, bot)
                    actions.append({'bot_id': bot_id, 'action': 'completed', 'profit_cents': profit_cents})
                    bot_log('ARB_COMPLETED', bot_id, {'real_yes': real_yes, 'real_no': real_no, 'profit_cents': profit_cents, 'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None})

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
                # PREGAME: Patient mode — orders sit, no repost/resize.
                # If one side fills, fall through to the LIVE stop-loss
                # logic (which has grace period + recovery checks).
                # ═══════════════════════════════════════════════════════════
                if phase == 'pregame':
                    # Update status labels for UI display
                    if yes_filled >= qty and no_filled < qty:
                        bot['status'] = 'yes_filled'
                        if not bot.get('first_fill_at'):
                            bot['first_fill_at'] = now
                            bot['first_leg'] = 'yes'
                        # Fill happened — fall through to live SL logic below
                    elif no_filled >= qty and yes_filled < qty:
                        bot['status'] = 'no_filled'
                        if not bot.get('first_fill_at'):
                            bot['first_fill_at'] = now
                            bot['first_leg'] = 'no'
                        # Fill happened — fall through to live SL logic below
                    elif yes_filled >= qty and no_filled >= qty:
                        # Both filled — let the pending_fills handler above deal with it
                        continue
                    else:
                        # No fills yet — just wait (no repost/resize in pregame)
                        continue

                # ═══════════════════════════════════════════════════════════
                # LIVE: Active management — repost, resize, stop-loss
                # ═══════════════════════════════════════════════════════════

                # ── Stale order repost (no fills after REPOST_AFTER_MINUTES) ──
                # NEVER go above the current bid. Repost AT the bid to stay competitive
                # without overpaying. Favorite-anchoring: shave less from the fav side.
                if yes_filled == 0 and no_filled == 0 and age_min >= REPOST_AFTER_MINUTES:
                    # Danger-zone guard: don't chase the market in tight late-game situations.
                    # Same rules as deploy-block: NBA/NCAAW Q4+, NCAAB 2nd-half ≤10 min,
                    # both using spread-adjusted margin for spread tickers.
                    if _is_basketball(ticker):
                        _gc = _get_game_context(ticker)
                        if _gc:
                            if _detect_market_type(ticker) == 'spread':
                                _sd = _get_spread_effective_tightness(ticker)
                                if _sd is None: _sd = _gc.get('score_diff', 999)
                            else:
                                _sd = _gc.get('score_diff', 999)
                            _period = _gc.get('period', 0)
                            _clock_str = _gc.get('clock', '')
                            _sport_r = _detect_sport(ticker)
                            _cmins = 999
                            _cm = re.match(r'(\d+):(\d+)', _clock_str)
                            if _cm: _cmins = int(_cm.group(1)) + int(_cm.group(2)) / 60
                            _in_danger = False
                            if _sport_r == 'ncaab':
                                _in_danger = ((_period == 2 and _cmins <= 10 and _sd <= 5) or
                                              (_period >= 3 and _sd <= 5))
                            else:  # NBA, NCAAW (4 quarters)
                                _in_danger = _period >= 4 and _sd <= 5
                            if _in_danger:
                                print(f'⛔ REPOST BLOCKED (danger zone): {bot_id} '
                                      f'— {_sport_r} P{_period} {_clock_str}, margin={_sd:.1f}¢')
                                continue
                    # Width-aware repost: identify fav (higher bid) and dog (lower bid).
                    # Dog posts at its current bid — fav is capped so that
                    # fav + dog = 100 - min_width, preserving target spread.
                    # Example: yes_bid=99, no_bid=1, width=5 → new_no=1, new_yes=94.
                    min_width = bot.get('arb_width', bot.get('profit_per', 3))
                    if yes_bid >= no_bid:   # YES is fav, NO is dog
                        new_no  = max(1, min(no_bid,  98))
                        new_yes = min(yes_bid, 98, 100 - new_no - min_width)
                    else:                   # NO is fav, YES is dog
                        new_yes = max(1, min(yes_bid, 98))
                        new_no  = min(no_bid,  98, 100 - new_yes - min_width)
                    new_yes = max(1, new_yes)
                    new_no  = max(1, new_no)
                    # Falling knife guard: don't repost if fav side has dropped below MIN_FAV_ENTRY_CENTS
                    fav_price = max(new_yes, new_no)
                    if fav_price < MIN_FAV_ENTRY_CENTS:
                        print(f'🔪 REPOST BLOCKED: {bot_id} fav bid={fav_price}¢ < {MIN_FAV_ENTRY_CENTS}¢ — falling knife, cancelling bot')
                        try:
                            api_rate_limiter.wait()
                            kalshi_client.cancel_order(bot['yes_order_id'])
                            api_rate_limiter.wait()
                            kalshi_client.cancel_order(bot['no_order_id'])
                        except Exception:
                            pass
                        bot['status'] = 'completed'
                        bot['completed_at'] = now
                        bot_log('REPOST_FALLING_KNIFE', bot_id, {'yes_bid': new_yes, 'no_bid': new_no, 'min': MIN_FAV_ENTRY_CENTS})
                        actions.append({'bot_id': bot_id, 'action': 'repost_falling_knife_cancelled'})
                        save_state()
                        continue
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

                # Dog leg is NEVER reposted regardless of which side is fav.
                # Applies to both YES-dog (when NO is fav) and NO-dog (when YES is fav).
                # Chasing the dog away from the original price breaks the arb width.

                # ── YES fully filled, NO still open — FLIP THRESHOLD check ──
                if yes_filled >= qty and no_filled < qty:
                    bot['status'] = 'yes_filled'
                    if not bot.get('first_fill_at'):
                        bot['first_fill_at'] = now
                        bot['first_leg'] = 'yes'

                    flip_thresh = bot.get('flip_threshold', FLIP_THRESHOLD_CENTS)
                    entry_yes = bot['yes_price']

                    # Dynamic trigger: max(entry-15, floor) but capped so room >= 10¢
                    effective_trigger = max(entry_yes - FLIP_ENTRY_MARGIN, min(flip_thresh, entry_yes - 10))
                    # Only apply flip SL to favorite entries (entered at ≥ floor).
                    # Underdog entries (below floor) ride to settlement — max loss is small.
                    if entry_yes >= flip_thresh and yes_bid < effective_trigger:
                        # Favorite has FLIPPED — bid < threshold = no longer favored, sell now
                        if bot['status'] in ('stopped', 'completed', 'flipping'):
                            print(f'⛔ SKIPPING duplicate FLIP SL YES for {bot_id} — already {bot["status"]}')
                            continue
                        if bot.get('_ws_flip_selling'):
                            print(f'⚡ SKIPPING monitor FLIP YES for {bot_id} — WS real-time already handling')
                            continue
                        print(f'🔄 FLIP THRESHOLD: {bot_id} YES bid {yes_bid}¢ < {effective_trigger}¢ (entry {entry_yes}¢) — favorite flipped, selling')
                        bot_log('ARB_FLIP_FIRED', bot_id, {'leg': 'yes', 'entry': entry_yes, 'bid': yes_bid, 'threshold': effective_trigger, 'floor': flip_thresh, 'source': 'monitor'})
                        # Mark as flipping BEFORE execute_sell so monitor can't re-enter during the 3-4s sell
                        bot['status'] = 'flipping'
                        sold, sell_info = execute_sell(ticker, 'yes', yes_filled, reason=f'arb_flip_yes_{bot_id}')
                        if sold:
                            try:
                                api_rate_limiter.wait()
                                kalshi_client.cancel_order(bot['no_order_id'])
                            except Exception:
                                pass
                            try:
                                api_rate_limiter.wait()
                                no_check = kalshi_client.get_order(bot['no_order_id'])
                                no_ord_data = no_check.get('order', no_check) if isinstance(no_check, dict) else {}
                                if no_ord_data.get('status', '') not in ('canceled', 'cancelled'):
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['no_order_id'])
                            except Exception:
                                pass
                            orig_repeat_count = bot.get('repeat_count', 0)
                            bot['status'] = 'stopped'
                            bot['repeat_count'] = 0
                            bot['stopped_at'] = now
                            actual_sell = sell_info.get('actual_fill_price') or sell_info.get('sell_price', yes_bid)
                            pnl_cents = (actual_sell - entry_yes) * yes_filled  # positive = profit, negative = loss
                            verified = sell_info.get('verified_cleared', False)
                            if pnl_cents >= 0:
                                session_pnl['gross_profit_cents'] += pnl_cents
                                session_pnl['completed_bots']     += 1
                            else:
                                session_pnl['gross_loss_cents'] += abs(pnl_cents)
                                session_pnl['stopped_bots']     += 1
                            _record_trade({
                                'bot_id': bot_id, 'ticker': ticker,
                                'yes_price': entry_yes, 'no_price': bot['no_price'],
                                'quantity': yes_filled,
                                'profit_cents': pnl_cents if pnl_cents >= 0 else 0,
                                'loss_cents': abs(pnl_cents) if pnl_cents < 0 else 0,
                                'result': 'flip_yes', 'exit_bid': actual_sell,
                                'verified_cleared': verified, 'timestamp': now,
                                'placed_at': bot.get('created_at', now),
                                'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                                'arb_width': bot.get('arb_width', bot.get('profit_per', 0)),
                                'first_leg': bot.get('first_leg', 'yes'),
                                'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                                'game_phase': bot.get('game_phase', 'live'),
                                'flip_threshold': flip_thresh,
                                'effective_trigger': effective_trigger,
                                'game_context': _get_game_context(ticker),
                                'repeats_done': bot.get('repeats_done', 0),
                                'repeat_count': orig_repeat_count,
                            }, bot)
                            actions.append({'bot_id': bot_id, 'action': 'flip_yes',
                                            'entry': entry_yes, 'exit_bid': actual_sell,
                                            'pnl_cents': pnl_cents, 'verified': verified})
                            bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) + pnl_cents
                        else:
                            bot['sl_retry_count'] = bot.get('sl_retry_count', 0) + 1
                            retries = bot['sl_retry_count']
                            print(f'⚠ FLIP sell YES FAILED for {bot_id} — retry #{retries}')
                            if retries >= 10:
                                print(f'🔴 FORCE EXIT: {bot_id} — {retries} sell attempts failed')
                                try:
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['no_order_id'])
                                except Exception:
                                    pass
                                orig_repeat_count_fe = bot.get('repeat_count', 0)
                                bot['status'] = 'stopped'
                                bot['repeat_count'] = 0
                                bot['stopped_at'] = now
                                loss = entry_yes * yes_filled
                                session_pnl['gross_loss_cents'] += loss
                                session_pnl['stopped_bots'] += 1
                                _record_trade({
                                    'bot_id': bot_id, 'ticker': ticker,
                                    'yes_price': entry_yes, 'no_price': bot['no_price'],
                                    'quantity': yes_filled, 'loss_cents': loss,
                                    'result': 'force_exit_yes', 'timestamp': now,
                                    'note': f'sell failed {retries}x — forced exit',
                                    'game_phase': bot.get('game_phase', 'live'),
                                    'repeats_done': bot.get('repeats_done', 0),
                                    'repeat_count': orig_repeat_count_fe,
                                }, bot)
                                bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) - loss
                                actions.append({'bot_id': bot_id, 'action': 'force_exit_yes', 'retries': retries})
                            else:
                                actions.append({'bot_id': bot_id, 'action': 'flip_yes_RETRY', 'retry': retries})
                    else:
                        # Bid still above flip threshold (or underdog entry) — hold, no SL
                        if entry_yes >= flip_thresh:
                            actions.append({'bot_id': bot_id, 'action': 'holding_yes',
                                           'bid': yes_bid, 'flip_threshold': flip_thresh,
                                           'distance': yes_bid - flip_thresh})
                    continue  # ← prevent fall-through to NO check

                # ── NO fully filled, YES still open — FLIP THRESHOLD check ──
                if no_filled >= qty and yes_filled < qty:
                    bot['status'] = 'no_filled'
                    if not bot.get('first_fill_at'):
                        bot['first_fill_at'] = now
                        bot['first_leg'] = 'no'

                    flip_thresh = bot.get('flip_threshold', FLIP_THRESHOLD_CENTS)
                    entry_no = bot['no_price']

                    # Dynamic trigger: max(entry-15, floor) but capped so room >= 10¢
                    effective_trigger = max(entry_no - FLIP_ENTRY_MARGIN, min(flip_thresh, entry_no - 10))
                    # Only apply flip SL to favorite entries (entered at ≥ floor).
                    # Underdog entries ride to settlement.
                    if entry_no >= flip_thresh and no_bid < effective_trigger:
                        # Favorite has FLIPPED — sell now
                        if bot['status'] in ('stopped', 'completed', 'flipping'):
                            print(f'⛔ SKIPPING duplicate FLIP SL NO for {bot_id} — already {bot["status"]}')
                            continue
                        if bot.get('_ws_flip_selling'):
                            print(f'⚡ SKIPPING monitor FLIP NO for {bot_id} — WS real-time already handling')
                            continue
                        print(f'🔄 FLIP THRESHOLD: {bot_id} NO bid {no_bid}¢ < {effective_trigger}¢ (entry {entry_no}¢) — favorite flipped, selling')
                        bot_log('ARB_FLIP_FIRED', bot_id, {'leg': 'no', 'entry': entry_no, 'bid': no_bid, 'threshold': effective_trigger, 'floor': flip_thresh, 'source': 'monitor'})
                        # Mark as flipping BEFORE execute_sell so monitor can't re-enter during the 3-4s sell
                        bot['status'] = 'flipping'
                        sold, sell_info = execute_sell(ticker, 'no', no_filled, reason=f'arb_flip_no_{bot_id}')
                        if sold:
                            try:
                                api_rate_limiter.wait()
                                kalshi_client.cancel_order(bot['yes_order_id'])
                            except Exception:
                                pass
                            try:
                                api_rate_limiter.wait()
                                yes_check = kalshi_client.get_order(bot['yes_order_id'])
                                yes_ord_data = yes_check.get('order', yes_check) if isinstance(yes_check, dict) else {}
                                if yes_ord_data.get('status', '') not in ('canceled', 'cancelled'):
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['yes_order_id'])
                            except Exception:
                                pass
                            orig_repeat_count = bot.get('repeat_count', 0)
                            bot['status'] = 'stopped'
                            bot['repeat_count'] = 0
                            bot['stopped_at'] = now
                            actual_sell = sell_info.get('actual_fill_price') or sell_info.get('sell_price', no_bid)
                            pnl_cents = (actual_sell - entry_no) * no_filled  # positive = profit, negative = loss
                            verified = sell_info.get('verified_cleared', False)
                            if pnl_cents >= 0:
                                session_pnl['gross_profit_cents'] += pnl_cents
                                session_pnl['completed_bots']     += 1
                            else:
                                session_pnl['gross_loss_cents'] += abs(pnl_cents)
                                session_pnl['stopped_bots']     += 1
                            _record_trade({
                                'bot_id': bot_id, 'ticker': ticker,
                                'yes_price': bot['yes_price'], 'no_price': entry_no,
                                'quantity': no_filled,
                                'profit_cents': pnl_cents if pnl_cents >= 0 else 0,
                                'loss_cents': abs(pnl_cents) if pnl_cents < 0 else 0,
                                'result': 'flip_no', 'exit_bid': actual_sell,
                                'verified_cleared': verified, 'timestamp': now,
                                'placed_at': bot.get('created_at', now),
                                'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                                'arb_width': bot.get('arb_width', bot.get('profit_per', 0)),
                                'first_leg': bot.get('first_leg', 'no'),
                                'fill_duration_s': round(now - bot['first_fill_at']) if bot.get('first_fill_at') else None,
                                'game_phase': bot.get('game_phase', 'live'),
                                'flip_threshold': flip_thresh,
                                'effective_trigger': effective_trigger,
                                'game_context': _get_game_context(ticker),
                                'repeats_done': bot.get('repeats_done', 0),
                                'repeat_count': orig_repeat_count,
                            }, bot)
                            actions.append({'bot_id': bot_id, 'action': 'flip_no',
                                            'entry': entry_no, 'exit_bid': actual_sell,
                                            'pnl_cents': pnl_cents, 'verified': verified})
                            bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) + pnl_cents
                        else:
                            bot['sl_retry_count'] = bot.get('sl_retry_count', 0) + 1
                            retries = bot['sl_retry_count']
                            print(f'⚠ FLIP sell NO FAILED for {bot_id} — retry #{retries}')
                            if retries >= 10:
                                print(f'🔴 FORCE EXIT: {bot_id} — {retries} sell attempts failed')
                                try:
                                    api_rate_limiter.wait()
                                    kalshi_client.cancel_order(bot['yes_order_id'])
                                except Exception:
                                    pass
                                orig_repeat_count_fe = bot.get('repeat_count', 0)
                                bot['status'] = 'stopped'
                                bot['repeat_count'] = 0
                                bot['stopped_at'] = now
                                loss = entry_no * no_filled
                                session_pnl['gross_loss_cents'] += loss
                                session_pnl['stopped_bots'] += 1
                                _record_trade({
                                    'bot_id': bot_id, 'ticker': ticker,
                                    'yes_price': bot['yes_price'], 'no_price': entry_no,
                                    'quantity': no_filled, 'loss_cents': loss,
                                    'result': 'force_exit_no', 'timestamp': now,
                                    'note': f'sell failed {retries}x — forced exit',
                                    'game_phase': bot.get('game_phase', 'live'),
                                    'repeats_done': bot.get('repeats_done', 0),
                                    'repeat_count': orig_repeat_count_fe,
                                }, bot)
                                bot['net_pnl_cents'] = bot.get('net_pnl_cents', 0) - loss
                                actions.append({'bot_id': bot_id, 'action': 'force_exit_no', 'retries': retries})
                            else:
                                actions.append({'bot_id': bot_id, 'action': 'flip_no_RETRY', 'retry': retries})
                    else:
                        # Bid still above flip threshold (or underdog entry) — hold
                        if entry_no >= flip_thresh:
                            actions.append({'bot_id': bot_id, 'action': 'holding_no',
                                           'bid': no_bid, 'flip_threshold': flip_thresh,
                                           'distance': no_bid - flip_thresh})

            except Exception as e:
                print(f"Error monitoring bot {bot_id}: {e}")
                continue

        # ── Middle Bots ──────────────────────────────────────────────
        for bot_id, bot in list(active_bots.items()):
            if bot.get('type') != 'middle':
                continue
            if bot['status'] not in ('waiting', 'one_filled'):
                continue
            try:
                now_m = time.time()
                qty_m = bot.get('qty', 1)

                # ── Status: waiting — both orders pending ──
                if bot['status'] == 'waiting':
                    # Check order A
                    a_filled = False
                    a_fill_price = None
                    if bot.get('order_a_id'):
                        try:
                            api_rate_limiter.wait()
                            resp_a = kalshi_client.get_order(bot['order_a_id'])
                            ord_a = resp_a.get('order', resp_a) if isinstance(resp_a, dict) else {}
                            a_count = ord_a.get('filled_count', ord_a.get('fill_count', 0))
                            if a_count >= qty_m:
                                a_filled = True
                                a_fill_price = get_actual_fill_price(bot['order_a_id'], 'no')
                        except Exception as oe:
                            bot_log('ERROR', bot_id, {'step': 'check_order_a', 'error': str(oe)}, level='WARN')

                    # Check order B
                    b_filled = False
                    b_fill_price = None
                    if bot.get('order_b_id'):
                        try:
                            api_rate_limiter.wait()
                            resp_b = kalshi_client.get_order(bot['order_b_id'])
                            ord_b = resp_b.get('order', resp_b) if isinstance(resp_b, dict) else {}
                            b_count = ord_b.get('filled_count', ord_b.get('fill_count', 0))
                            if b_count >= qty_m:
                                b_filled = True
                                b_fill_price = get_actual_fill_price(bot['order_b_id'], 'no')
                        except Exception as oe:
                            bot_log('ERROR', bot_id, {'step': 'check_order_b', 'error': str(oe)}, level='WARN')

                    if a_filled and b_filled:
                        bot['leg_a_filled'] = True
                        bot['leg_b_filled'] = True
                        bot['leg_a_fill_price'] = a_fill_price or bot['target_price']
                        bot['leg_b_fill_price'] = b_fill_price or bot['target_price']
                        bot['status'] = 'both_filled'
                        bot['both_filled_at'] = now_m
                        bot_log('MIDDLE_BOTH_FILLED', bot_id, {'leg_a_price': bot['leg_a_fill_price'], 'leg_b_price': bot['leg_b_fill_price']})
                        print(f'📐 MIDDLE BOTH FILLED: {bot_id}')
                        actions.append({'bot_id': bot_id, 'action': 'middle_both_filled'})
                        save_state()
                    elif a_filled:
                        bot['leg_a_filled'] = True
                        bot['leg_a_fill_price'] = a_fill_price or bot['target_price']
                        bot['status'] = 'one_filled'
                        bot['filled_leg'] = 'a'
                        bot['one_filled_at'] = now_m
                        bot_log('MIDDLE_LEG_FILLED', bot_id, {'leg': 'a', 'price': bot['leg_a_fill_price']})
                        print(f'📐 MIDDLE LEG A FILLED: {bot_id}')
                        actions.append({'bot_id': bot_id, 'action': 'middle_leg_a_filled'})
                        save_state()
                    elif b_filled:
                        bot['leg_b_filled'] = True
                        bot['leg_b_fill_price'] = b_fill_price or bot['target_price']
                        bot['status'] = 'one_filled'
                        bot['filled_leg'] = 'b'
                        bot['one_filled_at'] = now_m
                        bot_log('MIDDLE_LEG_FILLED', bot_id, {'leg': 'b', 'price': bot['leg_b_fill_price']})
                        print(f'📐 MIDDLE LEG B FILLED: {bot_id}')
                        actions.append({'bot_id': bot_id, 'action': 'middle_leg_b_filled'})
                        save_state()

                # ── Status: one_filled — check other leg and stop-loss ──
                elif bot['status'] == 'one_filled':
                    filled_leg = bot.get('filled_leg', 'a')
                    unfilled_leg = 'b' if filled_leg == 'a' else 'a'
                    unfilled_order_key = f'order_{unfilled_leg}_id'
                    filled_ticker_key = f'ticker_{filled_leg}'
                    filled_price_key = f'leg_{filled_leg}_fill_price'
                    stop_loss = bot.get('stop_loss_cents', 15)
                    fill_price = bot.get(filled_price_key) or bot['target_price']

                    # Check if unfilled leg has filled
                    other_filled = False
                    other_fill_price = None
                    if bot.get(unfilled_order_key):
                        try:
                            api_rate_limiter.wait()
                            resp_uf = kalshi_client.get_order(bot[unfilled_order_key])
                            ord_uf = resp_uf.get('order', resp_uf) if isinstance(resp_uf, dict) else {}
                            uf_count = ord_uf.get('filled_count', ord_uf.get('fill_count', 0))
                            if uf_count >= qty_m:
                                other_filled = True
                                other_fill_price = get_actual_fill_price(bot[unfilled_order_key], 'no')
                        except Exception as oe:
                            bot_log('ERROR', bot_id, {'step': 'check_unfilled_leg', 'error': str(oe)}, level='WARN')

                    if other_filled:
                        bot[f'leg_{unfilled_leg}_filled'] = True
                        bot[f'leg_{unfilled_leg}_fill_price'] = other_fill_price or bot['target_price']
                        bot['status'] = 'both_filled'
                        bot['both_filled_at'] = now_m
                        bot_log('MIDDLE_BOTH_FILLED', bot_id, {
                            'leg_a_price': bot.get('leg_a_fill_price'),
                            'leg_b_price': bot.get('leg_b_fill_price'),
                        })
                        print(f'📐 MIDDLE BOTH FILLED (2nd leg): {bot_id}')
                        actions.append({'bot_id': bot_id, 'action': 'middle_both_filled'})
                        save_state()
                    else:
                        # Check stop-loss: get live bid of the filled leg
                        filled_ticker = bot.get(filled_ticker_key, '')
                        try:
                            live_bid = 0
                            ws_p = ws_manager.get_price(filled_ticker) if ws_manager else None
                            if ws_p:
                                live_bid = ws_p.get('no_bid', 0) or 0
                            if not live_bid and filled_ticker:
                                api_rate_limiter.wait()
                                mkt_sl = kalshi_client.get_market(filled_ticker)
                                mkt_sl_data = mkt_sl.get('market', mkt_sl)
                                no_bid_d = mkt_sl_data.get('no_bid_dollars')
                                live_bid = round(float(no_bid_d) * 100) if no_bid_d else mkt_sl_data.get('no_bid', 0)
                            # Store live bid for frontend
                            bot[f'live_no_bid_{filled_leg}'] = live_bid
                            # Trigger stop-loss if bid dropped stop_loss_cents below fill price
                            sl_trigger = fill_price - stop_loss
                            if live_bid > 0 and live_bid < sl_trigger:
                                bot_log('MIDDLE_SL_TRIGGERED', bot_id, {
                                    'filled_leg': filled_leg, 'fill_price': fill_price,
                                    'live_bid': live_bid, 'sl_trigger': sl_trigger,
                                })
                                print(f'🛑 MIDDLE STOP-LOSS: {bot_id} — {filled_leg} bid={live_bid}¢ < trigger={sl_trigger}¢')
                                # Cancel the unfilled order
                                if bot.get(unfilled_order_key):
                                    try:
                                        api_rate_limiter.wait()
                                        kalshi_client.cancel_order(bot[unfilled_order_key])
                                        bot_log('ORDER_CANCELLED', bot_id, {'order_id': bot[unfilled_order_key], 'reason': 'middle_sl'})
                                    except Exception as ce:
                                        bot_log('ERROR', bot_id, {'step': 'cancel_unfilled', 'error': str(ce)}, level='WARN')
                                # Market-sell the filled leg
                                sold_sl, sell_info_sl = execute_sell(filled_ticker, 'no', qty_m, reason=f'middle_sl_{bot_id}')
                                sell_price_sl = (sell_info_sl or {}).get('actual_fill_price') or (sell_info_sl or {}).get('sell_price', 0)
                                loss_cents = (fill_price - (sell_price_sl or fill_price)) * qty_m
                                bot['status'] = 'stopped'
                                bot['stopped_at'] = now_m
                                bot['sl_sell_price'] = sell_price_sl
                                session_pnl['gross_loss_cents'] += max(0, loss_cents)
                                session_pnl['stopped_bots'] += 1
                                _record_trade({
                                    'bot_id': bot_id, 'type': 'middle',
                                    'ticker_a': bot.get('ticker_a'), 'ticker_b': bot.get('ticker_b'),
                                    'team_a_name': bot.get('team_a_name'), 'team_b_name': bot.get('team_b_name'),
                                    'target_price': bot.get('target_price'), 'qty': qty_m,
                                    'filled_leg': filled_leg, 'fill_price': fill_price,
                                    'sl_sell_price': sell_price_sl, 'loss_cents': loss_cents,
                                    'result': 'stopped_sl', 'timestamp': now_m,
                                    'note': f'stop-loss: {filled_leg} bid={live_bid}¢ < trigger={sl_trigger}¢',
                                }, bot)
                                bot_log('MIDDLE_SL_FIRED', bot_id, {'sold': sold_sl, 'sell_price': sell_price_sl, 'loss_cents': loss_cents})
                                actions.append({'bot_id': bot_id, 'action': 'middle_stop_loss', 'loss_cents': loss_cents})
                                save_state()
                        except Exception as sl_err:
                            bot_log('ERROR', bot_id, {'step': 'sl_check', 'error': str(sl_err)}, level='WARN')

            except Exception as mid_err:
                print(f'Error monitoring middle bot {bot_id}: {mid_err}')
                continue

        # ── Settle both_filled middle bots when markets close ────────
        for bot_id, bot in list(active_bots.items()):
            if bot.get('type') != 'middle' or bot['status'] != 'both_filled':
                continue
            try:
                now_s = time.time()
                ticker_a = bot.get('ticker_a', '')
                ticker_b = bot.get('ticker_b', '')
                # Check if both markets are settled
                settled_a = False
                settled_b = False
                result_a = ''
                result_b = ''
                try:
                    api_rate_limiter.wait()
                    mkt_a = kalshi_client.get_market(ticker_a)
                    mkt_a_data = mkt_a.get('market', mkt_a)
                    if mkt_a_data.get('status', '') in ('closed', 'settled', 'finalized'):
                        settled_a = True
                        result_a = mkt_a_data.get('result', '').lower()
                except Exception:
                    pass
                try:
                    api_rate_limiter.wait()
                    mkt_b = kalshi_client.get_market(ticker_b)
                    mkt_b_data = mkt_b.get('market', mkt_b)
                    if mkt_b_data.get('status', '') in ('closed', 'settled', 'finalized'):
                        settled_b = True
                        result_b = mkt_b_data.get('result', '').lower()
                except Exception:
                    pass

                if settled_a and settled_b:
                    qty_s = bot.get('qty', 1)
                    fill_a = bot.get('leg_a_fill_price', bot.get('target_price', 49))
                    fill_b = bot.get('leg_b_fill_price', bot.get('target_price', 49))
                    # NO wins when market result is 'no'
                    leg_a_win = (result_a == 'no')
                    leg_b_win = (result_b == 'no')
                    middle_hit = leg_a_win and leg_b_win
                    profit_a = (100 - fill_a) * qty_s if leg_a_win else (-fill_a * qty_s)
                    profit_b = (100 - fill_b) * qty_s if leg_b_win else (-fill_b * qty_s)
                    total_profit = profit_a + profit_b
                    bot['status'] = 'completed'
                    bot['completed_at'] = now_s
                    bot['leg_a_result'] = 'win' if leg_a_win else 'loss'
                    bot['leg_b_result'] = 'win' if leg_b_win else 'loss'
                    bot['middle_hit'] = middle_hit
                    if total_profit > 0:
                        session_pnl['gross_profit_cents'] += total_profit
                        session_pnl['completed_bots'] += 1
                    else:
                        session_pnl['gross_loss_cents'] += abs(total_profit)
                        session_pnl['stopped_bots'] += 1
                    _record_trade({
                        'bot_id': bot_id, 'type': 'middle',
                        'ticker_a': ticker_a, 'ticker_b': ticker_b,
                        'team_a_name': bot.get('team_a_name'), 'team_b_name': bot.get('team_b_name'),
                        'target_price': bot.get('target_price'), 'qty': qty_s,
                        'leg_a_fill_price': fill_a, 'leg_b_fill_price': fill_b,
                        'leg_a_result': bot['leg_a_result'], 'leg_b_result': bot['leg_b_result'],
                        'middle_hit': middle_hit,
                        'profit_cents': total_profit,
                        'result': 'middle_hit' if middle_hit else ('arb_win' if (leg_a_win or leg_b_win) else 'loss'),
                        'timestamp': now_s,
                        'note': f'{"MIDDLE HIT" if middle_hit else ("partial win" if (leg_a_win or leg_b_win) else "both lost")} — A:{result_a} B:{result_b}',
                    }, bot)
                    bot_log('MIDDLE_SETTLED', bot_id, {
                        'middle_hit': middle_hit, 'profit_cents': total_profit,
                        'leg_a_result': result_a, 'leg_b_result': result_b,
                    })
                    print(f'📐 MIDDLE SETTLED: {bot_id} | middle_hit={middle_hit} | profit={total_profit}¢')
                    actions.append({'bot_id': bot_id, 'action': 'middle_settled', 'profit_cents': total_profit, 'middle_hit': middle_hit})
                    save_state()
            except Exception as ms_err:
                print(f'Error settling middle bot {bot_id}: {ms_err}')
                continue

        save_state()
        active_count = len([b for b in active_bots.values() if b['status'] in active_statuses])
        if actions:
            bot_log('MONITOR_CYCLE', '', {'active_bots': active_count, 'actions_count': len(actions), 'actions_summary': [a.get('action', '?') for a in actions]})
        return jsonify({
            'success':     True,
            'actions':     actions,
            'active_bots': active_count,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/middle/bot/create', methods=['POST'])
def create_middle_bot():
    """
    Middle Bot: places limit BUY NO orders on two opposing spread markets at target_price.
    Both orders rest in the book waiting for game volatility to push prices down to target.
    When both fill, profit is locked. Stop-loss sells the filled leg if the other stalls.
    """
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json or {}
        ticker_a        = data.get('ticker_a', '').strip()
        ticker_b        = data.get('ticker_b', '').strip()
        target_price    = int(data.get('target_price', 49))
        qty             = int(data.get('qty', 1))
        stop_loss_cents = int(data.get('stop_loss_cents', 15))
        team_a_name     = data.get('team_a_name', '')
        team_b_name     = data.get('team_b_name', '')
        spread_a        = data.get('spread_a', 0)
        spread_b        = data.get('spread_b', 0)
        no_a_bid        = data.get('no_a_bid', 0)
        no_b_bid        = data.get('no_b_bid', 0)
        game_id         = data.get('game_id', '')

        if not ticker_a or not ticker_b:
            return jsonify({'error': 'Missing required fields: ticker_a, ticker_b'}), 400
        if target_price < 1 or target_price > 99:
            return jsonify({'error': f'target_price {target_price}¢ out of range (1-99)'}), 400
        if qty < 1:
            return jsonify({'error': 'qty must be at least 1'}), 400

        # Place NO limit orders on both legs
        api_rate_limiter.wait()
        order_a_resp = kalshi_client.create_order(
            ticker=ticker_a, side='no', action='buy',
            count=qty, no_price=target_price
        )
        order_a_id = order_a_resp['order']['order_id']

        api_rate_limiter.wait()
        order_b_resp = kalshi_client.create_order(
            ticker=ticker_b, side='no', action='buy',
            count=qty, no_price=target_price
        )
        order_b_id = order_b_resp['order']['order_id']

        bot_id = f"mid_bot_{int(time.time())}"
        active_bots[bot_id] = {
            'id':               bot_id,
            'type':             'middle',
            'status':           'waiting',
            'ticker_a':         ticker_a,
            'ticker_b':         ticker_b,
            'ticker':           ticker_a,  # used by grouping/display logic
            'target_price':     target_price,
            'qty':              qty,
            'stop_loss_cents':  stop_loss_cents,
            'team_a_name':      team_a_name,
            'team_b_name':      team_b_name,
            'spread_a':         spread_a,
            'spread_b':         spread_b,
            'no_a_bid':         no_a_bid,
            'no_b_bid':         no_b_bid,
            'game_id':          game_id,
            'order_a_id':       order_a_id,
            'order_b_id':       order_b_id,
            'leg_a_filled':     False,
            'leg_b_filled':     False,
            'leg_a_fill_price': None,
            'leg_b_fill_price': None,
            'filled_leg':       None,
            'created_at':       time.time(),
            'placed_at':        time.time(),
        }
        save_state()

        # Subscribe WS to both tickers for real-time price updates
        if ws_manager.connected:
            ws_manager.add_ticker(ticker_a)
            ws_manager.add_ticker(ticker_b)

        guaranteed = 100 - 2 * target_price
        middle_profit = 200 - 2 * target_price

        bot_log('MIDDLE_BOT_CREATED', bot_id, {
            'ticker_a': ticker_a, 'ticker_b': ticker_b,
            'target_price': target_price, 'qty': qty, 'stop_loss_cents': stop_loss_cents,
            'order_a_id': order_a_id, 'order_b_id': order_b_id,
            'guaranteed': guaranteed, 'middle_profit': middle_profit,
        })
        print(f'📐 MIDDLE BOT CREATED: {bot_id} | NO {ticker_a} + NO {ticker_b} @ {target_price}¢ × {qty}')

        return jsonify({
            'success':        True,
            'bot_id':         bot_id,
            'order_a_id':     order_a_id,
            'order_b_id':     order_b_id,
            'target_price':   target_price,
            'guaranteed':     guaranteed,
            'middle_profit':  middle_profit,
            'message':        f'Middle bot deployed: NO on both spreads @ {target_price}¢ × {qty} — '
                              f'guaranteed {guaranteed:+}¢, middle profit +{middle_profit}¢',
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/bot/list', methods=['GET'])
def list_bots():
    """Get all bots with live market data"""
    # Enrich bots with WS prices if they don't have fresh data
    for bid, bot in list(active_bots.items()):
        if bot.get('status') in ('fav_posted', 'pending_fills', 'yes_filled', 'no_filled', 'watching'):
            if not bot.get('live_yes_bid') and bot.get('ticker'):
                ws_p = ws_manager.get_price(bot['ticker']) if ws_manager else None
                if ws_p:
                    bot['live_yes_bid'] = ws_p.get('yes_bid', 0)
                    bot['live_no_bid']  = ws_p.get('no_bid', 0)
                    bot['live_yes_ask'] = ws_p.get('yes_ask', 0)
                    bot['live_no_ask']  = ws_p.get('no_ask', 0)

    # Gather live scores per game-key for frontend display
    game_scores = {}
    for bid, bot in list(active_bots.items()):
        if bot.get('status') in ('completed', 'stopped'):
            continue
        ticker = bot.get('ticker', '')
        parts = ticker.split('-')
        gk = parts[1] if len(parts) >= 2 else parts[0]
        if gk not in game_scores:
            score_info = _get_game_score_for_ticker(ticker)
            if score_info:
                game_scores[gk] = score_info
    return jsonify({'bots': active_bots, 'game_scores': game_scores})


@app.route('/api/bot/history', methods=['GET'])
def bot_history():
    """Get completed/stopped trade history"""
    limit = int(request.args.get('limit', 50))
    date_filter = request.args.get('date', '').strip()
    if date_filter:
        filtered = [t for t in trade_history if _trade_day_key(t) == date_filter]
    else:
        filtered = trade_history
    return jsonify({'trades': filtered[:limit], 'total': len(filtered)})


@app.route('/api/logs', methods=['GET'])
def get_activity_logs():
    """Get the activity log for debugging. Supports ?lines=N (default 200) and ?event=X filter."""
    try:
        lines = int(request.args.get('lines', 200))
        event_filter = request.args.get('event', '').strip()
        bot_filter = request.args.get('bot_id', '').strip()
        level_filter = request.args.get('level', '').strip().upper()

        if not os.path.exists(LOG_FILE):
            return jsonify({'logs': [], 'total': 0})

        with open(LOG_FILE, 'r') as f:
            all_lines = f.readlines()

        # Parse from newest to oldest
        entries = []
        for line in reversed(all_lines):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event_filter and entry.get('event', '') != event_filter:
                continue
            if bot_filter and bot_filter not in entry.get('bot_id', ''):
                continue
            if level_filter and entry.get('level', '') != level_filter:
                continue
            entries.append(entry)
            if len(entries) >= lines:
                break

        return jsonify({'logs': entries, 'total': len(all_lines)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/logs/clear', methods=['POST'])
def clear_activity_logs():
    """Clear the activity log file."""
    try:
        with open(LOG_FILE, 'w') as f:
            f.write('')
        return jsonify({'success': True, 'message': 'Activity log cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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


def _compute_completed_stats(arb_wins):
    """Detailed breakdown of completed (profitable) arb trades."""
    if not arb_wins:
        return {'total': 0}
    profits = [t.get('profit_cents', 0) for t in arb_wins]
    total_profit = sum(profits)
    avg_profit = round(total_profit / len(profits)) if profits else 0
    max_profit = max(profits) if profits else 0
    min_profit = min(profits) if profits else 0
    quantities = [t.get('quantity', 1) for t in arb_wins]
    avg_qty = round(sum(quantities) / len(quantities), 1)
    total_contracts = sum(quantities)
    # Per-contract profit
    per_contract_profits = []
    for t in arb_wins:
        q = t.get('quantity', 1)
        p = t.get('profit_cents', 0)
        if q > 0:
            per_contract_profits.append(round(p / q))
    avg_per_contract = round(sum(per_contract_profits) / len(per_contract_profits)) if per_contract_profits else 0
    # Best/worst width for completed
    width_profits = {}
    for t in arb_wins:
        w = t.get('arb_width', 0)
        if w > 0:
            if w not in width_profits:
                width_profits[w] = {'count': 0, 'total': 0}
            width_profits[w]['count'] += 1
            width_profits[w]['total'] += t.get('profit_cents', 0)
    best_width = max(width_profits.items(), key=lambda x: x[1]['total'])[0] if width_profits else 0
    best_width_profit = width_profits[best_width]['total'] if best_width else 0
    return {
        'total': len(arb_wins),
        'total_profit_cents': total_profit,
        'avg_profit_cents': avg_profit,
        'max_profit_cents': max_profit,
        'min_profit_cents': min_profit,
        'avg_quantity': avg_qty,
        'total_contracts': total_contracts,
        'avg_per_contract': avg_per_contract,
        'best_width': best_width,
        'best_width_profit': best_width_profit,
    }


@app.route('/api/bot/history/stats', methods=['GET'])
def history_stats():
    """Compute analytics from trade history for the optimization dashboard."""
    date_filter = request.args.get('date', '').strip()
    if date_filter:
        source = [t for t in trade_history if _trade_day_key(t) == date_filter]
    else:
        source = trade_history
    arb_trades = [t for t in source if t.get('type') != 'watch']
    watch_trades = [t for t in source if t.get('type') == 'watch']

    WIN_RESULTS = ('completed', 'settled_win_yes', 'settled_win_no', 'manual_exit_completed')
    arb_wins = [t for t in arb_trades if t.get('result', '') in WIN_RESULTS]
    arb_losses = [t for t in arb_trades if t.get('result', '') in (
        'stop_loss_yes', 'stop_loss_no', 'flip_yes', 'flip_no',
        'force_exit_yes', 'force_exit_no', 'settled_loss_yes', 'settled_loss_no',
    )]

    # ── Result type breakdown ──────────────────────────────────────
    result_counts = {}
    for t in arb_trades:
        r = t.get('result', 'unknown')
        result_counts[r] = result_counts.get(r, 0) + 1

    # ── Flip analysis ──────────────────────────────────────────────
    flip_trades = [t for t in arb_trades if t.get('result', '').startswith('flip_')]
    flip_total = len(flip_trades)
    flip_total_loss = sum(t.get('loss_cents', 0) for t in flip_trades)
    flip_avg_loss = round(flip_total_loss / flip_total) if flip_total > 0 else 0
    # What were the entry prices when flips happened?
    flip_entries = []
    for t in flip_trades:
        if t['result'] == 'flip_yes':
            flip_entries.append(t.get('yes_price', 0))
        elif t['result'] == 'flip_no':
            flip_entries.append(t.get('no_price', 0))
    flip_avg_entry = round(sum(flip_entries) / len(flip_entries)) if flip_entries else 0
    # flip_threshold in trade records is the FLOOR; effective_trigger may be stored too.
    # For any trade, we can compute effective_trigger = max(entry - 15, floor).
    flip_effective_triggers = []
    flip_thresholds_used = []
    for t, entry in zip(flip_trades, flip_entries):
        floor = t.get('flip_threshold', FLIP_THRESHOLD_CENTS)
        eff = t.get('effective_trigger') or max(entry - FLIP_ENTRY_MARGIN, floor)
        flip_effective_triggers.append(eff)
        flip_thresholds_used.append(floor)
    flip_avg_floor = round(sum(flip_thresholds_used) / len(flip_thresholds_used)) if flip_thresholds_used else 0
    flip_avg_effective_trigger = round(sum(flip_effective_triggers) / len(flip_effective_triggers)) if flip_effective_triggers else 0
    # Entry bucket breakdown: classify flips by entry price range
    entry_buckets = {'65-69': {'count': 0, 'loss': 0, 'expected_loss': None},
                     '70-79': {'count': 0, 'loss': 0, 'expected_loss': 15},
                     '80-89': {'count': 0, 'loss': 0, 'expected_loss': 15},
                     '90-99': {'count': 0, 'loss': 0, 'expected_loss': 15}}
    for entry, eff, t in zip(flip_entries, flip_effective_triggers, flip_trades):
        loss_c = t.get('loss_cents', 0)
        if 65 <= entry < 70:
            bucket = '65-69'
        elif 70 <= entry < 80:
            bucket = '70-79'
        elif 80 <= entry < 90:
            bucket = '80-89'
        elif entry >= 90:
            bucket = '90-99'
        else:
            continue
        entry_buckets[bucket]['count'] += 1
        entry_buckets[bucket]['loss'] += loss_c
    entry_bucket_breakdown = []
    for label, b in entry_buckets.items():
        if b['count'] == 0:
            continue
        lo, hi = [int(x) for x in label.split('-')]
        # Expected trigger = max(mid - 15, 55); expected loss from entry = entry - trigger
        mid = (lo + hi) // 2
        exp_trigger = max(mid - FLIP_ENTRY_MARGIN, FLIP_THRESHOLD_CENTS)
        exp_loss = mid - exp_trigger
        entry_bucket_breakdown.append({
            'range': f'{label}¢',
            'count': b['count'],
            'avg_actual_loss': round(b['loss'] / b['count']) if b['count'] else 0,
            'expected_loss': exp_loss,
        })

    # ── Fill rate by width (with real breakeven %) ─────────────────
    # Only count flip-threshold trades (current system). Exclude old
    # stop_loss_yes/stop_loss_no trades which used a different risk system
    # and would skew the breakeven % with inflated losses.
    flip_system_results = WIN_RESULTS + ('flip_yes', 'flip_no',
                           'force_exit_yes', 'force_exit_no',
                           'settled_loss_yes', 'settled_loss_no')
    width_stats = {}
    for t in arb_trades:
        if t.get('result', '') not in flip_system_results:
            continue
        w = t.get('arb_width', 0)
        if w <= 0:
            continue
        if w not in width_stats:
            width_stats[w] = {'wins': 0, 'losses': 0, 'total_profit': 0,
                              'total_loss': 0, 'fill_durations': [],
                              'flips': 0, 'settled_losses': 0}
        if t['result'] in WIN_RESULTS:
            width_stats[w]['wins'] += 1
            width_stats[w]['total_profit'] += t.get('profit_cents', 0)
        else:
            width_stats[w]['losses'] += 1
            width_stats[w]['total_loss'] += t.get('loss_cents', 0)
            if t['result'].startswith('flip_'):
                width_stats[w]['flips'] += 1
            elif t['result'].startswith('settled_loss'):
                width_stats[w]['settled_losses'] += 1
        if t.get('fill_duration_s') is not None:
            width_stats[w]['fill_durations'].append(t['fill_duration_s'])

    width_breakdown = []
    for w, s in sorted(width_stats.items()):
        total = s['wins'] + s['losses']
        fill_rate = round(s['wins'] / total * 100, 1) if total > 0 else 0
        avg_fill_dur = round(sum(s['fill_durations']) / len(s['fill_durations'])) if s['fill_durations'] else None
        avg_profit = round(s['total_profit'] / s['wins']) if s['wins'] > 0 else w
        avg_loss = round(s['total_loss'] / s['losses']) if s['losses'] > 0 else 0
        # Real breakeven: avg_loss / (avg_loss + avg_profit)
        breakeven_pct = round(avg_loss / (avg_loss + avg_profit) * 100, 1) if (avg_loss + avg_profit) > 0 else 0
        edge = round(fill_rate - breakeven_pct, 1)
        ratio = f'{max(1, round(avg_loss / avg_profit))}:1' if avg_profit > 0 and avg_loss > 0 else '-'
        # System theoretical BE%: assumes avg flip loss = 15¢ (entry-15 formula, width W)
        system_be_pct = round(15 / (15 + w) * 100, 1) if w > 0 else 0
        width_breakdown.append({
            'width': w, 'wins': s['wins'], 'losses': s['losses'],
            'fill_rate': fill_rate, 'net_cents': s['total_profit'] - s['total_loss'],
            'avg_profit_cents': avg_profit, 'avg_loss_cents': avg_loss,
            'avg_fill_duration_s': avg_fill_dur,
            'breakeven_pct': breakeven_pct,
            'system_be_pct': system_be_pct,
            'edge': edge,
            'ratio': ratio,
            'flips': s['flips'], 'settled_losses': s['settled_losses'],
        })

    # Phase breakdown
    phase_stats = {'pregame': {'wins': 0, 'losses': 0}, 'live': {'wins': 0, 'losses': 0}}
    for t in arb_trades:
        p = t.get('game_phase', 'live')
        if p not in phase_stats:
            phase_stats[p] = {'wins': 0, 'losses': 0}
        if t['result'] in WIN_RESULTS:
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
        q_key = f'Q{period}' if period <= 4 else 'OT'
        if q_key not in quarter_stats:
            quarter_stats[q_key] = {'wins': 0, 'losses': 0}
        if t['result'] in WIN_RESULTS:
            quarter_stats[q_key]['wins'] += 1
        else:
            quarter_stats[q_key]['losses'] += 1

    # Score differential breakdown
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
        if t['result'] in WIN_RESULTS:
            margin_stats[bucket]['wins'] += 1
        else:
            margin_stats[bucket]['losses'] += 1

    # First leg analysis
    first_leg_stats = {'yes': {'wins': 0, 'losses': 0}, 'no': {'wins': 0, 'losses': 0}}
    for t in arb_trades:
        fl = t.get('first_leg', '')
        if fl in first_leg_stats:
            if t['result'] in WIN_RESULTS:
                first_leg_stats[fl]['wins'] += 1
            else:
                first_leg_stats[fl]['losses'] += 1

    # Average fill duration
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
        'result_breakdown': result_counts,
        'flip_stats': {
            'total': flip_total,
            'total_loss_cents': flip_total_loss,
            'avg_loss_cents': flip_avg_loss,
            'avg_entry_price': flip_avg_entry,
            'avg_floor': flip_avg_floor,
            'avg_effective_trigger': flip_avg_effective_trigger,
            'entry_bucket_breakdown': entry_bucket_breakdown,
        },
        'completed_stats': _compute_completed_stats(arb_wins),
        'phase_stats': phase_stats,
        'quarter_stats': quarter_stats,
        'margin_stats': margin_stats,
        'first_leg_stats': first_leg_stats,
        'watch_total': len(watch_trades),
        'watch_wins': len([t for t in watch_trades if t.get('result') == 'take_profit_watch']),
        'watch_losses': len([t for t in watch_trades if t.get('result') == 'stop_loss_watch']),
    })


# ── Middle tracking ──────────────────────────────────────────────────────────

@app.route('/api/middle/log', methods=['POST'])
def log_middle():
    """Record a middle opportunity (two legs, side by side)."""
    data = request.json or {}
    leg1 = data.get('leg1', {})
    leg2 = data.get('leg2', {})
    qty  = int(data.get('qty', leg1.get('qty', 1)))
    p1   = float(leg1.get('price', 0))
    p2   = float(leg2.get('price', 0))
    arb_width    = round(100 - p1 - p2, 2)   # positive = free arb window
    combined_cost = round((p1 + p2 - 100) * qty, 2)  # positive = costs this, negative = guaranteed profit
    max_profit    = round((100 - p1 + 100 - p2) * qty, 2)

    trade = {
        'id': f"mid_{int(time.time() * 1000)}",
        'type': 'middle',
        'timestamp': time.time(),
        'status': 'pending',
        'leg1': {
            'ticker': leg1.get('ticker', ''),
            'title':  leg1.get('title', ''),
            'side':   leg1.get('side', 'yes'),
            'price':  p1,
            'qty':    qty,
            'result': None,
        },
        'leg2': {
            'ticker': leg2.get('ticker', ''),
            'title':  leg2.get('title', ''),
            'side':   leg2.get('side', 'yes'),
            'price':  p2,
            'qty':    qty,
            'result': None,
        },
        'arb_width':     arb_width,
        'combined_cost': combined_cost,
        'max_profit':    max_profit,
        'middle_hit':    None,
        'profit_cents':  0,
        'loss_cents':    0,
        'result':        'pending',
        'notes':         data.get('notes', ''),
        'placed_at':     time.time(),
    }
    trade_history.append(trade)
    save_state()
    bot_log('MIDDLE_LOGGED', trade['id'], {'leg1': trade['leg1'], 'leg2': trade['leg2'],
                                           'arb_width': arb_width, 'combined_cost': combined_cost})
    return jsonify({'ok': True, 'trade': trade})


@app.route('/api/middle/<trade_id>/settle', methods=['POST'])
def settle_middle(trade_id):
    """Settle both legs of a middle — leg1_result and leg2_result: 'win' or 'loss'."""
    data = request.json or {}
    r1 = data.get('leg1_result', '').lower()
    r2 = data.get('leg2_result', '').lower()
    if r1 not in ('win', 'loss') or r2 not in ('win', 'loss'):
        return jsonify({'error': 'leg1_result and leg2_result must be win or loss'}), 400

    for trade in trade_history:
        if trade.get('id') == trade_id and trade.get('type') == 'middle':
            trade['leg1']['result'] = r1
            trade['leg2']['result'] = r2
            p1  = trade['leg1']['price']
            p2  = trade['leg2']['price']
            qty = trade['leg1']['qty']
            middle_hit = (r1 == 'win' and r2 == 'win')
            trade['middle_hit'] = middle_hit
            trade['status'] = 'settled'

            if middle_hit:
                profit = round(((100 - p1) + (100 - p2)) * qty)
                trade['profit_cents'] = profit
                trade['loss_cents']   = 0
                trade['result']       = 'middle_hit'
            elif r1 == 'win':
                net = round((100 - p1) * qty - p2 * qty)
                trade['profit_cents'] = max(0, net)
                trade['loss_cents']   = max(0, -net)
                trade['result']       = 'arb_win' if net >= 0 else 'loss'
            elif r2 == 'win':
                net = round((100 - p2) * qty - p1 * qty)
                trade['profit_cents'] = max(0, net)
                trade['loss_cents']   = max(0, -net)
                trade['result']       = 'arb_win' if net >= 0 else 'loss'
            else:
                trade['profit_cents'] = 0
                trade['loss_cents']   = round((p1 + p2) * qty)
                trade['result']       = 'loss'

            save_state()
            bot_log('MIDDLE_SETTLED', trade_id, {'result': trade['result'],
                                                 'middle_hit': middle_hit,
                                                 'profit_cents': trade['profit_cents'],
                                                 'loss_cents': trade['loss_cents']})
            return jsonify({'ok': True, 'trade': trade})

    return jsonify({'error': 'Middle trade not found'}), 404


# ── Insta Arb log (scanner-placed immediate both-sides arb) ─────────────────

@app.route('/api/instarb/log', methods=['POST'])
def log_instarb():
    """Record an insta-arb (scanner opportunity placed immediately, no bot)."""
    data = request.json or {}
    yes_price = float(data.get('yes_price', 0))
    no_price  = float(data.get('no_price', 0))
    qty       = int(data.get('qty', 1))
    arb_width = round(100 - yes_price - no_price, 2)
    profit    = round(arb_width * qty)

    trade = {
        'id':          f"ia_{int(time.time() * 1000)}",
        'type':        'insta_arb',
        'timestamp':   time.time(),
        'placed_at':   time.time(),
        'status':      'completed',
        'yes_ticker':  data.get('yes_ticker', ''),
        'no_ticker':   data.get('no_ticker', ''),
        'ticker':      data.get('yes_ticker', ''),
        'market_title': data.get('market_title', ''),
        'yes_price':   yes_price,
        'no_price':    no_price,
        'quantity':    qty,
        'arb_width':   arb_width,
        'profit_cents': profit,
        'loss_cents':  0,
        'result':      'completed',
        'sport':       data.get('sport', ''),
        'notes':       data.get('notes', ''),
    }
    trade_history.append(trade)
    save_state()
    bot_log('INSTA_ARB_PLACED', trade['id'], {'yes_price': yes_price, 'no_price': no_price,
                                              'arb_width': arb_width, 'profit_cents': profit})
    return jsonify({'ok': True, 'trade': trade})


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
    Acquires monitor_lock to prevent races with the monitor loop.
    """
    if bot_id not in active_bots:
        return jsonify({'error': 'Bot not found'}), 404

    # Acquire monitor lock to prevent race with monitor loop
    lock_acquired = monitor_lock.acquire(blocking=True, timeout=30)
    if not lock_acquired:
        return jsonify({'error': 'Server busy — monitor cycle in progress. Try again in a few seconds.'}), 503

    try:
        # Re-check after acquiring lock (bot may have been removed by monitor)
        if bot_id not in active_bots:
            return jsonify({'error': 'Bot was already removed'}), 404

        bot = active_bots[bot_id]
        cancelled = []
        sold_positions = []
        warnings = []
        sell_prices = {}  # Track actual sell prices: {'yes': price_cents, 'no': price_cents}
        ticker = bot.get('ticker', '')

        if kalshi_client:
            yes_filled = bot.get('yes_fill_qty', 0)
            no_filled = bot.get('no_fill_qty', 0)
            qty = bot.get('quantity', 1)
            bot_type = bot.get('type', 'arb')

            # ── Handle middle bots ──
            if bot_type == 'middle':
                mid_qty = bot.get('qty', 1)
                # Cancel any unfilled orders
                for order_key in ('order_a_id', 'order_b_id'):
                    if bot.get(order_key):
                        try:
                            kalshi_client.cancel_order(bot[order_key])
                            cancelled.append(order_key)
                        except Exception as me:
                            print(f'⚠ cancel_bot({bot_id}): cancel {order_key} failed: {me}')
                # Sell any filled legs
                for leg, ticker_key in (('a', 'ticker_a'), ('b', 'ticker_b')):
                    if bot.get(f'leg_{leg}_filled'):
                        leg_ticker = bot.get(ticker_key, '')
                        if leg_ticker:
                            sold, sell_info = execute_sell(leg_ticker, 'no', mid_qty, reason=f'cancel_middle_{leg}_{bot_id}')
                            if sold:
                                sold_positions.append(f'LEG_{leg.upper()}_NO {mid_qty}x')
                                sp = (sell_info or {}).get('actual_fill_price') or (sell_info or {}).get('sell_price', 0)
                                sell_prices[f'leg_{leg}'] = sp
                            else:
                                warnings.append(f'FAILED to sell LEG_{leg.upper()} NO {mid_qty}x — position may still be open on Kalshi!')

            # ── Handle watch bots ──
            elif bot_type == 'watch':
                watch_side = bot.get('side', 'yes')
                if bot.get('order_filled', False):
                    watch_qty = bot.get('fill_qty', bot.get('quantity', 1))
                    sold, sell_info = execute_sell(ticker, watch_side, watch_qty, reason=f'cancel_watch_{bot_id}')
                    if sold:
                        sold_positions.append(f'{watch_side.upper()} {watch_qty}x')
                        sp = (sell_info or {}).get('actual_fill_price') or (sell_info or {}).get('sell_price', 0)
                        sell_prices[watch_side] = sp
                    else:
                        warnings.append(f'FAILED to sell {watch_side.upper()} {watch_qty}x — position may still be open on Kalshi!')
                elif bot.get('order_id'):
                    try:
                        kalshi_client.cancel_order(bot['order_id'])
                        cancelled.append(watch_side.upper())
                    except Exception as e:
                        print(f'⚠ cancel_bot({bot_id}): cancel watch order failed: {e}')
                        warnings.append(f'Could not cancel {watch_side.upper()} order: {e}')

            # ── Handle arb bots ──
            else:
                # YES side: sell if filled, cancel+sell if partial, cancel if unfilled
                if yes_filled >= qty:
                    sold, sell_info = execute_sell(ticker, 'yes', yes_filled, reason=f'cancel_sell_yes_{bot_id}')
                    if sold:
                        sold_positions.append(f'YES {yes_filled}x')
                        sp = (sell_info or {}).get('actual_fill_price') or (sell_info or {}).get('sell_price', 0)
                        sell_prices['yes'] = sp
                    else:
                        warnings.append(f'FAILED to sell YES {yes_filled}x — position may still be open on Kalshi!')
                elif yes_filled > 0:
                    # PARTIAL FILL — cancel resting order AND sell filled contracts
                    if bot.get('yes_order_id'):
                        try:
                            kalshi_client.cancel_order(bot['yes_order_id'])
                            cancelled.append('YES order')
                        except Exception as e:
                            print(f'⚠ cancel_bot({bot_id}): cancel partial YES order failed: {e}')
                    sold, sell_info = execute_sell(ticker, 'yes', yes_filled, reason=f'cancel_sell_partial_yes_{bot_id}')
                    if sold:
                        sold_positions.append(f'YES {yes_filled}x (partial)')
                        sp = (sell_info or {}).get('actual_fill_price') or (sell_info or {}).get('sell_price', 0)
                        sell_prices['yes'] = sp
                    else:
                        warnings.append(f'FAILED to sell YES {yes_filled}x (partial) — position may still be open on Kalshi!')
                elif bot.get('yes_order_id'):
                    try:
                        kalshi_client.cancel_order(bot['yes_order_id'])
                        cancelled.append('YES')
                    except Exception as e:
                        print(f'⚠ cancel_bot({bot_id}): cancel YES order failed: {e}')
                        warnings.append(f'Could not cancel YES order: {e}')

                # NO side: sell if filled, cancel+sell if partial, cancel if unfilled
                if no_filled >= qty:
                    sold, sell_info = execute_sell(ticker, 'no', no_filled, reason=f'cancel_sell_no_{bot_id}')
                    if sold:
                        sold_positions.append(f'NO {no_filled}x')
                        sp = (sell_info or {}).get('actual_fill_price') or (sell_info or {}).get('sell_price', 0)
                        sell_prices['no'] = sp
                    else:
                        warnings.append(f'FAILED to sell NO {no_filled}x — position may still be open on Kalshi!')
                elif no_filled > 0:
                    # PARTIAL FILL — cancel resting order AND sell filled contracts
                    if bot.get('no_order_id'):
                        try:
                            kalshi_client.cancel_order(bot['no_order_id'])
                            cancelled.append('NO order')
                        except Exception as e:
                            print(f'⚠ cancel_bot({bot_id}): cancel partial NO order failed: {e}')
                    sold, sell_info = execute_sell(ticker, 'no', no_filled, reason=f'cancel_sell_partial_no_{bot_id}')
                    if sold:
                        sold_positions.append(f'NO {no_filled}x (partial)')
                        sp = (sell_info or {}).get('actual_fill_price') or (sell_info or {}).get('sell_price', 0)
                        sell_prices['no'] = sp
                    else:
                        warnings.append(f'FAILED to sell NO {no_filled}x (partial) — position may still be open on Kalshi!')
                elif bot.get('no_order_id'):
                    try:
                        kalshi_client.cancel_order(bot['no_order_id'])
                        cancelled.append('NO')
                    except Exception as e:
                        print(f'⚠ cancel_bot({bot_id}): cancel NO order failed: {e}')
                        warnings.append(f'Could not cancel NO order: {e}')

        # Record in trade history so manual deletes are tracked
        if sold_positions:
            # At least one position was sold — record the exit
            yes_sold_qty = 0
            no_sold_qty = 0
            for sp in sold_positions:
                if sp.startswith('YES'):
                    yes_sold_qty = bot.get('yes_fill_qty', 0) or bot.get('fill_qty', 0)
                elif sp.startswith('NO'):
                    no_sold_qty = bot.get('no_fill_qty', 0) or bot.get('fill_qty', 0)

            entry_yes = bot.get('yes_price', 0) or bot.get('entry_price', 0)
            entry_no = bot.get('no_price', 0)
            qty = bot.get('quantity', 1)
            bot_type = bot.get('type', 'arb')

            if bot_type == 'watch':
                # Watch bot — single side exit
                watch_side = bot.get('side', 'yes')
                watch_entry = bot.get('entry_price', 0) or (entry_yes if watch_side == 'yes' else entry_no)
                watch_sell = sell_prices.get(watch_side, 0)
                watch_qty = bot.get('fill_qty', bot.get('quantity', 1))
                profit = (watch_sell - watch_entry) * watch_qty
                _record_trade({
                    'bot_id': bot_id, 'ticker': ticker,
                    'yes_price': watch_entry if watch_side == 'yes' else 0,
                    'no_price': watch_entry if watch_side == 'no' else 0,
                    'quantity': watch_qty, 'profit_cents': profit,
                    'sell_price': watch_sell,
                    'result': 'manual_exit_completed',
                    'timestamp': time.time(),
                    'note': f'Manual exit — {watch_side.upper()} {watch_qty}x sold at {watch_sell}¢ (entry {watch_entry}¢)',
                    'game_phase': bot.get('game_phase', ''),
                    'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                }, bot)
                if profit >= 0:
                    session_pnl['gross_profit_cents'] += profit
                else:
                    session_pnl['gross_loss_cents'] += abs(profit)
                session_pnl['completed_bots'] += 1

            elif bot_type != 'watch':
                if yes_sold_qty > 0 and no_sold_qty > 0:
                    # Both sides were filled — this was a locked arb, manually exited
                    profit = (100 - entry_yes - entry_no) * min(yes_sold_qty, no_sold_qty)
                    _record_trade({
                        'bot_id': bot_id, 'ticker': ticker,
                        'yes_price': entry_yes, 'no_price': entry_no,
                        'quantity': min(yes_sold_qty, no_sold_qty), 'profit_cents': profit,
                        'sell_price_yes': sell_prices.get('yes', 0),
                        'sell_price_no': sell_prices.get('no', 0),
                        'result': 'manual_exit_completed',
                        'timestamp': time.time(),
                        'note': f'Manual exit — YES sold at {sell_prices.get("yes", "?")}¢, NO sold at {sell_prices.get("no", "?")}¢',
                        'game_phase': bot.get('game_phase', ''),
                        'arb_width': bot.get('arb_width', 0),
                        'first_leg': bot.get('first_leg', ''),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                        'repeats_done': bot.get('repeats_done', 0),
                        'repeat_count': bot.get('repeat_count', 0),
                    }, bot)
                    if profit >= 0:
                        session_pnl['gross_profit_cents'] += profit
                    else:
                        session_pnl['gross_loss_cents'] += abs(profit)
                    session_pnl['completed_bots'] += 1
                elif yes_sold_qty > 0:
                    # Only YES was filled and sold at market
                    yes_sell = sell_prices.get('yes', 0)
                    profit = (yes_sell - entry_yes) * yes_sold_qty
                    _record_trade({
                        'bot_id': bot_id, 'ticker': ticker,
                        'yes_price': entry_yes, 'no_price': entry_no,
                        'quantity': yes_sold_qty, 'profit_cents': profit,
                        'sell_price': yes_sell,
                        'result': 'manual_exit_yes',
                        'timestamp': time.time(),
                        'note': f'Manual exit — YES {yes_sold_qty}x sold at {yes_sell}¢ (entry {entry_yes}¢, P&L {profit:+d}¢)',
                        'game_phase': bot.get('game_phase', ''),
                        'arb_width': bot.get('arb_width', 0),
                        'first_leg': bot.get('first_leg', ''),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                        'repeats_done': bot.get('repeats_done', 0),
                        'repeat_count': bot.get('repeat_count', 0),
                    }, bot)
                    if profit >= 0:
                        session_pnl['gross_profit_cents'] += profit
                    else:
                        session_pnl['gross_loss_cents'] += abs(profit)
                    session_pnl['completed_bots'] += 1
                elif no_sold_qty > 0:
                    # Only NO was filled and sold at market
                    no_sell = sell_prices.get('no', 0)
                    profit = (no_sell - entry_no) * no_sold_qty
                    _record_trade({
                        'bot_id': bot_id, 'ticker': ticker,
                        'yes_price': entry_yes, 'no_price': entry_no,
                        'quantity': no_sold_qty, 'profit_cents': profit,
                        'sell_price': no_sell,
                        'result': 'manual_exit_no',
                        'timestamp': time.time(),
                        'note': f'Manual exit — NO {no_sold_qty}x sold at {no_sell}¢ (entry {entry_no}¢, P&L {profit:+d}¢)',
                        'game_phase': bot.get('game_phase', ''),
                        'arb_width': bot.get('arb_width', 0),
                        'first_leg': bot.get('first_leg', ''),
                        'team_label': ticker.split('-')[-1] if '-' in ticker else '',
                        'repeats_done': bot.get('repeats_done', 0),
                        'repeat_count': bot.get('repeat_count', 0),
                    }, bot)
                    if profit >= 0:
                        session_pnl['gross_profit_cents'] += profit
                    else:
                        session_pnl['gross_loss_cents'] += abs(profit)
                    session_pnl['completed_bots'] += 1
                bot_log('MANUAL_DELETE', bot_id, {'sold': sold_positions, 'cancelled': cancelled, 'sell_prices': sell_prices})

        del active_bots[bot_id]
        save_state()

        result = {'success': True, 'cancelled_orders': cancelled, 'sold_positions': sold_positions, 'sell_prices': sell_prices}
        if warnings:
            result['warnings'] = warnings
        return jsonify(result)
    finally:
        monitor_lock.release()


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
                      'KXNCAAMBPTS', 'KXNCAAMBREB', 'KXNCAAMBAST',
                      'KXNCAAMB3PT', 'KXNCAAMBSTL', 'KXNCAAMBBLK',
                      'KXMARMAD'],
            'ncaaw': ['KXNCAAWBGAME'],
            'epl': ['KXEPLGAME', 'KXEPLSPREAD', 'KXEPLTOTAL', 'KXEPLGOAL', 'KXEPLBTTS'],
            'ucl': ['KXUCLGAME', 'KXUCLSPREAD', 'KXUCLTOTAL', 'KXUCLGOAL', 'KXUCLBTTS'],
            'tennis': ['KXATPMATCH', 'KXWTAMATCH'],
            'wbc': ['KXWBCGAME'],
            'intl': ['KXVTBGAME', 'KXBSLGAME', 'KXABAGAME'],
        }

        if sport_filter and sport_filter.lower() not in ('', 'all'):
            series_to_fetch = SPORTS_SERIES.get(sport_filter.lower(), [])
        else:
            series_to_fetch = []
            for s in SPORTS_SERIES.values():
                series_to_fetch.extend(s)

        # Fetch all open markets from each series (with pagination)
        all_markets = []
        for series in series_to_fetch:
            try:
                cursor = None
                while True:
                    result = kalshi_client.get_markets_by_series(series, status='open', limit=200, cursor=cursor)
                    markets = result.get('markets', [])
                    if not markets:
                        break
                    markets = [m for m in markets if 'mve_selected_legs' not in m
                               and 'KXMVECROSSCATEGORY' not in m.get('ticker', '')]
                    all_markets.extend(markets)
                    cursor = result.get('cursor')
                    if not cursor or len(result.get('markets', [])) < 200:
                        break
            except Exception:
                continue

        # Filter stale/postponed markets
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

            # Width = raw profit room (at bid prices)
            width = 100 - yes_bid - no_bid
            if width < min_width:
                continue

            # Default: queue-jump prices (bid+1) to be first in line.
            # This is the only price that makes sense — posting at or below
            # the bid puts you behind everyone already there.
            sug_yes = yes_bid + 1
            sug_no  = no_bid + 1
            posted_profit = 100 - sug_yes - sug_no  # width - 2

            # Skip if queue-jump eats all profit
            if posted_profit <= 0:
                continue

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


PNL_LOSS_RESULTS = (
    'stop_loss_yes', 'stop_loss_no', 'flip_yes', 'flip_no',
    'force_exit_yes', 'force_exit_no', 'settled_loss_yes', 'settled_loss_no',
    'stopped_loss', 'flipped', 'manual_stop',
)
PNL_WIN_RESULTS = ('completed', 'settled_win_yes', 'settled_win_no', 'manual_exit_completed')

def _compute_pnl_bucket(trades, category=None):
    """Compute gross profit/loss/counts from a list of trade_history entries.
    If category given ('arb','bet','middle'), filters to that category only."""
    if category:
        trades = [t for t in trades if t.get('bot_category', 'arb') == category]
    gross_profit = 0
    gross_loss   = 0
    completed    = 0
    stopped      = 0
    sport_pnl    = {}
    for t in trades:
        result = t.get('result', '')
        pnl = 0
        if result in PNL_WIN_RESULTS:
            p = t.get('profit_cents', 0)
            gross_profit += p
            completed += 1
            pnl = p
        elif result in PNL_LOSS_RESULTS:
            l = t.get('loss_cents', 0)
            gross_loss += l
            stopped += 1
            pnl = -l
        sport = t.get('sport', 'Other')
        sport_pnl[sport] = sport_pnl.get(sport, 0) + pnl
    net_cents = gross_profit - gross_loss
    return {
        'gross_profit_cents': gross_profit,
        'gross_loss_cents':   gross_loss,
        'net_cents':          net_cents,
        'net_dollars':        net_cents / 100,
        'completed_bots':     completed,
        'stopped_bots':       stopped,
        'sport_pnl':          sport_pnl,
    }


def _trade_day_key(t):
    """Return ISO date string for a trade's timestamp (local timezone)."""
    ts = t.get('timestamp')
    if ts:
        return datetime.fromtimestamp(ts).date().isoformat()
    return date.today().isoformat()


@app.route('/api/pnl', methods=['GET'])
def get_pnl():
    """P&L dashboard — daily & lifetime, computed from trade history."""
    today = date.today().isoformat()

    # Split into today vs all-time
    today_trades = [t for t in trade_history if _trade_day_key(t) == today]

    daily    = _compute_pnl_bucket(today_trades)
    lifetime = _compute_pnl_bucket(trade_history)
    arb_d    = _compute_pnl_bucket(today_trades, 'arb')
    bet_d    = _compute_pnl_bucket(today_trades, 'bet')
    mid_d    = _compute_pnl_bucket(today_trades, 'middle')

    pnl = {
        # Daily (combined — unchanged)
        'gross_profit_cents': daily['gross_profit_cents'],
        'gross_loss_cents':   daily['gross_loss_cents'],
        'net_cents':          daily['net_cents'],
        'net_dollars':        daily['net_dollars'],
        'completed_bots':     daily['completed_bots'],
        'stopped_bots':       daily['stopped_bots'],
        # Lifetime
        'lifetime_gross_profit_cents': lifetime['gross_profit_cents'],
        'lifetime_gross_loss_cents':   lifetime['gross_loss_cents'],
        'lifetime_net_cents':          lifetime['net_cents'],
        'lifetime_net_dollars':        lifetime['net_dollars'],
        'lifetime_completed':          lifetime['completed_bots'],
        'lifetime_stopped':            lifetime['stopped_bots'],
        # Category breakdown (today)
        'arb_net_cents':    arb_d['net_cents'],
        'arb_profit_cents': arb_d['gross_profit_cents'],
        'arb_loss_cents':   arb_d['gross_loss_cents'],
        'arb_wins':         arb_d['completed_bots'],
        'arb_losses':       arb_d['stopped_bots'],
        'bet_net_cents':    bet_d['net_cents'],
        'bet_profit_cents': bet_d['gross_profit_cents'],
        'bet_loss_cents':   bet_d['gross_loss_cents'],
        'bet_wins':         bet_d['completed_bots'],
        'bet_losses':       bet_d['stopped_bots'],
        'mid_net_cents':    mid_d['net_cents'],
        'mid_profit_cents': mid_d['gross_profit_cents'],
        'mid_loss_cents':   mid_d['gross_loss_cents'],
        'mid_wins':         mid_d['completed_bots'],
        'mid_losses':       mid_d['stopped_bots'],
        # Sport breakdown (today)
        'sport_pnl': {s: round(v/100, 2) for s, v in daily['sport_pnl'].items() if v != 0},
        # Meta
        'active_bots': len([b for b in active_bots.values()
                             if b['status'] in ('pending_fills', 'yes_filled', 'no_filled')]),
        'day_key': today,
    }
    return jsonify(pnl)


@app.route('/api/pnl/calendar', methods=['GET'])
def get_pnl_calendar():
    """Return daily P&L for every day that has trades — powers the calendar view."""
    from collections import defaultdict
    day_buckets = defaultdict(list)
    for t in trade_history:
        day = _trade_day_key(t)
        day_buckets[day].append(t)

    calendar_data = []
    for day in sorted(day_buckets.keys()):
        bucket = _compute_pnl_bucket(day_buckets[day])
        calendar_data.append({
            'date':        day,
            'net_cents':   bucket['net_cents'],
            'net_dollars': bucket['net_dollars'],
            'wins':        bucket['completed_bots'],
            'losses':      bucket['stopped_bots'],
            'trades':      bucket['completed_bots'] + bucket['stopped_bots'],
        })
    return jsonify({'days': calendar_data})


@app.route('/api/pnl/reset', methods=['POST'])
def reset_pnl():
    """Reset session P&L counters."""
    global session_pnl
    session_pnl = {
        'gross_profit_cents': 0, 'gross_loss_cents': 0,
        'completed_bots': 0,     'stopped_bots': 0,
        'session_start': time.time(),
        'day_key': date.today().isoformat(),
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
            'ncaab': ['KXNCAAMBSPREAD'],
            'ncaaw': ['KXNCAAWBSPREAD'],
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
                cursor = None
                while True:
                    result = kalshi_client.get_markets_by_series(series, status='open', limit=200, cursor=cursor)
                    markets = result.get('markets', [])
                    if not markets:
                        break
                    markets = [m for m in markets if 'mve_selected_legs' not in m]
                    all_spreads.extend(markets)
                    cursor = result.get('cursor')
                    if not cursor or len(result.get('markets', [])) < 200:
                        break
            except Exception:
                continue

        def tc(m, field):
            d = m.get(field + '_dollars')
            if d: return round(float(d) * 100)
            return m.get(field, 0)

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

                # Compute avg entry price from exposure
                exposure_cents = pos.get('market_exposure', 0)
                avg_entry = round(exposure_cents / abs_qty) if abs_qty > 0 else 0

                enriched.append({
                    'ticker':     ticker,
                    'title':      mkt.get('title', ticker),
                    'side':       side,
                    'quantity':   abs_qty,
                    'avg_price':  avg_entry,
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
