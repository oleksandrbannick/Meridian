"""
Kalshi API Client
Handles authentication and API requests to Kalshi
"""

import requests
import time
import base64
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
from typing import Optional, Dict, Any


class KalshiAPI:
    def __init__(self, api_key_id: str, private_key_path: str, demo: bool = True):
        """
        Initialize Kalshi API client
        
        Args:
            api_key_id: Your API key ID from Kalshi
            private_key_path: Path to your private key file
            demo: Whether to use demo environment (True) or production (False)
        """
        self.api_key_id = api_key_id
        self.private_key = self._load_private_key(private_key_path)
        self.base_url = 'https://demo-api.kalshi.co' if demo else 'https://api.elections.kalshi.com'
        self.api_version = '/trade-api/v2'
        
    def _load_private_key(self, file_path: str):
        """Load RSA private key from file"""
        with open(file_path, "rb") as key_file:
            private_key = serialization.load_pem_private_key(
                key_file.read(),
                password=None,
                backend=default_backend()
            )
        return private_key
    
    def _sign_request(self, timestamp_str: str, method: str, path: str) -> str:
        """Sign request with RSA-PSS signature"""
        msg_string = timestamp_str + method + path
        message = msg_string.encode('utf-8')
        
        signature = self.private_key.sign(
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.DIGEST_LENGTH
            ),
            hashes.SHA256()
        )
        return base64.b64encode(signature).decode('utf-8')
    
    def _make_request(self, method: str, endpoint: str, params: Optional[Dict] = None, 
                     data: Optional[Dict] = None, authenticated: bool = True) -> Dict[Any, Any]:
        """Make authenticated request to Kalshi API"""
        # Prepare URL and path
        url = f"{self.base_url}{self.api_version}{endpoint}"
        path = f"{self.api_version}{endpoint}"
        
        # Strip query parameters from path before signing
        path_without_query = path.split('?')[0]
        
        headers = {}
        
        if authenticated:
            # Create timestamp
            timestamp = int(time.time() * 1000)
            timestamp_str = str(timestamp)
            
            # Sign request
            signature = self._sign_request(timestamp_str, method.upper(), path_without_query)
            
            # Add headers
            headers = {
                'KALSHI-ACCESS-KEY': self.api_key_id,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'KALSHI-ACCESS-TIMESTAMP': timestamp_str,
                'Content-Type': 'application/json'
            }
        else:
            headers = {'Content-Type': 'application/json'}
        
        # Make request
        timeout = 15  # seconds
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=timeout)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=timeout)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=timeout)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, headers=headers, json=data, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"API Request failed: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            raise
    
    # Market Data Endpoints
    def get_markets(self, status: Optional[str] = None, limit: int = 100, 
                   cursor: Optional[str] = None, event_ticker: Optional[str] = None) -> Dict:
        """Get all markets"""
        params = {'limit': limit}
        if status:
            params['status'] = status
        if cursor:
            params['cursor'] = cursor
        if event_ticker:
            params['event_ticker'] = event_ticker
        if hasattr(self, '_series_ticker') and self._series_ticker:
            params['series_ticker'] = self._series_ticker
        return self._make_request('GET', '/markets', params=params, authenticated=False)
    
    def get_markets_by_series(self, series_ticker: str, status: str = 'open', limit: int = 200, cursor: str = None) -> Dict:
        """Get markets filtered by series_ticker (e.g., KXNBAGAME, KXNBASPREAD)"""
        params = {'limit': limit, 'series_ticker': series_ticker}
        if status:
            params['status'] = status
        if cursor:
            params['cursor'] = cursor
        return self._make_request('GET', '/markets', params=params, authenticated=True)
    
    def get_events_by_series(self, series_ticker: str, status: str = 'open', limit: int = 200) -> Dict:
        """Get events filtered by series_ticker"""
        params = {'limit': limit, 'series_ticker': series_ticker}
        if status:
            params['status'] = status
        return self._make_request('GET', '/events', params=params, authenticated=False)
    
    def get_market(self, ticker: str) -> Dict:
        """Get specific market by ticker"""
        return self._make_request('GET', f'/markets/{ticker}', authenticated=False)
    
    def get_events(self, status: Optional[str] = None, limit: int = 200) -> Dict:
        """Get all events"""
        params = {'limit': limit}
        if status:
            params['status'] = status
        return self._make_request('GET', '/events', params=params, authenticated=False)
    
    def get_market_orderbook(self, ticker: str, depth: int = 0) -> Dict:
        """Get orderbook for a specific market"""
        params = {'depth': depth}
        return self._make_request('GET', f'/markets/{ticker}/orderbook', 
                                 params=params, authenticated=True)
    
    # Portfolio Endpoints
    def get_balance(self) -> Dict:
        """Get account balance"""
        return self._make_request('GET', '/portfolio/balance', authenticated=True)
    
    def get_positions(self, limit: int = 100, ticker: Optional[str] = None) -> Dict:
        """Get positions"""
        params = {'limit': limit}
        if ticker:
            params['ticker'] = ticker
        return self._make_request('GET', '/portfolio/positions', params=params, authenticated=True)
    
    def get_orders(self, status: Optional[str] = None, ticker: Optional[str] = None) -> Dict:
        """Get orders"""
        params = {}
        if status:
            params['status'] = status
        if ticker:
            params['ticker'] = ticker
        return self._make_request('GET', '/portfolio/orders', params=params, authenticated=True)
    
    # Trading Endpoints
    def create_order(self, ticker: str, side: str, action: str, count: int,
                    yes_price: Optional[int] = None, no_price: Optional[int] = None,
                    order_type: str = 'limit', subaccount: int = 0) -> Dict:
        """
        Create an order
        
        Args:
            ticker: Market ticker
            side: 'yes' or 'no'
            action: 'buy' or 'sell'
            count: Number of contracts
            yes_price: YES price in cents (1-99)
            no_price: NO price in cents (1-99)
            order_type: 'limit' or 'market'
            subaccount: Subaccount number (0 for primary)
        """
        data = {
            'ticker': ticker,
            'side': side,
            'action': action,
            'count': count,
            'type': order_type,
            'subaccount': subaccount
        }
        
        if yes_price is not None:
            data['yes_price'] = yes_price
        if no_price is not None:
            data['no_price'] = no_price
            
        return self._make_request('POST', '/portfolio/orders', data=data, authenticated=True)
    
    def cancel_order(self, order_id: str) -> Dict:
        """Cancel an order"""
        return self._make_request('DELETE', f'/portfolio/orders/{order_id}', authenticated=True)

    def amend_order(self, order_id: str, ticker: str, side: str, count: int,
                    yes_price: Optional[int] = None, no_price: Optional[int] = None) -> Dict:
        """Amend a resting limit order's price (and optionally count).
        Kalshi POST /portfolio/orders/{order_id}/amend  (March 2026+)
        Requires: ticker, side ('yes'/'no'), count, and exactly one of yes_price/no_price (cents).
        """
        data: Dict[str, Any] = {
            'ticker': ticker,
            'side': side,
            'count': count,
        }
        if yes_price is not None:
            data['yes_price'] = yes_price
        if no_price is not None:
            data['no_price'] = no_price
        return self._make_request('POST', f'/portfolio/orders/{order_id}/amend', data=data, authenticated=True)

    def get_order(self, order_id: str) -> Dict:
        """Get a specific order's current status (fill count, remaining, status)"""
        return self._make_request('GET', f'/portfolio/orders/{order_id}', authenticated=True)

    def get_fills(self, ticker: Optional[str] = None, limit: int = 100) -> Dict:
        """Get trade fills"""
        params = {'limit': limit}
        if ticker:
            params['ticker'] = ticker
        return self._make_request('GET', '/portfolio/fills', params=params, authenticated=True)

    # ─── WebSocket helpers ────────────────────────────────────────────────
    @property
    def ws_url(self) -> str:
        """Return the WebSocket URL for this environment."""
        if 'demo' in self.base_url:
            return 'wss://demo-api.kalshi.co/trade-api/ws/v2'
        return 'wss://api.elections.kalshi.com/trade-api/ws/v2'

    def ws_auth_headers(self) -> Dict[str, str]:
        """Generate authentication headers for the WebSocket handshake."""
        timestamp = int(time.time() * 1000)
        timestamp_str = str(timestamp)
        # Sign a GET to the WS path
        path = '/trade-api/ws/v2'
        signature = self._sign_request(timestamp_str, 'GET', path)
        return {
            'KALSHI-ACCESS-KEY': self.api_key_id,
            'KALSHI-ACCESS-SIGNATURE': signature,
            'KALSHI-ACCESS-TIMESTAMP': timestamp_str,
        }
