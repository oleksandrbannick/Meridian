import json, datetime
sunday_timestamp = datetime.datetime(2026, 4, 5).timestamp()
with open('backend/trades.jsonl') as f:
    trades = [json.loads(line) for line in f if json.loads(line).get('bot_category') in ('anchor_dog', 'anchor_ladder')]
recent = [t for t in trades if t.get('timestamp', 0) >= sunday_timestamp]
won = [t for t in recent if t.get('profit_cents', 0) > 0]
lost = [t for t in recent if t.get('loss_cents', 0) > 0]
scratched = [t for t in recent if t.get('profit_cents', 0) == 0 and t.get('loss_cents', 0) == 0]
print(f"Total: {len(recent)} | W: {len(won)} | L: {len(lost)} | S: {len(scratched)}")
if recent:
    net = sum(t.get('profit_cents',0) - t.get('loss_cents',0) - t.get('fee_cents',0) for t in recent)
    print(f"Net PnL: {net}c")
    avg_w = sum(t.get('profit_cents',0) for t in won) / max(1, len(won))
    avg_l = sum(t.get('loss_cents',0) for t in lost) / max(1, len(lost))
    print(f"Avg W: {avg_w:.2f}c | Avg L: {avg_l:.2f}c")
exits = {}
for t in recent:
    e = t.get('exit_via', 'unknown')
    exits[e] = exits.get(e, 0) + 1
print(f"Exits: {exits}")
