#!/usr/bin/env python3
"""Check tennis bot status and history."""
import json, sys, urllib.request

def fetch(path):
    r = urllib.request.urlopen(f'http://localhost:5001{path}')
    return json.loads(r.read())

# Active bots
d = fetch('/api/bot/list')
bots_raw = d.get('bots', {})
if isinstance(bots_raw, dict):
    bots = list(bots_raw.values())
else:
    bots = bots_raw
tennis = [b for b in bots if isinstance(b, dict) and ('ATP' in b.get('ticker','').upper() or 'WTA' in b.get('ticker','').upper())]
print(f"=== ACTIVE BOTS: {len(bots)} total, {len(tennis)} tennis ===")
for b in tennis:
    t = b.get('ticker','?')
    s = b.get('status','?')
    w = b.get('arb_width','?')
    p = b.get('net_pnl_cents',0)
    yf = b.get('yes_filled',0); yt = b.get('yes_count', b.get('quantity',0))
    nf = b.get('no_filled',0); nt = b.get('no_count', b.get('quantity',0))
    rc = b.get('repeat_cycle',0); rp = b.get('repeat_count',0)
    ap = b.get('amend_price','')
    print(f"  {s:16s} | w={w} pnl={p:>5} | Y={yf}/{yt} N={nf}/{nt} | rep={rc}/{rp} | amend={ap} | {t[:55]}")

# Trade history
h = fetch('/api/bot/history?limit=500')
trades = h.get('trades', [])
tennis_trades = [x for x in trades if 'ATP' in x.get('ticker','').upper() or 'WTA' in x.get('ticker','').upper()]
print(f"\n=== TRADE HISTORY: {len(trades)} total, {len(tennis_trades)} tennis ===")
for x in tennis_trades[-20:]:
    t = x.get('ticker','?')
    res = x.get('result','?')
    pc = x.get('profit_cents',0)
    lc = x.get('loss_cents',0)
    yp = x.get('yes_price','?')
    np_ = x.get('no_price','?')
    oy = x.get('original_yes','?')
    on = x.get('original_no','?')
    w = x.get('arb_width','?')
    q = x.get('quantity',1)
    ts = x.get('timestamp','?')
    if isinstance(ts, (int, float)):
        import datetime
        ts = datetime.datetime.fromtimestamp(ts).strftime('%m/%d %H:%M')
    print(f"  {res:22s} | p={pc:>5} l={lc:>5} | yes={yp} no={np_} | orig_y={oy} orig_n={on} | w={w} q={q} | {ts} | {t[:50]}")

# Negative PnL entries (the -15c ones user is asking about)
neg_trades = [x for x in trades if x.get('profit_cents', 0) < 0 or x.get('loss_cents', 0) > 0]
print(f"\n=== NEGATIVE PNL TRADES: {len(neg_trades)} ===")
for x in neg_trades[-15:]:
    t = x.get('ticker','?')
    res = x.get('result','?')
    pc = x.get('profit_cents',0)
    lc = x.get('loss_cents',0)
    yp = x.get('yes_price','?')
    np_ = x.get('no_price','?')
    oy = x.get('original_yes','?')
    on = x.get('original_no','?')
    w = x.get('arb_width','?')
    q = x.get('quantity',1)
    ts = x.get('timestamp','?')
    if isinstance(ts, (int, float)):
        import datetime
        ts = datetime.datetime.fromtimestamp(ts).strftime('%m/%d %H:%M')
    ev = x.get('exit_via','')
    print(f"  {res:22s} | p={pc:>5} l={lc:>5} | yes={yp} no={np_} | orig_y={oy} orig_n={on} | w={w} q={q} ev={ev} | {ts} | {t[:45]}")

# Full dump of specific -15c entries
print(f"\n=== FULL DUMP of last 3 negative entries ===")
for x in neg_trades[-3:]:
    filtered = {k: v for k, v in x.items() if v not in (None, '', 0, False, [], {})}
    print(json.dumps(filtered, indent=2, default=str))
    print("---")

# History  
h = fetch('/api/bot/history')
history = h.get('history', [])
tennis_hist = [x for x in history if 'ATP' in x.get('ticker','').upper() or 'WTA' in x.get('ticker','').upper()]
print(f"\n=== HISTORY: {len(history)} total, {len(tennis_hist)} tennis ===")
for x in tennis_hist[-20:]:
    t = x.get('ticker','?')
    a = x.get('action','?')
    p = x.get('pnl',0)
    w = x.get('width','?')
    ts = x.get('completed_at', x.get('timestamp','?'))
    rc = x.get('repeat_cycle',0)
    yp = x.get('yes_price','?'); np_ = x.get('no_price','?')
    ap = x.get('amend_price', '')
    print(f"  {a:22s} | pnl={p:>5} | w={w} | yp={yp} np={np_} amend={ap} | rep={rc} | {ts[:19]} | {t[:55]}")

# Show ALL history entries with negative pnl 
neg = [x for x in history if (x.get('pnl',0) or 0) < 0]
print(f"\n=== NEGATIVE PNL ENTRIES: {len(neg)} ===")
for x in neg:
    t = x.get('ticker','?')
    a = x.get('action','?')
    p = x.get('pnl',0)
    w = x.get('width','?')
    ts = x.get('completed_at', x.get('timestamp','?'))
    yp = x.get('yes_price','?'); np_ = x.get('no_price','?')
    ap = x.get('amend_price', '')
    es = x.get('exit_side','?')
    print(f"  {a:22s} | pnl={p:>5} | w={w} | yp={yp} np={np_} amend={ap} | exit={es} | {ts[:19]} | {t[:55]}")

# Full dump of negative pnl entries
print(f"\n=== FULL DUMP of negative entries ===")
for x in neg[:5]:
    print(json.dumps(x, indent=2, default=str))
    print("---")

# Stats
try:
    st = fetch('/api/bot/history/stats')
    print(f"\n=== STATS ===")
    for k,v in st.items():
        print(f"  {k}: {v}")
except Exception as e:
    print(f"Stats error: {e}")
