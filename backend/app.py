"""
Kalshi Arbitrage Bot Backend
Flask server providing API endpoints for the trading bot
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from kalshi_api import KalshiAPI
import os
import json
from typing import Dict, List, Optional
import time

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Global variables
kalshi_client: Optional[KalshiAPI] = None
active_arb_orders: Dict = {}  # Track active arbitrage positions
stop_loss_percentage = 0.05  # 5% stop loss default


@app.route('/')
def index():
    """Serve the frontend"""
    return send_from_directory(app.static_folder, 'index_new.html')


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
    """Get all markets"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated. Please login first.'}), 401
            
        status = request.args.get('status', 'open')
        limit = int(request.args.get('limit', 500))  # Increased default
        cursor = request.args.get('cursor')
        event_ticker = request.args.get('event_ticker')
        series_ticker = request.args.get('series_ticker')  # For filtering by sport/series
        
        result = kalshi_client.get_markets(status=status, limit=limit, 
                                           cursor=cursor, event_ticker=event_ticker)
        
        # Extract markets array from response
        markets = result.get('markets', result) if isinstance(result, dict) else result
        
        # Filter for series if requested
        if series_ticker:
            markets = [m for m in markets if series_ticker.upper() in m.get('series_ticker', '').upper()]
        
        # Filter out parlay/multivariate markets
        markets = [m for m in markets if 'mve_selected_legs' not in m and 'KXMVECROSSCATEGORY' not in m.get('ticker', '')]
        
        return jsonify({'markets': markets, 'cursor': result.get('cursor') if isinstance(result, dict) else None})
    
    except Exception as e:
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


@app.route('/api/bot/create', methods=['POST'])
def create_bot():
    """
    Dual Arb Bot: immediately places LIMIT BUY orders on both YES and NO sides.
    Both are market-maker orders (resting in the book) — no taker fees on entry.
    Profit = 100 - yes_price - no_price cents per contract, locked at settlement.
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
            'status':           'pending_fills',  # pending_fills | yes_filled | no_filled | completed | stopped
            'yes_order_id':     yes_order['order']['order_id'],
            'no_order_id':      no_order['order']['order_id'],
            'yes_fill_qty':     0,
            'no_fill_qty':      0,
            'created_at':       time.time(),
        }

        return jsonify({
            'success':      True,
            'bot_id':       bot_id,
            'yes_order_id': yes_order['order']['order_id'],
            'no_order_id':  no_order['order']['order_id'],
            'profit_per':   profit_per,
            'message':      f'Limit orders placed — YES at {yes_price}¢, NO at {no_price}¢ → {profit_per}¢ profit/contract'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/bot/monitor', methods=['POST'])
def monitor_bots():
    """Check all active bots and execute trades when conditions are met"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        actions = []
        active_statuses = ('pending_fills', 'yes_filled', 'no_filled')

        for bot_id, bot in list(active_bots.items()):
            if bot['status'] not in active_statuses:
                continue
            try:
                ticker = bot['ticker']

                # ── Check fill status of both orders ──────────────────────────
                yes_resp = kalshi_client.get_order(bot['yes_order_id'])
                no_resp  = kalshi_client.get_order(bot['no_order_id'])
                yes_ord  = yes_resp.get('order', {})
                no_ord   = no_resp.get('order', {})

                # Kalshi uses 'filled_count' (v2) — fall back to older 'fill_count'
                yes_filled = yes_ord.get('filled_count', yes_ord.get('fill_count', 0))
                no_filled  = no_ord.get('filled_count',  no_ord.get('fill_count', 0))
                bot['yes_fill_qty'] = yes_filled
                bot['no_fill_qty']  = no_filled
                qty = bot['quantity']

                # ── Both sides fully filled → profit locked at settlement ──────
                if yes_filled >= qty and no_filled >= qty:
                    bot['status'] = 'completed'
                    actions.append({
                        'bot_id':       bot_id,
                        'action':       'completed',
                        'profit_cents': bot['profit_per'] * qty,
                    })
                    continue

                # ── Fetch current bid prices for stop-loss check ───────────────
                market_resp = kalshi_client.get_market(ticker)
                market = market_resp.get('market', market_resp)

                def to_cents(field):
                    d = market.get(field + '_dollars')
                    if d:
                        return round(float(d) * 100)
                    return market.get(field, 50)

                yes_bid = to_cents('yes_bid')
                no_bid  = to_cents('no_bid')
                stop    = bot['stop_loss_cents']

                # ── YES filled, NO still open ─────────────────────────────────
                if yes_filled >= qty and no_filled < qty:
                    bot['status'] = 'yes_filled'
                    # Stop loss: market bid for YES dropped ≥ stop_loss_cents below entry
                    if yes_bid <= bot['yes_price'] - stop:
                        kalshi_client.create_order(      # market sell to exit immediately
                            ticker=ticker, side='yes', action='sell',
                            count=yes_filled, order_type='market'
                        )
                        try:
                            kalshi_client.cancel_order(bot['no_order_id'])
                        except Exception:
                            pass
                        bot['status'] = 'stopped'
                        actions.append({
                            'bot_id':   bot_id,
                            'action':   'stop_loss_yes',
                            'entry':    bot['yes_price'],
                            'exit_bid': yes_bid,
                            'loss':     yes_bid - bot['yes_price'],
                        })

                # ── NO filled, YES still open ─────────────────────────────────
                elif no_filled >= qty and yes_filled < qty:
                    bot['status'] = 'no_filled'
                    if no_bid <= bot['no_price'] - stop:
                        kalshi_client.create_order(
                            ticker=ticker, side='no', action='sell',
                            count=no_filled, order_type='market'
                        )
                        try:
                            kalshi_client.cancel_order(bot['yes_order_id'])
                        except Exception:
                            pass
                        bot['status'] = 'stopped'
                        actions.append({
                            'bot_id':   bot_id,
                            'action':   'stop_loss_no',
                            'entry':    bot['no_price'],
                            'exit_bid': no_bid,
                            'loss':     no_bid - bot['no_price'],
                        })

            except Exception as e:
                print(f"Error monitoring bot {bot_id}: {e}")
                continue

        return jsonify({
            'success':     True,
            'actions':     actions,
            'active_bots': len([b for b in active_bots.values() if b['status'] in active_statuses]),
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/bot/list', methods=['GET'])
def list_bots():
    """Get all active bots"""
    return jsonify({'bots': active_bots})


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
    return jsonify({'success': True, 'cancelled_orders': cancelled})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
