import json
with open('data.json') as f:
    data = json.load(f)
bots = data.get('active_bots', {})
for bid, bot in bots.items():
    if bot.get('strategy') == 'ladder_arb':
        print(f"=== BOT: {bid} ===")
        print(f"Status: {bot.get('status')}")
        print(f"Ticker: {bot.get('ticker')}")
        print(f"Consolidated: {bot.get('_consolidated')}")
        print(f"Sweep running: {bot.get('_sweep_thread_running')}")
        print(f"Hedge OID: {bot.get('hedge_order_id')}")
        print(f"Hedge price: {bot.get('hedge_price')}")
        print(f"Hedge qty: {bot.get('hedge_qty')}")
        print(f"All hedge OIDs: {bot.get('_all_hedge_order_ids')}")
        print(f"Filled YES: {bot.get('filled_yes_qty')} @ avg {bot.get('avg_yes_price')}")
        print(f"Filled NO: {bot.get('filled_no_qty')} @ avg {bot.get('avg_no_price')}")
        print()
        for i, r in enumerate(bot.get('rungs', [])):
            w = r.get('width')
            yp = r.get('yes_price')
            np2 = r.get('no_price')
            yoid = r.get('yes_order_id')
            noid = r.get('no_order_id')
            yf = r.get('yes_fill_qty', 0)
            nf = r.get('no_fill_qty', 0)
            comp = r.get('completed')
            print(f"  Rung {i}: w={w} yp={yp} np={np2} yoid={yoid} noid={noid} yf={yf} nf={nf} done={comp}")
        print()
