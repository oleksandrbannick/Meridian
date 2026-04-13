import json, datetime
ts = datetime.datetime(2026, 4, 5).timestamp()
with open('backend/trades.jsonl') as f:
    trades = [json.loads(x) for x in f if json.loads(x).get('bot_category') in ('anchor_dog', 'anchor_ladder') and json.loads(x).get('timestamp',0)>=ts and json.loads(x).get('exit_via','').startswith('sell_back')]

avg_sellback_loss = sum(t.get('loss_cents', 0) / max(1, t.get('quantity', 1)) for t in trades) / len(trades) if trades else 0

total_potential_arb_loss = 0
for t in trades:
    fav_price = t.get('fav_price', 100)
    dog_price = t.get('dog_price', 0)
    arb_combo_price = dog_price + fav_price
    arb_loss_per_contract = arb_combo_price - 100
    total_potential_arb_loss += max(arb_loss_per_contract, 0)
    
avg_potential_arb_loss = total_potential_arb_loss / len(trades) if trades else 0

print(f'Average Loss per contract via Sell-back: {avg_sellback_loss:.2f} cents')
print(f'Average Loss per contract if we had just bought the Fav leg (crossed the spread): {avg_potential_arb_loss:.2f} cents')
