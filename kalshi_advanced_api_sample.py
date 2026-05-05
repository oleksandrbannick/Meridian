"""
Kalshi Advanced API Application — Code Sample
Demonstrates: market query, orderbook query, order placement and cancellation.

Author: Oleksandr Bannick
System: Meridian Trading Terminal
"""

import json
import os
import time
import base64
import requests
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend


# ── Configuration ──

BASE_URL = "https://api.elections.kalshi.com"
API_VERSION = "/trade-api/v2"

# Load credentials from config
config_path = os.path.join(os.path.dirname(__file__), "backend", "config.json")
with open(config_path) as f:
    config = json.load(f)

API_KEY_ID = config["api_key_id"]
KEY_PATH = os.path.join(os.path.dirname(__file__), "backend", config.get("private_key_path", "kalshi_private_key.pem"))

with open(KEY_PATH, "rb") as kf:
    PRIVATE_KEY = serialization.load_pem_private_key(kf.read(), password=None, backend=default_backend())

session = requests.Session()


# ── Auth Helper ──

def sign_request(timestamp_str: str, method: str, path: str) -> str:
    message = (timestamp_str + method + path).encode("utf-8")
    signature = PRIVATE_KEY.sign(
        message,
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
        hashes.SHA256(),
    )
    return base64.b64encode(signature).decode("utf-8")


def api_request(method: str, endpoint: str, params=None, data=None, authenticated=True):
    url = f"{BASE_URL}{API_VERSION}{endpoint}"
    path = f"{API_VERSION}{endpoint}".split("?")[0]
    headers = {"Content-Type": "application/json"}

    if authenticated:
        ts = str(int(time.time() * 1000))
        headers["KALSHI-ACCESS-KEY"] = API_KEY_ID
        headers["KALSHI-ACCESS-SIGNATURE"] = sign_request(ts, method, path)
        headers["KALSHI-ACCESS-TIMESTAMP"] = ts

    resp = session.request(method, url, headers=headers, params=params, json=data)
    resp.raise_for_status()
    return resp.json()


# ── Step 1: Query the API for market data on today's NYC weather ──

print("=" * 60)
print("STEP 1: Finding today's NYC weather market")
print("=" * 60)

# Search for NYC weather markets
markets_resp = api_request("GET", "/markets", params={
    "limit": 20,
    "status": "open",
    "series_ticker": "KXHIGHNY",  # NYC high temperature series
})

markets = markets_resp.get("markets", [])
if not markets:
    # Fallback: try broader search
    markets_resp = api_request("GET", "/markets", params={
        "limit": 100,
        "status": "open",
    })
    markets = [m for m in markets_resp.get("markets", []) if "NY" in m.get("ticker", "") and "HIGH" in m.get("ticker", "")]

if not markets:
    print("No NYC weather markets found open today. Exiting.")
    exit(1)

market = markets[0]
ticker = market["ticker"]
title = market.get("title", market.get("subtitle", ticker))
yes_bid = market.get("yes_bid", 0)
no_bid = market.get("no_bid", 0)

print(f"  Market: {title}")
print(f"  Ticker: {ticker}")
print(f"  YES bid: {yes_bid}¢  |  NO bid: {no_bid}¢")
print(f"  Status: {market.get('status', '?')}")
print()


# ── Step 2: Query the orderbook for that market ──

print("=" * 60)
print("STEP 2: Querying orderbook")
print("=" * 60)

orderbook = api_request("GET", f"/markets/{ticker}/orderbook", params={"depth": 5})

yes_bids = orderbook.get("orderbook", {}).get("yes", [])
no_bids = orderbook.get("orderbook", {}).get("no", [])

print(f"  YES bids (top 5):")
for level in yes_bids[:5]:
    price, qty = (level if isinstance(level, list) else [level.get("price", 0), level.get("quantity", 0)])
    print(f"    {price}¢  —  {qty} contracts")

print(f"  NO bids (top 5):")
for level in no_bids[:5]:
    price, qty = (level if isinstance(level, list) else [level.get("price", 0), level.get("quantity", 0)])
    print(f"    {price}¢  —  {qty} contracts")
print()


# ── Step 3: Place and cancel an order of 1 unit ──

print("=" * 60)
print("STEP 3: Placing and cancelling a 1-contract order")
print("=" * 60)

# Place a YES limit order at 1¢ (deep in the book, won't fill)
order_price = 1  # 1¢ — safe, won't match
order_resp = api_request("POST", "/portfolio/orders", data={
    "ticker": ticker,
    "action": "buy",
    "side": "yes",
    "count": 1,
    "type": "limit",
    "yes_price": order_price,
})

order = order_resp.get("order", {})
order_id = order.get("order_id", "")
print(f"  Order placed: YES @ {order_price}¢ x1")
print(f"  Order ID: {order_id}")
print(f"  Status: {order.get('status', '?')}")

# Brief pause then cancel
time.sleep(0.5)

cancel_resp = api_request("DELETE", f"/portfolio/orders/{order_id}")
print(f"  Order cancelled successfully.")
print()

print("=" * 60)
print("All 3 steps completed successfully.")
print("=" * 60)
