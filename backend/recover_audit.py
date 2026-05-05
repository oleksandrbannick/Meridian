#!/usr/bin/env python3
"""
Read-only audit of bot fill state vs actual Kalshi positions.
No mutations. Run with: python3 recover_audit.py
"""
import json, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from kalshi_api import KalshiAPI


def _f(v, default=0.0):
    try: return float(v)
    except (TypeError, ValueError): return default


def parse_fill_count(o):
    fp = o.get('fill_count_fp')
    if fp is not None:
        try: return float(fp)
        except: pass
    fc = o.get('filled_count')
    if fc is not None:
        return float(fc) if fc else 0.0
    if o.get('status') == 'executed':
        return _f(o.get('initial_count_fp', o.get('count', 0)))
    return 0.0


def main():
    cfg = json.load(open(os.path.join(os.path.dirname(__file__), 'config.json')))
    api = KalshiAPI(
        cfg['api_key_id'],
        os.path.join(os.path.dirname(__file__), cfg['private_key_path']),
        demo=cfg.get('demo', False),
    )

    state = json.load(open(os.path.join(os.path.dirname(__file__), 'data.json')))
    bots = state.get('active_bots', {})

    # Pull all Kalshi positions (market-level)
    pos_resp = api.get_positions(limit=200)
    market_positions = pos_resp.get('market_positions', []) if isinstance(pos_resp, dict) else []
    by_ticker = {}
    for p in market_positions:
        q = _f(p.get('position'))
        if q == 0: continue
        t = p.get('ticker', '')
        side = 'yes' if q > 0 else 'no'
        exp = _f(str(p.get('market_exposure_dollars', 0)))
        rpnl = _f(str(p.get('realized_pnl_dollars', 0)))
        avg_cost_cents = round((exp / abs(q)) * 100) if q else 0
        by_ticker[t] = {
            'side': side, 'qty': abs(q),
            'exposure_cents': round(exp * 100),
            'realized_pnl_cents': round(rpnl * 100),
            'avg_cost_cents': avg_cost_cents,
        }

    # Build per-bot fill state from local data.json
    bot_by_ticker = {}
    for bid, b in bots.items():
        if not isinstance(b, dict): continue
        if b.get('bot_category') != 'anchor_dog': continue
        if b.get('status') in ('completed', 'cancelled', 'stopped'): continue
        t = b.get('ticker', '')
        bot_by_ticker.setdefault(t, []).append((bid, b))

    print(f'\n=== {len(by_ticker)} Kalshi positions vs {len(bot_by_ticker)} active phantom bots ===\n')

    discrepancies = []
    for t, kp in sorted(by_ticker.items()):
        bots_here = bot_by_ticker.get(t, [])
        if not bots_here:
            discrepancies.append({
                'ticker': t, 'kind': 'NO_BOT',
                'kalshi': kp,
                'recommended': 'sell_orphan_with_real_pnl',
            })
            continue
        for bid, b in bots_here:
            dog_side = b.get('dog_side', '')
            dog_fills = _f(b.get('dog_fill_qty', 0))
            status = b.get('status', '')
            # If position side matches dog_side and bot says 0 fills => MISSED
            if kp['side'] == dog_side and dog_fills == 0 and kp['qty'] > 0:
                # Verify by querying every order ID we know about
                order_ids = list(set(filter(None, [
                    b.get('dog_order_id'), b.get('yes_order_id'), b.get('no_order_id'),
                    *b.get('_all_dog_order_ids', []),
                ])))
                actual_fills = []
                for oid in order_ids:
                    try:
                        r = api.get_order(oid)
                        o = r.get('order', r) if isinstance(r, dict) else {}
                        fc = parse_fill_count(o)
                        if fc > 0:
                            actual_fills.append({
                                'oid': oid[:12], 'fills': fc,
                                'status': o.get('status'),
                                'fill_cost_dollars': o.get('maker_fill_cost_dollars'),
                            })
                    except Exception as e:
                        actual_fills.append({'oid': oid[:12], 'error': str(e)[:60]})
                discrepancies.append({
                    'ticker': t, 'kind': 'MISSED_FILL',
                    'bot_id': bid, 'status': status,
                    'kalshi': kp, 'bot_says_dog_fills': dog_fills,
                    'order_ids_checked': len(order_ids),
                    'orders_with_fills': actual_fills,
                    'recommended': 'backfill_dog_fill_qty + transition_to_dog_filled',
                })

    if not discrepancies:
        print('No discrepancies found. All Kalshi positions match bot fill state.\n')
        return

    print(f'⚠ {len(discrepancies)} discrepancies:\n')
    for d in discrepancies:
        print(f"--- {d['ticker']} [{d['kind']}] ---")
        for k, v in d.items():
            if k == 'ticker' or k == 'kind': continue
            print(f"  {k}: {v}")
        print()

    # Summary by kind
    from collections import Counter
    print('=== Summary ===')
    print(Counter(d['kind'] for d in discrepancies))
    print()

    # Recommended actions
    print('=== Recommended actions per case ===')
    for d in discrepancies:
        kp = d.get('kalshi', {})
        ticker = d['ticker']
        side = kp.get('side', '?')
        qty = kp.get('qty', 0)
        avg = kp.get('avg_cost_cents', 0)
        if d['kind'] == 'NO_BOT':
            print(f"{ticker}: no bot exists. {qty}x {side.upper()} @ {avg}¢ avg. → sell at bid (Sell Orphan + Taker), record real P&L")
        elif d['kind'] == 'MISSED_FILL':
            actual = sum(o.get('fills', 0) for o in d.get('orders_with_fills', []))
            if actual > 0:
                print(f"{ticker}: bot has order(s) with {actual} fills but local state says 0. Bot can be repaired by setting dog_fill_qty={actual}, status=dog_filled — monitor cycle will then post the missed hedge.")
            else:
                print(f"{ticker}: position exists but all bot order IDs show 0 fills. Position came from a different (older) order — orphan sale is the only option.")


if __name__ == '__main__':
    main()
