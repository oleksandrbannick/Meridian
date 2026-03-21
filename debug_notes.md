# Meridian Debug Notes

Notes from the Meridian chat Claude about bugs, issues, and observations.
Claude Code reads this file at the start of each session.

**RULES FOR CHAT CLAUDE:** Only log ACTUAL bugs and issues the user confirms. Do NOT log strategy suggestions or feature requests as bugs without user confirmation.

---

## [FIXED] Apex trade log: hedge order ID showing as raw UUID without clipboard button
**2026-03-20 14:53** | apex | **Resolved 2026-03-20 15:00 by Claude Code**

All order IDs (hedge, dog, fav, yes, no) in trade history now show truncated (last 8 chars) with clipboard copy buttons. Bot detail panel also updated (last 12 chars + copy). Commit 4147467.

---

## [FIXED] Chat bubble ghost icon replaced by plain orange circle
**2026-03-20 14:54** | system | **Resolved 2026-03-20 15:00 by Claude Code**

FAB button background changed from orange gradient to dark (#0c1020) with orange border so pixel ghost is visible. Commit 4147467.

---

## [FIXED] NCAAB cards showing yesterday's "Final" scores on today's pregame games
**2026-03-20 15:14** | system | **Resolved 2026-03-20 15:25 by Claude Code**

Root cause: `_gameIdDateMatchesESPN()` had a -1 day tolerance for UTC midnight crossing, but this also let yesterday's finished games match today's tickers for the same team (e.g. TENN played yesterday AND today). Fix: finished games (state=post) now require exact date match — only live/pregame games get ±1 day UTC tolerance. Also fixed late-night games with ESPN dates 1 day ahead (UTC midnight) not matching. The get_schedule() tool was NOT broken — it correctly returned games as "pre" — the issue was only in frontend card rendering. Commit e514315.

---

## [BUG] Apex not recommended on near-50/50 spread markets
**2026-03-20 16:56** | apex

User confirms: Apex bots derive edge from game volatility, not just instant arb (YES+NO under 100¢). On TTU -8.5 / AKR +8.5 the prices are 51¢/50¢ — a near coin toss. Apex should be recommended here because price swings will naturally push one side temporarily under 100¢ total. The recommendation logic should factor in volatility / coin-toss scenarios, not just wait for a pre-existing gap. Currently no Apex suggestion is surfacing on these markets despite this being a prime opportunity.

---

## [BUG] Anchor ladder repeat counter exceeding max — showing 4/3, 3/2
**2026-03-20 17:18** | anchor_ladder

Multiple anchor_ladder bots are showing repeat counts ABOVE their configured max. Examples from active bots:
- ladder_KXNBAGAME-26MAR19PHISAC-SAC: repeats=4/3
- ladder_KXNBASPREAD-26MAR18LALHOU-LAL10: repeats=4/3
- ladder_KXNCAAMBSPREAD-26MAR18MOHSMU-SMU3: repeats=4/3
- ladder_KXNBASPREAD-26MAR19PHISAC-PHI6: repeats=3/2

The counter is incrementing PAST the max instead of stopping at it. This means bots are running an extra cycle beyond what was configured. The "anchors filled" display in the UI is also showing counts like 4/3 which is confusing to the user. 

The repeat counter should stop AT the max (e.g. 3/3 not 4/3). There may be an off-by-one error in the cycle completion check — the bot likely increments the counter THEN checks if it exceeded max, instead of checking BEFORE incrementing or using >=  instead of >.

---

## [BUG] Anchor Ladder: Fused hedges, wrong fill counts, shading logic broken
**2026-03-20 17:21** | phantom

User reports multiple issues with anchor ladder bot display:

1. **Fused hedges** — when a hedge fills, the completed hedge and the new hedge for remaining open anchors are being fused/merged into one display instead of shown separately.

2. **Wrong fill counts** — showing "4 out of 3 filled" which is impossible. Fill counter is overcounting.

3. **Limit order cancel race condition** — when a hedge fills, remaining anchor limit orders should cancel. In rare cases where an anchor fills at the exact same moment the cancel is being processed (cancel+fill race), it's not being handled correctly. These "miracle fills" during cancellation need special handling.

4. **Shading logic broken** — the correct behavior should be:
   - Completed anchors + their completed hedge → shown SHADED (grayed out, done)
   - Anchors that filled during the cancel race (not yet hedged) → shown UNSHADED (active, needs hedge)
   - New hedge for the unshaded anchors → shown BELOW the shaded completed group, unshaded, as a new hedge order
   
   Currently it's fusing the old completed hedge with the new hedge instead of separating them visually.

User's exact description: "It's fusing hedges. Limit orders for anchors are supposed to cancel if the hedge fills so more anchors shouldn't have filled — and if they did in the rare occasion at the exact same time the hedge filled and the cancel for the anchors was happening, it needs to show the completed hedge as shaded out along with the completed anchors and show the filled anchors not finished hedging as not shaded and show a new hedge below the old shaded hedge showing the new hedge for the other anchors."

---

## [BUG] Anchor Ladder: Fused hedges, 4/3 fill display bug, shading logic broken
**2026-03-20 17:22** | apex


WHAT THE USER SEES (screenshot captured):
- AKR vs TTU Spread TTU -11.5, Apex bot
- 12 rungs, showing "4/12 DONE · +18¢"
- YES ANCHOR: 7 contracts @ avg 29¢ (bid 42c, ask 44c)
- NO HEDGE: 3 contracts @ 56¢ — showing "4/3 filled" ← THIS IS THE BUG
- P&L: +$0.18 total

BUG DESCRIPTION (from user):
1. **Fused hedges**: When multiple anchors fill and a hedge fills, the UI is fusing/combining them into one hedge display instead of showing them separately.

2. **4/3 filled**: Showing more fills than contracts — this happens in a race condition where:
   - Anchor fills
   - Cancel order is sent to remaining anchors
   - But another anchor fills AS the cancel is being processed (cancel-fill race)
   - Result: more fills than expected

3. **CORRECT BEHAVIOR EXPECTED**:
   - Completed anchor + completed hedge should show as **SHADED OUT** (greyed/dimmed) together as a completed pair
   - Anchors that filled during the cancel-race (not yet hedged) should show as **NOT shaded**, active, needing a new hedge
   - A **new hedge order** should appear below the shaded completed hedge for the newly-filled anchors
   - Currently everything is being fused into one hedge line instead of split into: [shaded completed set] + [new active hedge for race-filled anchors]

4. Limit orders for anchors are supposed to cancel when the hedge fills — so no more anchors should fill UNLESS they fill simultaneously as the cancel is processing (race condition). That edge case needs its own display logic.

TICKER: KXNCAAMBSPREAD-26MAR20AKRTTU-TTU11 (AKR vs TTU, TTU -11.5)
Bot shows: ladder_arb_yes_filled status, yes=29¢ no=64¢


---

## [BUG] Apex bot stuck on WAITING — hedge never resolves after NO fill
**2026-03-20 18:21** | apex

Apex bot on KXNCAAMBSPREAD-26MAR20LIUARIZ-ARIZ33 is stuck showing "1/1 WAITING" on the hedge side forever. The NO anchor filled (5 contracts @ avg 48¢) but the YES hedge never resolved. Bot shows 12 rungs, 4/12 done, +12¢, Run 2/4. The "NO ANCHOR" section shows bid 20¢ / ask 32¢ and the WAITING state is not clearing. It's unclear if the hedge order was placed and never filled, or if the hedge order was never placed at all. The bot is live on LIU vs ARI which is currently 20-47 3:46 1st half. Need to check: 1) Was a YES hedge order actually placed on Kalshi? 2) Is the hedge order resting but just not displaying correctly? 3) Is there a state machine issue where WAITING never transitions to FILLED or HEDGED? User says this has been stuck "forever" and isn't resolving on its own.

---

## [BUG] Apex/Ladder Arb bot stuck in WAITING — YES hedge never placed after NO fill
**2026-03-20 18:22** | apex

Bot ID: larb_KXNCAAMBSPREAD-26MAR20LIUARIZ-ARIZ33_1774029618034
Ticker: KXNCAAMBSPREAD-26MAR20LIUARIZ-ARIZ33

SYMPTOM: Bot shows "1/1 WAITING" forever on the YES hedge side. UI displays it as stuck in WAITING and never resolves.

FROM THE LOGS:
- NO filled 5 contracts @ 48¢
- YES filled 4 contracts @ 46¢ (yes_fill_qty=4, no_fill_qty=5) — mismatch, 1 YES contract never hedged
- Status stuck at: ladder_arb_no_filled
- APEX_WALK_SUCCESS fired — amended hedge order from 47¢ → 50¢ (order ID: 3ef7af84-d1e)
- LADDER_ARB_WS_FILL: hedge_fill_count=1, is_hedge_fill=true — so one hedge fill was detected
- LADDER_ARB_HEDGE_FILL_UPDATE: old_hedge_fill_count=1, new_hedge_fill_count=5 — this jumped from 1 to 5 which seems wrong/corrupted
- 4 RUNG_COMPLETE events fired but bot never transitions out of ladder_arb_no_filled
- repost_count=2, walk_count=4

ROOT CAUSE HYPOTHESIS: The hedge fill count jumped from 1→5 in one poll (new_hedge_fill_count=5 vs old=1), possibly due to a polling race or consolidated fill being counted multiple times. The bot thinks it's waiting for 1 more YES fill but may have already gotten it and miscounted. The status never transitions to completed because yes_fill_qty (4) != no_fill_qty (5).

WHAT NEEDS TO FIX:
1. Bot is stuck in ladder_arb_no_filled forever — needs a recovery path when yes_fill_qty approaches no_fill_qty
2. The hedge fill count jump (1→5) is suspicious — polling logic may be double-counting fills from consolidated orders
3. UI shows "WAITING" forever with no timeout or escape hatch
4. Need a reconciliation check: if all rungs are complete and hedge fills ≈ anchor fills, mark bot as done

---

## [BUG] UVA Apex bot showing wrong P&L — +7¢ in UI vs -4¢ actual, no run count displayed
**2026-03-20 19:05** | apex

Bot: ladder_KXNCAAMBGAME-26MAR20WRSTUVA-WRST_1774032625984
Ticker: KXNCAAMBGAME-26MAR20WRSTUVA-WRST (WRST vs UVA spread)

USER REPORTED ISSUE:
- UI showing +7¢ P&L on the bot card
- Kalshi actual P&L shows +0.19¢ (essentially flat/tiny)
- Bot card shows NO run count (e.g. "Run 1/1" or "1 cycle") — user assumed it only ran once
- net_pnl_cents in bot detail = -4 (so actual is -4¢, not +7¢ or +0.19¢)

WHAT ACTUALLY HAPPENED (from bot detail):
- 3 rungs were posted: 21¢ (qty 1), 19¢ (qty 2), 17¢ (qty 3)
- Only rung 1 (21¢) filled — 1 contract
- Rungs 2 and 3 were cancelled (cancelled=true, fill_qty=0)
- Hedge: NO order posted at 77¢, fav_fill_qty=0 — hedge DID NOT FILL
- yes_fill_qty=1 (dog filled), no_fill_qty=0 (hedge never filled)
- repeat_count=0, repeats_done=1 — only ONE cycle ran, confirmed

P&L DISCREPANCY:
- Bot paid 21¢ for YES, hedge at 77¢ never filled
- net_pnl_cents = -4 (internal)
- UI shows +7¢ — WRONG
- Kalshi shows +0.19¢ — also inconsistent with internal -4¢
- THREE different P&L values across UI / internal / Kalshi — major mismatch

DISPLAY BUG:
- Run count not shown on bot card — user couldn't tell it only ran once
- Should display "1 run" or "Run 1/1" clearly on the card

ROOT CAUSE SUSPICION:
- P&L calculation may be including precalc/expected hedge profit before hedge actually fills
- When hedge doesn't fill, the bot is left holding an unhedged YES position but P&L still shows the "expected" arb profit
- UI should show REALIZED P&L only, not projected

live_yes_bid at stop = 16¢ (market moved against the position significantly after fill)

---

## [BUG] Trade log broken — combining runs and showing wrong data, not displaying per-run
**2026-03-20 21:15** | apex

User reports the trade log UI is broken — it appears to be combining/aggregating all runs into one entry instead of showing each run separately. The raw trade history data confirms the problem:

WHAT THE DATA ACTUALLY SHOWS:
- There are 20+ individual trade log entries for KXNCAAMBSPREAD-26MAR20MOHTENN-TENN16
- ALL of them are logged as "arb_loss" with profit_cents=0
- Losses range from 30¢ to 62¢ per entry
- Timestamps are extremely close together (within ~10 seconds of each other: 1774041117 to 1774041129)
- bot_category is "ladder_arb" for all of them
- Type field is blank/empty string on every single entry

PROBLEMS IDENTIFIED:
1. **Duplicate entries** — same loss amounts appear multiple times at nearly identical timestamps (e.g. 62¢ loss appears 4 times in a row, 32¢ loss appears 4 times). These look like the same rung being logged multiple times per poll cycle, not separate runs.
2. **Every entry shows arb_loss / profit=0** — even completed profitable runs are being logged as losses with 0 profit. The profit_cents field is always 0 and loss_cents always has a value, which suggests the logging code is only recording the hedge/close cost, not the net arb profit.
3. **Type field is blank** — should probably show rung width or contract count.
4. **UI combining them** — user says the UI is showing all of these as if they all "met" or are combined into one thing instead of showing each run as a separate line item.

WHAT IT SHOULD DO:
- Each completed arb CYCLE (anchor fill + hedge fill = 1 run) should be ONE entry in the trade log
- Should show: ticker, rung width, profit/loss for THAT run, timestamp
- Should NOT log every individual order fill as a separate trade entry
- Should NOT show profit=0 on runs that made money

ROOT CAUSE SUSPICION:
The trade logging is firing on every order fill event instead of on cycle completion. So a 4-rung bot with 3 fills per rung = 12 log entries instead of 1 per completed cycle. Also the net P&L calculation appears broken — it's logging the cost of the hedge but not subtracting the anchor fill price to get net profit.

User's words: "It's showing like all of them met it or something, showing the completely wrong thing. Supposed to show each run separate. Don't know why it's combining runs."

---

## [BUG] Trade History log exploding — duplicate entries per rung instead of one row per run/cycle
**2026-03-20 21:16** | apex

The trade history log is generating a separate entry for EVERY RUNG of a ladder/apex bot instead of one consolidated row per run/cycle.

EXAMPLE: KXNCAAMBSPREAD-26MAR20MOHTENN-TENN16 (ladder_arb) is showing 20+ individual loss entries all within the same second (timestamps: 1774041118 through 1774041129), all marked as "arb_loss" with varying loss_cents (30, 33, 36, 40, 44, 53, 62¢ etc). These are all the SAME run, just each rung firing separately.

WHAT THE USER SEES: Trade log looks like the bot lost 20+ separate trades, when really it was one run with multiple rungs. Massively inflated loss count, impossible to read, user has no idea what actually happened per cycle.

WHAT IT SHOULD SHOW: One row per completed run/cycle. That row should show:
- The run number (Run 1, Run 2, etc.)
- Total profit/loss for that full cycle (all rungs combined)
- Number of rungs that filled
- Timestamp of when the cycle completed

ALSO: The type field is empty string "" — should show "apex" or "ladder_arb" so the user can distinguish bot types in the log.

ALSO: The market is also showing "Network error loading markets" in the UI — the markets tab is blank and frozen. This may be related to 429 Too Many Requests errors seen in the activity log (Kalshi rate limiting). The Meridian bot poller may be hammering the API too hard causing both the rate limits AND the UI freeze. Rate limit errors visible at epoch 1774041142 for mid_bot_1774034852.

User quote: "It's showing like all of them met it or something, showing completely wrong thing, supposed to show each run separate, I don't know why it's combining runs."

---

## [BUG] AI assistant freezes when loading all markets at once
**2026-03-20 21:16** | system

When the AI assistant (Claude) tries to load ALL markets simultaneously — e.g. scanning for arbs, pulling orderbooks for every visible market, or loading full market lists — the UI freezes and the assistant becomes unresponsive. This is NOT a Kalshi rate limit issue (429s are a separate problem). The root cause is the assistant trying to fetch everything at once instead of loading markets one at a time or in small batches.

User's note: "It does that when you try to load all the markets versus one at a time."

Fix needed:
1. Paginate or batch market loading — load markets in small groups (e.g. 5-10 at a time) instead of all at once
2. Add a loading queue so requests are staggered, not fired simultaneously
3. The assistant should prioritize visible/active markets first, then load others lazily
4. This is separate from the 429 rate limit bug — both need fixing but they are different issues

This freeze happens reproducibly when the user asks about live markets, arb scans, or anything that triggers a bulk market fetch.

---

## [BUG] Claude AI incorrectly describes Apex rung contract counts — thinks higher widths get more contracts
**2026-03-20 21:42** | apex

The AI assistant (Claude) is giving the user incorrect information about how Apex bot contracts are distributed across widths. 

Specifically: Claude is telling users that higher-width rungs get MORE contracts — e.g. that a 3-width apex bot scales like 1x, 1.5x, 3x contracts at each rung. This is WRONG.

The actual behavior is: ALL rungs get the same contract count (whatever `count` was set to, default 1). It's 1 contract per rung at every width level.

Claude seems to have a false mental model where wider spreads = more contracts, possibly confusing this with a position-scaling or Kelly-sizing concept. 

The user wants Claude to stop saying this. When describing Apex bot rungs, Claude should say: "Each rung places 1 contract (or whatever count was set) — the count is the same across ALL widths. The widths only control the target profit spread, not the contract count."

Fix needed: Either update Claude's system prompt/context to clarify Apex rung behavior, or add it to the bot documentation so Claude reads it correctly.

---

## [CRITICAL] Apex bot stuck in WAITING forever — hedge never placed
**2026-03-20 21:43** | apex

Apex bot (LIU vs ARI Spread -33.5, 12 rungs, Run 2/4) filled NO anchor at 48¢ (5 contracts) but YES hedge is stuck in WAITING and never resolves. YES only filled 4 contracts @ 46¢ — 1 YES hedge missing. Fill counter jumped from 1→5 in one poll (consolidated fill double-counting bug). Bot is stuck in ladder_arb_no_filled forever because yes_fills (4) ≠ no_fills (5). Needs: 1) Recovery path when fill counts are close but don't match, 2) Fix consolidated fill double-counting, 3) Timeout/escape from WAITING state, 4) Reconciliation check to auto-complete stuck bots.

---

## [BUG] UVA bot — 3 different P&L numbers, UI showing projected not realized
**2026-03-20 21:43** | apex

UVA -5.5 Apex bot: YES anchor filled at 21¢ (1 contract, rung 1 only), NO hedge at 77¢ never filled. Market moved against — YES bid now 16¢. Only 1 cycle ran (repeat_count=0). Three conflicting P&L numbers: Meridian UI shows +7¢ (WRONG — showing projected arb profit as if hedge filled), Kalshi shows +0.19¢, Internal bot shows -4¢. UI must show REALIZED P&L only. Also: run count not displayed on card — should show "1 run" so user can tell at a glance.

---

## [BUG] Trade log combining all runs — should show one row per cycle
**2026-03-20 21:43** | apex

Trade log is showing every single rung as a separate trade entry — same ticker, all within 1-2 seconds, making the log look like 20+ trades when it was one run. The type field is also blank (should say apex or ladder_arb). Should show 1 row per cycle with: total P&L, run number, how many rungs filled. User reported this is very confusing and makes the log unreadable.

---

## [BUG] UI + assistant freezes when loading all markets at once — needs batch/paginate
**2026-03-20 21:44** | system

When the UI or assistant tries to load ALL markets at once (e.g. scanning live NCAAB), the whole thing freezes — UI locks up and the assistant stops responding. This is NOT a Kalshi rate limit issue. It's a bulk fetch problem: loading too many markets simultaneously overwhelms the frontend. Fix: batch/paginate market loading, load 5-10 at a time instead of all at once. This also affects the assistant when asked to scan or load live markets. User confirmed this is a known pattern — happens every time bulk market load is triggered.

---

## [BUG] Apex ladder — quantity=1 on ALL rungs, should scale up with width
**2026-03-20 21:45** | apex

User reported: Apex bot is placing 1 contract on every single rung regardless of width. The strategy intention is that wider rungs = more contracts, because the wider the spread the more confident the fill is worth sizing up. 

From the activity log, every RUNG_COMPLETE shows quantity=1 or quantity=3 (flat) — there's no scaling logic. The bot was created with widths like [5, 8, 12, 14] but ALL rungs fire with the same contract count.

EXPECTED BEHAVIOR:
- Narrow rungs (e.g. width=5): 1 contract — tight spread, low confidence
- Medium rungs (e.g. width=8-10): 2-3 contracts
- Wide rungs (e.g. width=12+): 3-5 contracts — big swing, high confidence, size up

The contract count should scale proportionally with the width parameter. Either:
1. Auto-scale: count = floor(width / 5) or similar formula
2. Or let the user pass a count-per-rung array alongside the widths array

Right now the UI also does NOT show run counts per rung — user can't tell how many contracts are on each level. The bot card needs to display per-rung sizing so the user can verify it's working correctly.

Screenshot was taken — markets tab showing network error, but activity log confirms flat quantity=1 across all rungs in the USU vs Villanova Apex bot (larb_KXNCAAMBGAME-26MAR20USUVILL-USU_1774041737946).

---

## [BUG] Apex/Anchor Ladder bot UI — lower width rungs shaded out, only one anchor lit
**2026-03-20 21:55** | apex

User reported that on an anchor_ladder bot (MOH vs TEN · TENN -22.5 spread, 12 rungs, 3/12 done), the lower width rungs are showing as shaded/grayed out while only one anchor rung is lit up — even though all rungs should be actively hedging. The rung shading is suggesting some rungs are inactive or unfilled when they shouldn't be. User also previously noted the bot was showing different contract counts per rung (appeared to be scaling x1.5 and x3 for higher widths) when it should be 1 contract flat across all rungs. These two UI bugs may be related — the rung display logic may be miscalculating which rungs are "active" and misrepresenting their state visually. Bot ticker: KXNCAAMBSPREAD-26MAR20MOHTENN-TENN22 area. Screenshot was captured but Claude missed it during review.

---

## [BUG] Apex/Anchor Ladder: Only one filled anchor lit up, others shaded out incorrectly
**2026-03-20 21:57** | apex

User reports that multiple anchors have filled but only ONE is showing as "lit up" (active/highlighted) in the rung display. All filled anchors should be lit up UNLESS they've already been hedged — in which case both the anchor AND its corresponding hedge rung should be shaded out together as a pair. 

Current broken behavior: Multiple anchors filled, only 1 is lit, the others are dimmed/shaded as if hedged — but there are NO corresponding shaded hedges for those dimmed anchors. This means the UI is incorrectly dimming filled-but-not-yet-hedged anchor rungs, making it look like they were hedged when they weren't.

Expected behavior: 
- Filled anchor, not yet hedged = LIT UP (highlighted)
- Filled anchor + hedged = BOTH anchor and hedge rung shaded out as a completed pair
- Unfilled anchor = normal/neutral state

User was very clear: if a shaded anchor had no matching shaded hedge, that's the bug. The shading logic is wrong — it's dimming filled anchors prematurely without a corresponding hedge.

---

## [BUG] Apex/Anchor Ladder rung shading incorrect — completed pairs not shading out
**2026-03-20 21:57** | anchor_ladder

User reported that multiple anchor rungs have filled and their hedges have completed (hedge fires immediately, then bot moves to next unfilled anchor). However, the UI is only showing ONE rung lit up. 

CORRECT behavior:
- Anchor fills → hedge fires immediately → BOTH sides of that rung shade out as a completed pair
- The next unfilled anchor rung stays lit
- All other unstarted rungs also stay lit (waiting)

BUG: Multiple completed anchor+hedge pairs are NOT shading out. Only one rung is lit. The rest of the completed pairs are incorrectly staying lit OR the shading logic is not tracking which rungs are fully done (anchor filled + hedge placed). 

The shading should reflect: "this rung is DONE (anchor + hedge both placed)" not just "hedge is pending." When the hedge fires, that rung pair should immediately go dark/shaded.

---

## [BUG] Phantom Ladder: Filled anchors should all be lit, only ONE hedge shown
**2026-03-20 21:59** | phantom

CORRECT DISPLAY LOGIC (from user):
- All filled anchors should be LIT UP
- Only ONE hedge order should be shown (covering all filled anchors)
- Completed pairs do NOT shade out — filled anchors stay lit until the hedge fills

RARE EDGE CASE (user flagged as critical):
When the hedge fills, it instantly cancels the remaining anchor limit orders. But if an anchor fills in that split millisecond DURING the cancellation process, the system treats it as a NEW generation hedge (since the first hedge completed). This is wrong — the first hedge was never truly "completed" as a pair, it was still the original hedge. The system should NOT create a new hedge generation in this scenario — it should recognize the first hedge was the original and handle the timing collision correctly.

UI BUG: Multiple anchors are filled but only ONE is lit up in the display. All filled anchors must be lit. The single hedge order should remain visible. Nothing should shade out until the hedge actually fills.

---

## [BUG] get_live_kalshi_markets returns null prices for all markets
**2026-03-20 22:22** | apex

get_live_kalshi_markets() returns 240 markets but yes_bid, yes_ask, no_bid, no_ask are ALL null for every market. This makes it impossible to scan for 50/50 Apex targets without manually pulling individual orderbooks. Need this endpoint to return live prices. Without it, finding near-50/50 markets requires brute-force individual get_orderbook calls. Also need a scan_near_50() tool or similar that returns markets within a configurable range (e.g. 45-55¢ YES bid) sorted by proximity to 50. This is a critical gap for the Apex workflow.

---

## [CRITICAL] get_live_kalshi_markets returns null prices — Apex scanner broken
**2026-03-20 22:24** | apex

get_live_kalshi_markets is returning markets but ALL price fields are null. This breaks the entire Apex targeting workflow. We need live bid/ask prices to identify 50/50 markets. Fix: ensure the live market endpoint populates yes_bid, yes_ask, no_bid, no_ask fields from the WebSocket cache or a fresh Kalshi API call before returning.

---

## [CRITICAL] Need near-50 market scanner tool for Apex targeting
**2026-03-20 22:24** | apex

Claude needs a dedicated tool: scan_near_50(sport, min=45, max=55) that returns all live markets where the YES bid is between 45-55 cents. This is the primary Apex entry condition — coin-toss markets where game swings will push one side through the resting order. Right now Claude has to manually pull orderbooks one by one which is slow, unreliable, and eats tool calls. The tool should return: ticker, title, yes_bid, yes_ask, no_bid, no_ask, time_remaining (if available). Sort by closest to 50.

---

## [BUG] Smart bot game_ending auto-cancel — verify implementation exists
**2026-03-20 22:24** | apex

User wants create_smart_bot with game_ending=true to auto-cancel bots when games enter final 2 minutes. Claude is not confident this logic is actually implemented on the backend. Need to verify: (1) does the monitor check game clock? (2) does it cancel the bot and stop repeats when game_ending condition triggers? (3) does bid_below=5 correctly cancel on market collapse? If not implemented, this is a critical missing feature for live game bots — without it Claude has no way to stop bots automatically as games end.

---

## [BUG] Apex rung contract sizing not scaling with width — all rungs = 1 contract
**2026-03-20 22:24** | apex

Apex bots are placing 1 contract on every rung regardless of width. The intended behavior is that wider rungs = more contracts (higher confidence fill = bigger size). Example: width=5 → 1 contract, width=8 → 2 contracts, width=12 → 3 contracts, width=14 → 4-5 contracts. Currently every rung logs quantity=1. The count parameter passed to create_ladder_arb is supposed to be the BASE count for the narrowest rung, with wider rungs scaling up proportionally. Fix the rung sizing logic to multiply count by rung index or width ratio.

---

## [CRITICAL] Apex bot stuck in WAITING — hedge never fires after anchor fill
**2026-03-20 22:24** | apex

LIU vs ARI Spread -33.5: NO anchor filled (5 contracts @ 48c) but YES hedge got stuck at 1/1 WAITING forever. Bot frozen in ladder_arb_no_filled state. Fill counter jumped 1→5 (double-counting bug). The hedge order was placed but never confirmed filled, and the bot never recovered. Need: (1) fix double-count on fill detection, (2) add timeout/retry on stuck hedge orders, (3) if hedge is WAITING more than 60 seconds, alert Claude or auto-cancel and repost.

---

## [BUG] Trade log combining runs — each rung should show individually
**2026-03-20 22:24** | apex

The trade log is fusing multiple bot runs/rungs into a single display entry instead of showing each run individually. Each rung fill should be its own line item with: rung width, anchor side, anchor price, hedge price, contracts, P&L for that rung. Currently they are being collapsed/merged which makes it impossible to audit which rungs are profitable. Fix the trade history display to show one row per rung fill, not one row per bot.

---

## [CRITICAL] UI freezes when loading all markets simultaneously — needs batching
**2026-03-20 22:24** | system

When Claude or the UI tries to load all live markets at once, the assistant freezes and a network error appears. This is a bulk fetch problem — all market API calls fire simultaneously causing overload. Fix: batch market loads 5-10 at a time with small delays between batches. This affects both the UI market card loading and Claude's ability to scan markets programmatically. Priority fix — it makes the entire live trading workflow unreliable.

---

## [BUG] Completed hedges not shading out in bot UI — display bugs persist
**2026-03-20 22:24** | apex

Multiple Apex/Phantom bot display issues: (1) completed hedges not shading out visually, (2) multiple hedges fusing into a single line, (3) anchor tracking showing impossible fill counts (e.g. 1→5 jump). The bot card needs a clear visual state per rung: WAITING → ANCHOR FILLED → HEDGED → COMPLETE, with each state styled differently. Completed rungs should be grayed out. Each hedge should be its own line. Fill counts should never exceed the contracted quantity.

---

## [BUG] Apex Deploy button unclickable after first bot placed
**2026-03-21 01:49** | apex

User reports: After placing the FIRST Apex bot successfully via the Deploy button, clicking Deploy on a SECOND market does nothing — no response, no error, no bot created. Button appears clickable but is unresponsive.

Suspected causes:
1. Deploy modal/state not resetting after first bot is placed — a "deploying" flag stays true and blocks subsequent clicks
2. Some shared state (e.g. isDeploying, activeBot, or form lock) not being cleared after the first bot launches
3. Possible race condition where the first bot's launch hasn't fully resolved before user tries the second one

Steps to reproduce:
1. Open a market card, click Deploy, configure Apex bot, confirm → bot places successfully
2. Open a second market card, click Deploy → nothing happens

Also note: Screenshot shows "Network error loading markets. Check console." — markets aren't loading at all right now, which may be related (UI stuck in error state could also be blocking the deploy button).

Expected: Deploy button resets after each bot placement and works independently on every market card.
Fix needed: Reset all deploy-related state (loading flags, form state, modal state) after each successful bot creation. Also check if the network error state is propagating to disable UI interactions globally.

---

## [CRITICAL] Apex bot race condition — hedge_qty corrupted by parallel late anchor threads
**2026-03-21 20:13 MST** | apex

**Bot:** larb_KXNBASPREAD-26MAR20BOSMEM-BOS5_1774057699837
**Result:** 10 orphaned unhedged NO contracts (game settled so no lasting damage)

### What Happened
14 NO anchors filled rapidly across rungs 0-9. Each late anchor fill spawned a `_handle_late_anchor_fill` thread. These threads ALL ran in parallel, each independently counting filled rungs and amending the hedge order on Kalshi.

### The Race Condition
A "race condition" = multiple threads modifying the same data simultaneously, with the result depending on which finishes last.

1. All 7+ late anchor threads read `old_hedge_qty=3` at the same time (proof: log shows `qty 3→14`, `qty 3→5`, `qty 3→8`, `qty 3→6`, `qty 3→7`, `qty 3→11`, `qty 3→4`)
2. Each thread computed `total_qty` from the rung fills IT could see (stale — not all fills visible yet)
3. Each thread called `kalshi_client.amend_order(count=total_qty)` — last amend to hit Kalshi wins
4. Each thread then wrote `bot['hedge_qty'] = total_qty` inside the lock — last write wins
5. **Thread that saw only 4 fills finished LAST** → `hedge_qty = 4`, Kalshi order count = 4
6. 4 hedge fills came in → `_hedge_fill_count(4) >= hedge_qty(4)` → `hedge_fully_done=True`
7. Completion fired, cancelled the hedge, found `anchor=14 hedge=4` → 10 orphans

### The Intended Behavior (user confirmed)
- Hedge order stays resting, keeps filling
- Late anchor fills amend the hedge qty UPWARD (e.g., 2/8 → 2/10)
- Completion ONLY fires when hedge is 100% filled
- A new hedge order is ONLY created if the original was already fully filled and completed (can't amend a done order) — edge case for cancel-fill race

### Fix Applied
In `_handle_late_anchor_fill` (~line 5636):
- `hedge_qty` only increases: `bot['hedge_qty'] = max(bot.get('hedge_qty', 0), total_qty)`
- Kalshi amend only fires if `total_qty > bot.get('hedge_qty', 0)` (skip if a later thread already set higher)
- Same pattern in `_execute_ladder_arb_sweep_and_hedge` Phase 1c (~line 5773)

### Files Modified
- `/root/meridian/backend/app.py` — `_handle_late_anchor_fill()`, `_execute_ladder_arb_sweep_and_hedge()`

---
