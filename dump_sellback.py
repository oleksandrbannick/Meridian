import json, datetime
sunday_timestamp = datetime.datetime(2026, 4, 5).timestamp()
with open('backend/trades.jsonl') as f:
    trades = [json.loads(line) for line in f if json.loads(line).get('bot_category') in ('anchor_dog', 'anchor_ladder')]
recent = [t for t in trades if t.get('timestamp', 0) >= sunday_timestamp]
sellbacks = [t for t in recent if t.get('exit_via', 'unknown').startswith('sell_back')]
if sellbacks:
    print(json.dumps(sellbacks[0], indent=2))
