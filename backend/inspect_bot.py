import json, sys

fname = sys.argv[1] if len(sys.argv) > 1 else 'data.json'
with open(fname) as f:
    data = json.load(f)

bots = data.get('active_bots', {})
for bid, bot in bots.items():
    st = bot.get('status', '')
    if st == 'completed' or st == 'stopped':
        continue
    print("=" * 60)
    print("BOT:", bid)
    print("status:", bot.get('status'))
    print("ticker:", bot.get('ticker'))
    print("bot_category:", bot.get('bot_category'))
    print("consolidated:", bot.get('_consolidated'))
    print("sweep_running:", bot.get('_sweep_thread_running'))
    print("hedge_oid:", str(bot.get('hedge_order_id', ''))[:20])
    print("hedge_price:", bot.get('hedge_price'))
    print("hedge_qty:", bot.get('hedge_qty'))
    print("walk_count:", bot.get('walk_count'))
    aids = bot.get('_all_hedge_order_ids', [])
    print("all_hedge_oids:", [x[:16] for x in aids] if aids else [])
    print("yes_fill:", bot.get('filled_yes_qty'), "avg:", bot.get('avg_yes_price'))
    print("no_fill:", bot.get('filled_no_qty'), "avg:", bot.get('avg_no_price'))
    print("-" * 40)
    rungs = bot.get('rungs', [])
    if rungs:
        for i, r in enumerate(rungs):
            w = r.get('width')
            yp = r.get('yes_price')
            np_ = r.get('no_price')
            yoid = str(r.get('yes_order_id') or '')[:20]
            noid = str(r.get('no_order_id') or '')[:20]
            yf = r.get('yes_fill_qty', 0)
            nf = r.get('no_fill_qty', 0)
            done = r.get('completed')
            print("  R%d: w=%s yp=%s np=%s yoid=%s noid=%s yf=%s nf=%s done=%s" % (i, w, yp, np_, yoid, noid, yf, nf, done))
    print()
