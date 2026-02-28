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
        limit = int(request.args.get('limit', 200))
        cursor = request.args.get('cursor')
        event_ticker = request.args.get('event_ticker')
        series_ticker = request.args.get('series_ticker')  # For filtering by sport/series
        
        markets = kalshi_client.get_markets(status=status, limit=limit, 
                                           cursor=cursor, event_ticker=event_ticker)
        
        # Filter for basketball if requested
        if series_ticker:
            markets = [m for m in markets if series_ticker.upper() in m.get('series_ticker', '').upper()]
        
        return jsonify(markets)
    
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


# Smart Bot Tracking
active_bots = {}  # bot_id -> bot_config


@app.route('/api/bot/create', methods=['POST'])
def create_bot():
    """Create a smart bot to monitor and execute trades"""
    try:
        if not kalshi_client:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.json
        ticker = data.get('ticker')
        side = data.get('side')  # 'yes' or 'no'
        target_price = int(data.get('target_price'))  # in cents
        quantity = int(data.get('quantity', 1))
        arb_width = float(data.get('arb_width', 3))  # minimum % profit for arb
        stop_loss_pct = float(data.get('stop_loss_pct', 5))  # % drop to trigger stop loss
        auto_arb = data.get('auto_arb', True)  # automatically execute other side when arb appears
        
        bot_id = f"{ticker}_{side}_{int(time.time())}"
        
        active_bots[bot_id] = {
            'ticker': ticker,
            'side': side,
            'target_price': target_price,
            'quantity': quantity,
            'arb_width': arb_width,
            'stop_loss_pct': stop_loss_pct,
            'auto_arb': auto_arb,
            'status': 'monitoring',  # monitoring, leg1_filled, completed, stopped
            'leg1_order_id': None,
            'leg1_fill_price': None,
            'leg2_order_id': None,
            'created_at': time.time()
        }
        
        return jsonify({
            'success': True,
            'bot_id': bot_id,
            'message': f'Bot created to buy {side.upper()} at {target_price}¢'
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
        
        for bot_id, bot in list(active_bots.items()):
            try:
                ticker = bot['ticker']
                
                # Get current orderbook
                orderbook = kalshi_client.get_market_orderbook(ticker)
                yes_offers = orderbook.get('yes', [])
                no_offers = orderbook.get('no', [])
                
                # Get best prices
                best_yes = yes_offers[0]['price'] if yes_offers else 99
                best_no = no_offers[0]['price'] if no_offers else 99
                
                # BOT LOGIC: Monitoring state - waiting to buy first leg
                if bot['status'] == 'monitoring':
                    if bot['side'] == 'yes' and best_yes <= bot['target_price']:
                        # Execute YES buy
                        order = kalshi_client.create_order(
                            ticker=ticker,
                            side='yes',
                            action='buy',
                            count=bot['quantity'],
                            yes_price=bot['target_price']
                        )
                        bot['leg1_order_id'] = order['order']['order_id']
                        bot['leg1_fill_price'] = bot['target_price']
                        bot['status'] = 'leg1_filled'
                        actions.append({
                            'bot_id': bot_id,
                            'action': 'bought_yes',
                            'price': bot['target_price'],
                            'quantity': bot['quantity']
                        })
                    
                    elif bot['side'] == 'no' and best_no <= bot['target_price']:
                        # Execute NO buy
                        order = kalshi_client.create_order(
                            ticker=ticker,
                            side='no',
                            action='buy',
                            count=bot['quantity'],
                            no_price=bot['target_price']
                        )
                        bot['leg1_order_id'] = order['order']['order_id']
                        bot['leg1_fill_price'] = bot['target_price']
                        bot['status'] = 'leg1_filled'
                        actions.append({
                            'bot_id': bot_id,
                            'action': 'bought_no',
                            'price': bot['target_price'],
                            'quantity': bot['quantity']
                        })
                
                #BOT LOGIC: Leg1 filled - monitor for arb or stop loss
                elif bot['status'] == 'leg1_filled':
                    if bot['side'] == 'yes':
                        # Check for stop loss (YES price dropped)
                        if best_yes < bot['leg1_fill_price'] * (1 - bot['stop_loss_pct']/100):
                            # Sell YES to cut losses
                            order = kalshi_client.create_order(
                                ticker=ticker,
                                side='yes',
                                action='sell',
                                count=bot['quantity'],
                                yes_price=max(1, best_yes - 1)
                            )
                            bot['status'] = 'stopped'
                            actions.append({
                                'bot_id': bot_id,
                                'action': 'stop_loss_yes',
                                'sell_price': best_yes
                            })
                        
                        # Check for arb opportunity (can buy NO and lock profit)
                        elif bot['auto_arb']:
                            total_cost = bot['leg1_fill_price'] + best_no
                            profit_pct = ((100 - total_cost) / total_cost) * 100
                            
                            if profit_pct >= bot['arb_width']:
                                # Execute NO leg to complete arb
                                order = kalshi_client.create_order(
                                    ticker=ticker,
                                    side='no',
                                    action='buy',
                                    count=bot['quantity'],
                                    no_price=best_no
                                )
                                bot['leg2_order_id'] = order['order']['order_id']
                                bot['status'] = 'completed'
                                actions.append({
                                    'bot_id': bot_id,
                                    'action': 'completed_arb',
                                    'yes_price': bot['leg1_fill_price'],
                                    'no_price': best_no,
                                    'profit': 100 - total_cost,
                                    'profit_pct': profit_pct
                                })
                    
                    else:  # bot['side'] == 'no'
                        # Check for stop loss (NO price dropped)
                        if best_no < bot['leg1_fill_price'] * (1 - bot['stop_loss_pct']/100):
                            # Sell NO to cut losses
                            order = kalshi_client.create_order(
                                ticker=ticker,
                                side='no',
                                action='sell',
                                count=bot['quantity'],
                                no_price=max(1, best_no - 1)
                            )
                            bot['status'] = 'stopped'
                            actions.append({
                                'bot_id': bot_id,
                                'action': 'stop_loss_no',
                                'sell_price': best_no
                            })
                        
                        # Check for arb opportunity (can buy YES and lock profit)
                        elif bot['auto_arb']:
                            total_cost = best_yes + bot['leg1_fill_price']
                            profit_pct = ((100 - total_cost) / total_cost) * 100
                            
                            if profit_pct >= bot['arb_width']:
                                # Execute YES leg to complete arb
                                order = kalshi_client.create_order(
                                    ticker=ticker,
                                    side='yes',
                                    action='buy',
                                    count=bot['quantity'],
                                    yes_price=best_yes
                                )
                                bot['leg2_order_id'] = order['order']['order_id']
                                bot['status'] = 'completed'
                                actions.append({
                                    'bot_id': bot_id,
                                    'action': 'completed_arb',
                                    'no_price': bot['leg1_fill_price'],
                                    'yes_price': best_yes,
                                    'profit': 100 - total_cost,
                                    'profit_pct': profit_pct
                                })
                
            except Exception as e:
                print(f"Error monitoring bot {bot_id}: {e}")
                continue
        
        return jsonify({
            'success': True,
            'actions': actions,
            'active_bots': len([b for b in active_bots.values() if b['status'] in ['monitoring', 'leg1_filled']])
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/bot/list', methods=['GET'])
def list_bots():
    """Get all active bots"""
    return jsonify({'bots': active_bots})


@app.route('/api/bot/cancel/<bot_id>', methods=['DELETE'])
def cancel_bot(bot_id):
    """Cancel a bot"""
    if bot_id in active_bots:
        del active_bots[bot_id]
        return jsonify({'success': True, 'message': 'Bot cancelled'})
    return jsonify({'error': 'Bot not found'}), 404


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
