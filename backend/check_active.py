import json, sys

d = json.load(open('/Applications/Programs/Meridian/backend/data_vps4.json'))
count = 0
for k, v in d.get('active_bots', {}).items():
    s = v.get('status', '')
    if s in ('completed', 'stopped'):
        continue
    count += 1
    print('=' * 60)
    print('BOT:', k)
    print('  status:', s, 'cat:', v.get('bot_category'), 'ticker:', v.get('ticker'))
    print('  qty:', v.get('quantity'), 'scale:', v.get('scale_qty'), 'widths:', v.get('widths'))
    print('  consol:', v.get('_consolidated'), 'hedge_oid:', str(v.get('hedge_order_id') or '')[:12], 'hprice:', v.get('hedge_price'), 'hqty:', v.get('hedge_qty'))
    print('  walk:', v.get('walk_count'), 'trade_rec:', v.get('_trade_recorded'))
    for i, r in enumerate(v.get('rungs', [])):
        print('  R%d w=%s q=%s yp=%s np=%s yoid=%s noid=%s yf=%s nf=%s comp=%s' % (
            i, r.get('width'), r.get('quantity'), r.get('yes_price'), r.get('no_price'),
            str(r.get('yes_order_id') or '')[:12], str(r.get('no_order_id') or '')[:12],
            r.get('yes_fill_qty', 0), r.get('no_fill_qty', 0), r.get('completed')))
print(f'\nTotal active: {count}')

# Also show any larb/LAL bots regardless of status
print('\n--- ALL LARB/LAL BOTS (any status) ---')
for k, v in d.get('active_bots', {}).items():
    if 'larb_' in k and ('LAL' in k or 'LAK' in k):
        print('BOT:', k, 'status:', v.get('status'))
        print('  qty:', v.get('quantity'), 'scale:', v.get('scale_qty'), 'widths:', v.get('widths'))
        for i, r in enumerate(v.get('rungs', [])):
            print('  R%d w=%s q=%s yp=%s np=%s yf=%s nf=%s' % (
                i, r.get('width'), r.get('quantity'), r.get('yes_price'), r.get('no_price'),
                r.get('yes_fill_qty', 0), r.get('no_fill_qty', 0)))
