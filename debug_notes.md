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
