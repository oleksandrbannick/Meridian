import math

KALSHI_MAKER_RATE = 0.07

def _kalshi_side_fee_cents(price_cents, qty):
    P = price_cents / 100
    raw_dollars = KALSHI_MAKER_RATE * qty * P * (1 - P)
    return math.ceil(raw_dollars * 100)

def kalshi_fee_cents(yes_price, no_price, qty):
    return _kalshi_side_fee_cents(yes_price, qty) + _kalshi_side_fee_cents(no_price, qty)

WIDTH_QTY_TIERS = [(13, 3.0), (9, 1.5), (1, 1.0)]

def _scale_qty_for_width(base_qty, width):
    for threshold, mult in WIDTH_QTY_TIERS:
        if width >= threshold:
            return max(1, int(base_qty * mult))
    return base_qty

# LAL market approximate values
yes_bid, no_bid = 56, 40
yes_ask = 100 - no_bid  # 60
no_ask = 100 - yes_bid   # 44
base_qty = 1

print(f"Market: yes_bid={yes_bid} no_bid={no_bid} yes_ask={yes_ask} no_ask={no_ask}")
print(f"{'W':>3} {'YesP':>5} {'NoP':>5} {'Prof':>5} {'Qty':>4} {'Fee':>4} {'Net':>5} {'CrossY':>7} {'CrossN':>7} {'Result':>8}")
print("-" * 65)

for w in range(5, 17):
    target_total = 100 - w
    yes_is_fav = yes_bid >= no_bid
    bid_sum = yes_bid + no_bid
    total_shave = bid_sum - target_total
    fav_shave = total_shave * 6 // 10
    dog_shave = total_shave - fav_shave
    dog_bid_val = no_bid if yes_is_fav else yes_bid
    dog_max_shave = max(0, dog_bid_val - 1)
    if dog_shave > dog_max_shave:
        overflow = dog_shave - dog_max_shave
        dog_shave = dog_max_shave
        fav_shave += overflow
    if yes_is_fav:
        target_yes = yes_bid - fav_shave
        target_no = no_bid - dog_shave
    else:
        target_yes = yes_bid - dog_shave
        target_no = no_bid - fav_shave
    target_yes = min(target_yes, yes_bid)
    target_no = min(target_no, no_bid)
    target_yes = max(1, min(target_yes, 98))
    target_no = max(1, min(target_no, 98))
    actual_profit = 100 - target_yes - target_no
    if actual_profit < w:
        if yes_is_fav:
            target_yes = max(1, 100 - target_no - w)
        else:
            target_no = max(1, 100 - target_yes - w)

    profit = 100 - target_yes - target_no
    rung_qty = _scale_qty_for_width(base_qty, w)
    fee = kalshi_fee_cents(target_yes, target_no, rung_qty)
    net = (profit * rung_qty) - fee
    cross_y = target_yes >= yes_ask
    cross_n = target_no >= no_ask

    result = "OK"
    if profit <= 0: result = "NO_PROF"
    elif net <= 0: result = "NO_NET"
    elif cross_y: result = "CROSS_Y"
    elif cross_n: result = "CROSS_N"

    print(f"{w:>3} {target_yes:>5} {target_no:>5} {profit:>5} {rung_qty:>4} {fee:>4} {net:>5} {str(cross_y):>7} {str(cross_n):>7} {result:>8}")
