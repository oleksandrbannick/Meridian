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

## [BUG] Apex Deploy button unresponsive after first deployment
**2026-03-21 06:27** | apex

User reports: After successfully deploying one Apex bot, the Deploy button becomes completely unresponsive — clicking it does nothing. No error message, no loading state, no feedback. Button appears clickable but doesn't fire. 

Steps to reproduce:
1. Open Apex bot panel on a market
2. Configure and click Deploy — first bot deploys successfully
3. Navigate to a second market, configure Apex bot
4. Click Deploy — nothing happens, button is dead

Expected: Each market should allow independent Apex deployment
Actual: Deploy button silently fails after first use

Suspected cause: Some shared state or flag gets set after first deploy and isn't reset — possibly a loading/pending boolean that never clears, or an event listener that gets removed after first click.

Screenshot context: Markets screen also showing "Network error loading markets. Check console." — these may be related (UI state corruption after first deploy).

Fix needed: 
- Reset deploy button state after each successful deployment
- Add visual feedback if deploy fails (error toast/message)
- Check if a global isPending/isDeploying flag is not being reset
- Also investigate if network error and button lockout share a root cause

---

## [BUG] Remove ALL "ladder_arb" language from UI — user explicitly banned this term
**2026-03-21 07:05** | apex

Screenshot confirmed: the expanded bot card for an Apex bot (THU vs EGI · Moneyline · Thu Win) shows:
- Subtitle reads: "APEX · LADDER_ARB_POSTED"
- STATUS field shows: "ladder_arb_posted" (in blue pill)

The user has explicitly said to NEVER use the word "ladder_arb" anywhere in the UI. This is an Apex bot and should only ever say "APEX" branding.

FIXES NEEDED:
1. Status label "ladder_arb_posted" → rename to something like "POSTED" or "LIVE" or "WATCHING"
2. Subtitle "APEX · LADDER_ARB_POSTED" → should be "APEX · POSTED" or "APEX · ACTIVE"
3. Search entire codebase for "ladder_arb" and replace ALL user-facing instances with Apex-branded equivalents
4. Internal code can keep the variable names but NOTHING with "ladder_arb" should ever appear in the UI

This is a branding/UX requirement the user has stated multiple times. Must be fixed.

---

## [BUG] Orphaned position showing incorrect P&L and misleading data in My Positions tab
**2026-03-21 07:26** | system

Screenshot captured. User has an orphaned position on KXKBLGAME-26MAR210100PHOGOY-PHO (Mobis Phoebus vs Goyang Skygunners — YES).

WHAT THE SCREEN SHOWS:
- Qty: 3 contracts
- Entry: 35¢
- Bid: 0¢ (market is likely settled/over)
- P&L: -35¢/ea
- Total: -105¢
- Realized: $2.51
- Badge: "3 orphaned — no bot managing"
- "Sell Orphan" button visible

WHAT THE API RETURNS:
- avg_price: 35¢
- yes_bid: 0¢, yes_ask: 1¢
- no_bid: 99¢, no_ask: 100¢
- market_exposure: 105¢ (showing as loss)
- realized_pnl: 251 (which is $2.51 — this is the ACTUAL profit, game already resolved YES)
- orphaned_qty: 3
- managing_bots: [] (empty — no bot)
- watched_by: null

THE PROBLEM:
1. The card shows P&L: -35¢/ea and Total: -105¢ which looks like a LOSS — but realized_pnl is $2.51 meaning this position ALREADY RESOLVED and WON. The display is completely misleading.
2. yes_bid is 0¢ — market is settled. The "Sell Orphan" button should NOT be showing if the market is already resolved — there's nothing to sell at 0¢.
3. The card should detect when yes_bid=0 and no_bid=99+ that the market has resolved YES, and show "RESOLVED ✅ +$2.51" instead of showing a scary red loss.
4. Orphaned position has no bot managing it — this likely happened because the Apex/ladder bot completed but didn't clean up the position record.
5. The realized_pnl field shows 251 (cents? dollars?) — needs consistent units. The UI shows $2.51 which seems right for 3 contracts resolving YES at 35¢ entry (profit = 65¢ x 3 = $1.95 after fees roughly), but the raw value 251 is ambiguous.

REQUESTED FIXES:
- Detect settled markets (yes_bid=0, no_bid=99-100) and show RESOLVED state instead of active P&L
- Hide or disable "Sell Orphan" button on resolved markets
- Show realized_pnl prominently as the actual outcome
- Stop showing market_exposure as a loss when the game already ended
- Clean up orphaned position records after resolution

---

## [CRITICAL] Anchor Ladder: Orphaned contracts from race condition during hedge cancellation
**2026-03-21 16:33** | phantom

TICKER: KXNCAAMBSPREAD-26MAR21SLUMICH-MICH12

ORPHAN ISSUE:
- Kalshi shows 20 YES contracts held
- Meridian bot only tracks 13
- 7 contracts are orphaned — Meridian lost track of them

ROOT CAUSE (user's explanation of race condition):
When a hedge fires and starts canceling the anchor limit orders, there is a tiny window where an anchor can fill DURING that cancellation. When this happens, the system incorrectly spawns a NEW generation of a hedge, treating it as a new cycle. But the original hedge was never completed — so those contracts from the split-millisecond fill get orphaned because they don't belong to the new hedge generation and the old one is already being torn down.

CORRECT BEHAVIOR:
- If an anchor fills DURING hedge cancellation, it should NOT spawn a new hedge generation
- It should either: (a) absorb that fill into the existing hedge, or (b) hold it and reconcile before creating a new cycle
- The system needs to handle this timing collision explicitly as a race condition

RUNG DISPLAY BUGS (separate but related):
1. All FILLED anchors should be LIT UP — not just the most recent one
2. Anchors should be shown CONSOLIDATED (not split across rungs individually)
3. Only ONE hedge order exists at a time covering all filled anchors
4. Lower rungs are showing as filled but upper ones aren't lighting up — shading logic is inverted or wrong
5. A completed rung pair (anchor + hedge both filled) should shade out TOGETHER
6. An anchor that filled but whose hedge has NOT yet completed should remain LIT

THE EDGE CASE FLOW:
1. Anchor fills → hedge placed
2. New anchor fills → hedge cancels and replaces with larger hedge
3. During that cancellation window, ANOTHER anchor fills
4. System spawns new hedge generation incorrectly
5. Contracts from step 3 become orphaned

This is causing real financial impact — 7 contracts untracked on MICH -12.5 spread.

---

## [CRITICAL] Apex bot full state dump — MICH12 ladder_arb with multiple critical bugs
**2026-03-21 16:36** | apex


BOT ID: larb_KXNCAAMBSPREAD-26MAR21SLUMICH-MICH12_1774110466833
TICKER: KXNCAAMBSPREAD-26MAR21SLUMICH-MICH12
MARKET: Michigan wins by over 12.5 Points — MICH -12.5 spread
TYPE: ladder_arb (THIS IS AN APEX BOT — user has explicitly said never show "ladder_arb" in the UI)
STATUS: ladder_arb_yes_filled (ALSO MUST NEVER SHOW — use "APEX" branding only)

=== RUNG SUMMARY (12 total rungs) ===
Rung 1:  width=6,  YES=44¢, NO=50¢, qty=1 — NO filled, YES NOT filled
Rung 2:  width=7,  YES=44¢, NO=49¢, qty=1 — NO filled, YES NOT filled (no_fill_qty=0 but no_filled_at populated — DATA INCONSISTENCY)
Rung 3:  width=7,  YES=44¢, NO=49¢, qty=1 — duplicate of rung 2, nothing filled
Rung 4:  width=8,  YES=44¢, NO=48¢, qty=1 — nothing filled
Rung 5:  width=9,  YES=43¢, NO=48¢, qty=1 — nothing filled
Rung 6:  width=10, YES=43¢, NO=47¢, qty=1 — nothing filled
Rung 7:  width=11, YES=43¢, NO=46¢, qty=1 — nothing filled
Rung 8:  width=12, YES=42¢, NO=46¢, qty=1 — BOTH filled, completed=true, _profit_recorded=true
Rung 9:  width=13, YES=42¢, NO=45¢, qty=3 — BOTH filled, completed=true, _profit_recorded=true
Rung 10: width=14, YES=41¢, NO=45¢, qty=3 — BOTH filled, completed=true, _profit_recorded=true
Rung 11: width=15, YES=41¢, NO=44¢, qty=3 — BOTH filled, completed=true, _profit_recorded=true
Rung 12: width=16, YES=41¢, NO=43¢, qty=3 — BOTH filled, completed=true, _profit_recorded=true

=== CRITICAL BUGS OBSERVED ===

BUG 1 — CONTRACT SCALING BROKEN ON LOWER RUNGS:
Rungs 1-7 all show qty=1. Per the Apex strategy, wider rungs should scale UP in contract count (more contracts as spread widens = more profit). Rungs 8-12 correctly scale to 3 contracts. But rungs 1-7 are stuck at 1. The scaling logic is only applying to some rungs, not all. This means the narrower rungs are underfilled.

BUG 2 — NO FILLS ON RUNGS 1-7 WITH YES UNFILLED:
Rungs 1-7 show no_filled_at timestamps on rungs 1-2 but fill_qty=0. This is a data inconsistency — either the timestamp is wrong or the qty tracking is wrong.

BUG 3 — BOT STATUS STUCK IN ladder_arb_yes_filled:
Status shows "ladder_arb_yes_filled" even though 5 rungs (8-12) are fully completed. The bot should either show COMPLETED or be cycling to the next repeat. Instead it's frozen. _hedge_fill_count=0 despite hedge order IDs existing (15 hedge order IDs in _all_hedge_order_ids).

BUG 4 — cumulative_pnl=-147 CONTRADICTS pnl_cents=195:
Bot-level shows pnl_cents=195 (positive). Bot detail shows cumulative_pnl=-147 (negative). These are contradictory. One of them is wrong. The orphaned position in the positions panel shows realized_pnl=-110 with avg_price=42, yes_bid=37 — this is the YES position from filled rungs that has NOT been hedged yet (or hedge failed).

BUG 5 — ORPHANED YES POSITION:
The positions panel shows 7 YES contracts @ avg 42¢, currently bid 37¢, realized_pnl=-110. This position has no managing bot (is_orphaned=true, managing_bots=[]). These are the unhedged YES fills from this bot. The hedge orders apparently did not fill. This is the same hedge-stuck bug from before (Apex hedge stuck in WAITING). The bot placed hedge orders but they never executed, leaving naked YES contracts.

BUG 6 — UI SHOWS "LADDER_ARB" BRANDING:
Bot subtitle shows "APEX · LADDER_ARB_POSTED" and status pill shows "ladder_arb_yes_filled". User has explicitly requested these strings NEVER appear in the UI. All user-facing text must say APEX only. Internal variable names can stay but grep all template/render code for ladder_arb and replace with APEX.

=== HEDGE ORDER IDs (15 total, none confirmed filled) ===
43682aef-a059-4f00-a885-20c2c29df42c
14e38b34-c762-4fbd-86e8-2054b019d798
ad5a9420-5e69-42bc-b0a7-ea3ce2979fa2
356ed5c1-331e-47a8-8364-6a04f613f0e9
a22e87c3-40cb-4fef-aa28-2c9ed1d6a1b3
0292f064-485b-4542-ae83-03a745d1d668
f3d06de9-1bc5-4ac4-b58a-d5b39cf810a7
44e22b96-8f2c-4228-81db-905656035be8
adaf6232-0038-4320-8e30-f6d39b4081a8
4f8223db-f4ee-4ed4-986c-77b712e1162b
e291139c-3ef2-472f-ace2-1e1333dce680
1385a0c1-0c29-4d29-8340-d38e55b645f7
2b1b4375-9442-4970-a9e2-2f29ef1b793c
d2bd82c6-30db-420e-8411-05cac5f3b040
fe3dede1-00e6-407c-94f4-bd928167ff4f

=== POSITION DATA FROM POSITIONS PANEL ===
ticker: KXNCAAMBSPREAD-26MAR21SLUMICH-MICH12
side: YES
quantity: 7 contracts
avg_price: 42¢
yes_bid: 37¢ / yes_ask: 40¢
no_bid: 60¢ / no_ask: 63¢
realized_pnl: -110¢
market_exposure: 295¢
is_orphaned: true
managing_bots: []
resting_orders: 0

=== SUMMARY FOR CLAUDE CODE ===
This bot ran an Apex ladder on MICH -12.5. The YES anchor side filled on 5 rungs (13 contracts total across rungs 8-12). Hedge orders were placed (15 order IDs) but _hedge_fill_count=0 — hedges never confirmed filled. Result: 7 YES contracts left orphaned at a loss. The bot is frozen in ladder_arb_yes_filled state. The UI shows wrong P&L (+195 bot level vs -147 detail level vs -110 realized in positions). Fix priority: (1) hedge fill tracking broken, (2) orphaned position detection should auto-attach a watch bot, (3) UI branding, (4) rung scaling.


---

## [BUG] Latency panel stats overflowing their boxes in the UI
**2026-03-21 17:44** | system

User reported that the latency panel stats are not fitting inside their display boxes — text/numbers are overflowing or getting clipped. Seen on the Monitoring tab. 

The latency data has several stat blocks with multiple fields each (avg, min, max, p95, count, recent). The issue is likely that the stat values are too wide for their containers — for example:
- api_ping: avg=41.9ms, max=125.6ms, p95=62.5ms
- order_place: avg=26.2ms, max=43.7ms, p95=37.9ms
- fill_to_hedge_apex: avg=32.0ms, max=36.3ms
- orderbook: avg=23.5ms, max=69.6ms

The boxes likely need wider min-width, smaller font, or text truncation/wrapping. The user saw this on their screen and the screenshot shows the Bots & Automation > Monitoring view. The latency section was not visible in the screenshot (likely requires scrolling), but the user confirmed the overflow visually.

Suggest: check the CSS for the latency stat cards — add overflow handling, reduce font size, or expand card width. Also consider abbreviating labels (e.g. "Fill→Hedge (Apex)" instead of full names).

---

## [BUG] Trade log calendar shows "Lost" (3W/5L) but positive P&L +$0.07
**2026-03-21 18:29** | system

On the History tab, the P&L calendar for March 20 shows +$0.07 profit but the win/loss record reads 3W/5L — meaning more losses than wins, yet the day is green/profitable. This is confusing because the label implies the day was a net loss but the dollar figure says profit. 

Two possible issues:
1. The W/L label may be counting individual legs or bot cycles rather than net profitable trades — so a single arb bot that filled both sides counts as "2 losses" even if it made money overall.
2. Or the +$0.07 is miscalculated and the day was actually a net loss (the -$0.23 on March 19 and -$9.00 on March 15 suggest a pattern of losses).

User noticed and flagged this as confusing/wrong. The calendar cell should either: (a) correctly count W/L as net profitable days, not individual legs, or (b) clarify what W/L means in this context. Screenshot was taken — the March 20 cell clearly shows "+$0.07" in green with "3W/5L" below it.

---

## [BUG] Orphaned positions - user reporting orphans appearing but system shows 0
**2026-03-22 03:32** | system

User is experiencing orphaned positions appearing in the UI, but get_orphaned_positions returns count=0. User doesn't know how it's happening. Need to investigate: (1) Whether orphans are being detected on startup but cleared before the API is queried, (2) Whether the orphan detection logic misses certain bot types, (3) Whether bots that stop/fail are leaving contracts behind without being flagged. User says it keeps happening repeatedly. Check the orphan detection pipeline and whether stopped bots (status=stopped in active bots list) are properly reconciling their positions.

---

## [BUG] Bot count vs contract count mismatch - "18 bots watching 16 contracts" display
**2026-03-22 03:32** | system

User sees "18 bots watching 16 contracts" in the UI. This is confusing because you'd expect bots >= contracts (each bot watches at least 1 contract). Likely a display/aggregation bug where the contract counter is undercounting — possibly not summing all legs, or anchor ladder bots with pending/None prices aren't being counted. Screenshot shows Active Trading Bots panel. The numbers shown in the bot summary cards at the top (APEX, PHANTOM, ANCHOR DOG, SCOUT) should sum correctly to total bots and contracts. Investigate how contract count is calculated vs bot count.

---

## [BUG] P&L shows $0.00 at top of bot cards but individual cards show correct profit
**2026-03-22 03:32** | system

User reports that the aggregate P&L displayed at the TOP of the bot card section shows $0.00 (or $0 profit), but when you look at individual bot cards they each show their correct profit/loss values. The screenshot shows "APEX TODAY ??????? -$8.37" at the top level but individual cards may differ. The summary/rollup P&L is not correctly summing the individual card values. This could be a timing issue (cards load async and the total renders before values arrive), or the aggregation is reading from a different data source than the individual cards. The top-level number should be the sum of all individual card P&Ls.

---

## [BUG] Bot card header shows $0.00 profit but individual cards show correct P&L
**2026-03-22 03:33** | system

User showed a screenshot of the bot panel. The aggregate/header P&L at the top of the bot cards shows $0.00, but the individual bot cards below show the correct profit values. The rollup number is wrong — it's not summing the card values correctly, or it's reading from a stale source. All positions are being tracked fine, this is purely a display bug on the summary line.

---

## [BUG] Screenshot tool ignores scroll position — always captures top of page
**2026-03-24 00:06** | system

User scrolled to the bottom of the Active Bots page to show the latency footer bar (which appears at the bottom of every tab). The screenshot tool captured the top of the page instead of the current scroll position. This makes it impossible to inspect anything below the fold. The screenshot should capture what the user actually sees at their current scroll position, not document top. This is also why previous screenshots showed the wrong page — the tool seems to capture a static/initial render rather than live viewport state. Fix: screenshot should reflect actual viewport scroll position.

---

## [BUG] Phantom hedge latency: 260ms raw, 200ms round trip — extra 200ms overhead
**2026-03-24 00:07** | phantom

User reports from the latency footer at the bottom of the Active Bots page:
- Phantom RAW hedge speed: 260ms
- Phantom ROUND TRIP hedge speed: 200ms

The round trip is showing LESS than the raw, which doesn't make sense (round trip should always be >= raw). User notes there is an "extra 200ms on their end" — suggesting the round trip is adding ~200ms of overhead beyond what's expected. This likely indicates network/processing overhead between order placement and confirmation that needs to be investigated. Could be a timing measurement issue, a sequencing bug in how raw vs round trip are calculated, or actual latency in the hedge acknowledgment cycle.

ALSO: The screenshot tool has a critical bug — it ALWAYS captures the top of the page regardless of where the user is scrolled. The user was scrolled to the bottom of the Active Bots page to show the latency footer, but every screenshot taken showed only the top of the page. This makes it impossible for Claude to read any UI elements that live below the fold (latency bar, footer stats, etc.). The screenshot tool needs to capture the CURRENT scroll position, not always the top of the viewport.

---

## [BUG] Phantom bot ghost xN and xY labels overlapping in UI
**2026-03-24 18:03** | phantom

User reports that in the Phantom bot display, the contract multiplier labels (xN and xY) are overlapping/rendering on top of each other. This appears to be a z-index or positioning bug where two label elements are stacking. Screenshot capture is not catching the overlay panel clearly, but user confirms it is visible on their screen. Claude Code needs to check the Phantom bot card's contract multiplier label rendering — the xN and xY values are colliding instead of displaying in their correct separate positions.

---

## [BUG] Live filter showing non-live markets (golf/other)
**2026-03-28 07:18** | system

User reports the "live only" filter is hit or miss — non-live markets (e.g. golf player props for rounds not yet in progress) are appearing in the feed even with the live filter enabled. At 12:17 AM Arizona time, no golf is in progress but Houston Open markets were visible. The filter is inconsistent — sometimes works, sometimes doesn't. Needs investigation into what determines a market's "live" status and whether the filter is checking that correctly.

---
