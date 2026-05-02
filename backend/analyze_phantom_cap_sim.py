"""Offline analyzer: simulate "cap at 100c combined" strategy against the actual
phantom price tape + trades.jsonl. Run anytime — no behavior change to live system.

Usage:
    python3 backend/analyze_phantom_cap_sim.py [--since-days N]

Reads:
    backend/phantom_price_tape.jsonl  (BBO + bot state, logged from WS)
    backend/trades.jsonl               (settlement outcomes)

Reports per phantom trade:
    - actual P&L (current strategy: post hedge at fav_bid, eat whatever combined)
    - cap P&L (only post hedge if combined would be <= 100c, else ride to settlement)
    - delta (cap - actual)

Caveats:
    - Cap "fill" is approximated: assumes hedge fills the moment fav_ask <= cap_target.
      Real maker fills may take longer (queue position). Numbers are upper-bound for cap.
    - Skips trades that started before the tape was being written (no path data).
"""
import json
import sys
import os
from collections import defaultdict
from datetime import datetime, timezone, timedelta

AZ = timezone(timedelta(hours=-7))

TAPE_PATH = '/root/meridian/backend/phantom_price_tape.jsonl'
TRADES_PATH = '/root/meridian/backend/trades.jsonl'


def load_tape(since_ts=0):
    """Returns dict: bot_id -> sorted list of tape entries."""
    by_bot = defaultdict(list)
    if not os.path.exists(TAPE_PATH):
        return by_bot
    with open(TAPE_PATH) as f:
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get('ts', 0) < since_ts:
                continue
            by_bot[e.get('bot_id', '')].append(e)
    for bid in by_bot:
        by_bot[bid].sort(key=lambda x: x.get('ts', 0))
    return by_bot


def load_trades(since_ts=0):
    """Returns list of phantom trade records."""
    out = []
    if not os.path.exists(TRADES_PATH):
        return out
    with open(TRADES_PATH) as f:
        for line in f:
            try:
                t = json.loads(line)
            except Exception:
                continue
            if t.get('bot_category') not in ('anchor_dog', 'anchor_ladder'):
                continue
            if t.get('_supplemental_merged_into'):
                continue  # skip merged audit rows
            if t.get('timestamp', 0) < since_ts:
                continue
            out.append(t)
    return out


def simulate_cap(trade, tape_entries):
    """Simulate cap-at-100 strategy against this trade's tape entries.

    Returns dict with: cap_target, cap_post_ts, cap_fill_ts, cap_fill_price,
    cap_pnl_cents, cap_outcome ('filled'/'unfilled'/'no_data').
    """
    dog_price = trade.get('dog_price', 0) or 0
    fav_side = 'no' if trade.get('dog_side') == 'yes' else 'yes'
    qty = trade.get('quantity', 0) or 0
    cap_target = 100 - dog_price  # max fav price for combined <= 100

    if not tape_entries:
        return {'cap_target': cap_target, 'cap_outcome': 'no_data'}

    # Walk the tape: when did fav_bid first drop to <= cap_target?
    cap_post_ts = None
    cap_fill_ts = None
    cap_fill_price = None
    for e in tape_entries:
        fav_bid = e.get(f'{fav_side}_bid', 0) or 0
        fav_ask = e.get(f'{fav_side}_ask', 0) or 0
        if cap_post_ts is None and 0 < fav_bid <= cap_target:
            cap_post_ts = e.get('ts')
        if cap_post_ts and cap_fill_ts is None:
            # Approximation: assume hedge fills when ask drops to our bid level
            # (i.e., someone crosses our resting maker order). Conservative.
            if 0 < fav_ask <= cap_target:
                cap_fill_ts = e.get('ts')
                cap_fill_price = fav_ask  # filled at the ask we touched

    # Compute cap P&L
    if cap_fill_ts and cap_fill_price:
        # Hedge filled at cap_fill_price. Combined = dog + cap_fill_price <= 100.
        # Phantom P&L = (100 - dog - fav) * qty
        cap_combined = dog_price + cap_fill_price
        cap_pnl_cents = (100 - cap_combined) * qty
        outcome = 'filled'
    else:
        # Hedge never filled under cap rules. Outcome depends on which side won
        # at settlement. We can infer from the actual trade record:
        # actual completion via 'anchor_dog_complete' means fav fills somewhere.
        # If we'd ridden the dog to settlement instead:
        #   - dog wins: payout 100, dog cost = dog_price, profit = (100 - dog) * qty
        #   - dog loses: payout 0, dog cost = dog_price, loss = -dog_price * qty
        # Without settlement-side data we approximate from trade result
        # (this is rough — for a real backtest you'd need market_position from Kalshi).
        # Use a heuristic: if combined > 100 in actual trade, assume real reprice
        # = fav side wins = dog rode to 0 = full dog loss.
        # If combined <= 100 in actual trade, assume slippage recovered = mixed outcomes.
        actual_combined = dog_price + (trade.get('fav_price', 0) or 0)
        if actual_combined > 100:
            cap_pnl_cents = -dog_price * qty  # dog rode to 0
        else:
            # Would have been profitable arb; cap missed by being too conservative.
            cap_pnl_cents = 0  # estimate breakeven; real number depends on settlement
        outcome = 'unfilled'

    return {
        'cap_target': cap_target,
        'cap_post_ts': cap_post_ts,
        'cap_fill_ts': cap_fill_ts,
        'cap_fill_price': cap_fill_price,
        'cap_pnl_cents': cap_pnl_cents,
        'cap_outcome': outcome,
    }


def main():
    since_days = 7
    if '--since-days' in sys.argv:
        idx = sys.argv.index('--since-days')
        since_days = int(sys.argv[idx + 1])
    since_ts = (datetime.now(AZ) - timedelta(days=since_days)).timestamp()

    print(f"Analyzing trades since {datetime.fromtimestamp(since_ts, AZ).strftime('%Y-%m-%d %H:%M %Z')}")

    tape = load_tape(since_ts)
    trades = load_trades(since_ts)

    print(f"Tape entries: {sum(len(v) for v in tape.values())} across {len(tape)} bots")
    print(f"Phantom trades: {len(trades)}")

    if not trades:
        print("No trades to analyze.")
        return

    rows = []
    for t in trades:
        bid = t.get('bot_id', '')
        entries = tape.get(bid, [])
        sim = simulate_cap(t, entries)
        actual_pnl = (t.get('profit_cents', 0) or 0) - (t.get('loss_cents', 0) or 0) - (t.get('fee_cents', 0) or 0)
        rows.append({
            'bot_id': bid[:32],
            'ticker': t.get('ticker', '')[:30],
            'dog_price': t.get('dog_price'),
            'fav_price': t.get('fav_price'),
            'combined': (t.get('dog_price', 0) or 0) + (t.get('fav_price', 0) or 0),
            'qty': t.get('quantity'),
            'actual_pnl_c': actual_pnl,
            'cap_pnl_c': sim['cap_pnl_cents'] if sim['cap_outcome'] != 'no_data' else None,
            'cap_outcome': sim['cap_outcome'],
            'cap_target': sim['cap_target'],
        })

    # Summary
    n_with_data = sum(1 for r in rows if r['cap_pnl_c'] is not None)
    actual_total = sum(r['actual_pnl_c'] for r in rows if r['cap_pnl_c'] is not None)
    cap_total = sum(r['cap_pnl_c'] for r in rows if r['cap_pnl_c'] is not None)
    delta = cap_total - actual_total

    print(f"\n=== Summary ({n_with_data} trades with tape data) ===")
    print(f"  Actual total P&L:    {actual_total/100:+.2f}$")
    print(f"  Cap-at-100 simulated: {cap_total/100:+.2f}$")
    print(f"  Delta (cap - actual): {delta/100:+.2f}$  ({'cap better' if delta > 0 else 'cap worse' if delta < 0 else 'even'})")

    # Breakdown by cap outcome
    by_outcome = defaultdict(lambda: {'count': 0, 'actual_pnl': 0, 'cap_pnl': 0})
    for r in rows:
        if r['cap_pnl_c'] is None:
            continue
        o = r['cap_outcome']
        by_outcome[o]['count'] += 1
        by_outcome[o]['actual_pnl'] += r['actual_pnl_c']
        by_outcome[o]['cap_pnl'] += r['cap_pnl_c']

    print(f"\n=== By cap outcome ===")
    for o, s in sorted(by_outcome.items()):
        d = s['cap_pnl'] - s['actual_pnl']
        print(f"  {o:10s}  n={s['count']:3d}  actual={s['actual_pnl']/100:+.2f}$  cap={s['cap_pnl']/100:+.2f}$  delta={d/100:+.2f}$")

    # Show worst-actual trades (where cap might have helped)
    worst = sorted([r for r in rows if r['cap_pnl_c'] is not None], key=lambda x: x['actual_pnl_c'])[:10]
    print(f"\n=== 10 worst actual trades (cap delta column shows where cap would have helped) ===")
    print(f"  {'bot':<32} {'ticker':<32} {'dog':>4} {'fav':>4} {'comb':>4} {'actual$':>9} {'cap$':>9} {'outc':>9}")
    for r in worst:
        print(f"  {r['bot_id']:<32} {r['ticker']:<32} {r['dog_price']:>4} {r['fav_price']:>4} {r['combined']:>4} {r['actual_pnl_c']/100:>+9.2f} {r['cap_pnl_c']/100:>+9.2f} {r['cap_outcome']:>9}")


if __name__ == '__main__':
    main()
