# Debug Report — 2026-03-24 Session

## CRITICAL BUGS (actively causing losses)

### 1. Apex supplemental hedge orders become orphans
**What:** When late anchor fills require more hedge contracts than the original order, a supplemental order is placed. These supplemental orders are NOT in the order group, so when completion runs `cancel_order_group()`, they're missed. They sit on Kalshi as resting orders forever.
**Where:** `_handle_late_anchor_fill()` around line 6530 — `_extra_oid` is added to `_all_hedge_order_ids` and `_all_placed_order_ids` but NOT to the order group.
**Fix needed:** Either add supplemental orders to the order group, or ensure `_execute_apex_completion()` Phase 2 cancels ALL orders in `_all_placed_order_ids` individually (not just rely on group cancel).
**Evidence:** `APEX_PRE_CANCEL_HEDGE_AUDIT` shows supplemental orders with status "resting" after completion. 3 orphans found on BKN/POR spread.

### 2. Apex loss-exit / bid-drift selling back immediately on run 2
**What:** Run 2 posts, all anchors fill quickly, hedge is placed at 35-36¢. But bid has drifted to 56¢ — the `APEX_BID_DRIFT_EXIT` fires immediately (gap=21¢, threshold=10¢ for late urgency). The bot sells back 24 contracts at a 334¢ loss. The hedge never had a chance to fill.
**Where:** Bid-drift exit at line ~11829 fires based on `hedge_price` vs current bid. But the hedge was JUST placed and hasn't walked yet. The drift check shouldn't fire on a freshly placed hedge.
**Fix needed:** Add a grace period — don't check bid-drift until the hedge has been alive for at least N seconds (maybe 30s). The hedge needs time to walk/fill before being evaluated for drift exit.
**Evidence:** `APEX_BID_DRIFT_EXIT hedge_price=35 bid=56 gap=21 threshold=10 urgency=late` fired immediately after hedge placement.

### 3. Apex hedge amend returns 400 Bad Request
**What:** Late anchor amend fails with `400 Bad Request`. The amend_order call is being sent but Kalshi rejects it.
**Where:** `_handle_late_anchor_fill()` around line 6468. The amend call succeeds on some but fails on others.
**Possible cause:** The amend may be trying to change the price AND the count simultaneously, or there's a parameter mismatch. Need to log the FULL request body and response body to debug.
**Evidence:** `APEX_LATE_ANCHOR_AMEND_FAIL: 400 Client Error: Bad Request`

### 4. Apex ceiling (96¢) not fully enforced
**What:** User set ceiling to 96¢ but trades completed at 98¢ combined. The ceiling was only applied in some code paths but not all.
**Where:** Multiple places in the walk/snap logic still referenced global `HARD_CEILING_CENTS` instead of `bot.get('hard_ceiling')`. Fixed in 2 places but there may be more — the snap check `_apex_snap_check()` and the initial sweep hedge placement both need audit.
**Fix needed:** Search for ALL references to `HARD_CEILING_CENTS` in Apex code paths and replace with per-bot ceiling. Also update `_apex_snap_check()` to accept ceiling as parameter.

### 5. Apex double completion trigger (partially fixed)
**What:** `APEX_MONITOR_COMPLETION_TRIGGER` fires 2-3 times within seconds. The guard `_completion_repeat_processed` was added but the timing of when guards are reset vs when the second trigger fires is still fragile.
**Where:** `_execute_apex_completion()` line ~7260 and the monitor loop completion check.
**Current state:** Guard added, guards NOT reset until new orders post. May be working now but needs verification.

## DISPLAY BUGS

### 6. Apex bot card shows +0¢ on profitable completions
**What:** The P&L display on the bot card shows +0¢ or +0.00 even when the trade was profitable.
**Where:** Frontend bot card rendering — may be reading stale `cumulative_pnl` or the P&L isn't being updated correctly on the bot object after completion.

### 7. Apex sellbacks not showing in trade log
**What:** When Apex sells back, the trade doesn't appear in the Apex history tab.
**Where:** Frontend history filtering — check if `apex_sellback` result type is included in the Apex tab filter.

### 8. Phantom rung display shows filled rung as shaded/unfilled
**What:** BKN/POR phantom — all 3 rungs filled (30¢ 1/1, 28¢ 2/2, 26¢ 3/3) but the UI showed rung 0 (30¢) as unfilled/shaded.
**Where:** Frontend phantom card rung rendering — likely checking wrong fill field or auto-scale qty mismatch.

### 9. Apex shows "combined 98¢" when ceiling is 96¢
**What:** The AT CEILING display and trade records show 98¢ combined even when the bot's ceiling was set to 96¢. The frontend `atCeiling` check was updated but the trade record may still log the wrong combined value.

## ARCHITECTURE ISSUES

### 10. Supplemental hedge orders not managed properly
**What:** When Kalshi can't increase order count via amend, we place supplemental orders. But these create a multi-order hedge situation that the walk/snap/completion code wasn't designed for. The walk code only walks ONE hedge order (the current `hedge_order_id`). Supplemental orders don't get walked.
**Fix needed:** Either walk ALL hedge orders, or cancel supplemental orders when the primary hedge fills (since they'd be redundant via auto-netting).

### 11. Multiple `repeat_count = 0` kill points
**What:** Several code paths set `repeat_count = 0` which permanently kills all future repeats. The user expects repeats to survive temporary conditions (drift, dead market, etc.).
**Where found and fixed:** Dead market guard (phantom), drift guard (Apex repeat handler). But there may be more — search for `repeat_count.*= 0` and verify each one.

### 12. Kalshi amend API limitations not fully accounted for
**What:** Amend can only decrease count, not increase. Amend can also return 400 for various reasons (order partially filled, timing race). The code doesn't handle all failure modes.
**Key rule:** `count` parameter in amend = keep same or decrease. For increases, place NEW supplemental order. Always verify amend response.

## URGENT: REVERT SUPPLEMENTAL HEDGE SYSTEM

The supplemental hedge approach (placing extra orders instead of amending count up) was based on a misreading of Kalshi docs. **The amend WAS working before this session** — 54 wins tonight all used amend-to-increase-count successfully. The `/decrease` endpoint doc saying "only kind of edit available on quantity" likely refers to that specific endpoint, NOT the `/amend` endpoint which does cancel+replace.

**Revert these changes:**
- `_handle_late_anchor_fill()` — go back to `count=total_qty` in amend call (was working)
- Remove all `_need_extra` / supplemental order logic in Apex
- Remove `APEX_LATE_ANCHOR_EXTRA_HEDGE` code path
- Remove `_extra_hedge_placed` tracking
- The WS handler extra hedge generation code (line ~3416) should also be removed

**The 18→24 amend failure from the GSW bot earlier:** The log showed `APEX_LATE_ANCHOR_AMEND` (success, no error) but the hedge only filled 18. The amend may have succeeded on Kalshi's side but the order was already in the process of filling. OR the amend response was 200 but Kalshi didn't actually increase the count. We never checked the amend response body to verify.

**INVESTIGATE:** Were we getting 400 errors on amend-to-increase BEFORE this session? Check older activity logs for `APEX_LATE_ANCHOR_AMEND_FAIL` events from before 2026-03-24. If no failures existed before, the amend-to-increase was working fine and the whole supplemental system was unnecessary. If there WERE failures, then we need a proper fix (not supplemental orders — maybe retry with verification).

## WHAT WAS FIXED THIS SESSION (verify still working)
- Phantom 2¢ retreat (removed velocity check, simple depth gap check)
- Phantom above-market repost (detects first_rung >= bid)
- Phantom dead market preserves repeats
- Phantom orphan root cause (stash old order IDs from reposts)
- Phantom straggler sellback (sell back late fills instead of supplemental hedge)
- Phantom precalc covers every partial fill qty
- Apex quality score 0-100 on ghost recommendations
- Apex ceiling slider 96-98¢
- Apex loss-exit amend fixed (was missing required params)
- Orderbook depth → quality score update
- Phantom quality score with dog-side thickness penalty
- AT CEILING display with sell-back timer
- Icon overlap fix
- Same/cross market badge in phantom history
- Auto-purge stale bots from active_bots
- `_cancel_with_retry` treats 404 as success
- Repeat off-by-one fixed (`<=` instead of `<`) in all 9 locations
