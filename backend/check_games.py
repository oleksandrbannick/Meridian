#!/usr/bin/env python3
"""Quick check for missing NCAAB games on Kalshi"""
from kalshi_api import KalshiAPI
import json

with open('config.json') as f:
    cfg = json.load(f)

client = KalshiAPI(cfg['api_key_id'], cfg['private_key_path'], demo=cfg.get('demo', False))

search_terms = ['BELLAR', 'CENTRAL ARK', 'GARDNER', 'HIGH POINT', 'WEBB']
series_list = ['KXNCAAMBGAME', 'KXNCAAMBSPREAD', 'KXNCAAMBTOTAL', 'KXNCAAMBPTS', 'KXNCAAMB1HWINNER']

print("=== Searching for missing games ===")
for series in series_list:
    try:
        result = client.get_markets_by_series(series, status='open', limit=200)
        markets = result.get('markets', [])
        for m in markets:
            title = m.get('title', '')
            if any(x in title.upper() for x in search_terms):
                print(f"FOUND: {series} | {m.get('ticker')} | {m.get('event_ticker')} | {title}")
        print(f"  {series}: {len(markets)} markets")
    except Exception as e:
        print(f"  {series}: ERROR - {e}")

print("\n=== All KXNCAAMBGAME titles ===")
result = client.get_markets_by_series('KXNCAAMBGAME', status='open', limit=200)
for m in result.get('markets', []):
    print(f"  {m.get('event_ticker', '')} | {m.get('title', '')}")

print(f"\nTotal NCAAB winner markets: {len(result.get('markets', []))}")
