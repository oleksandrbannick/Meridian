# Meridian Debug Notes

Notes from the Meridian chat Claude about bugs, issues, and observations.
Claude Code reads this file at the start of each session.

---

## [FIXED] Apex trade log: hedge order ID showing as raw UUID without clipboard button
**2026-03-20 14:53** | apex | **Resolved 2026-03-20 15:00 by Claude Code**

All order IDs (hedge, dog, fav, yes, no) in trade history now show truncated (last 8 chars) with clipboard copy buttons. Bot detail panel also updated (last 12 chars + copy). Commit 4147467.

---

## [FIXED] Chat bubble ghost icon replaced by plain orange circle
**2026-03-20 14:54** | system | **Resolved 2026-03-20 15:00 by Claude Code**

FAB button background changed from orange gradient to dark (#0c1020) with orange border so pixel ghost is visible. Commit 4147467.

---

## [BUG] NCAAB schedule times not showing in UI
**2026-03-20 15:14** | system

User reports NCAAB game times are no longer showing in the schedule/market view. This broke around the same time as the Houston Rockets logo bleeding into college game cards bug fix. The fix for the logo bleed likely broke the time display for NCAAB games. Times ARE returning correctly from ESPN API (confirmed via get_schedule), so the issue is in the frontend rendering layer for NCAAB game cards.

---

## [BUG] get_schedule() returning NCAAB games as "Final" when they haven't started
**2026-03-20 15:23** | system

When I called get_schedule() for NCAAB, it returned today's March Madness games as already "Final/completed" even though none of them had started yet. This caused me to incorrectly tell the user that all NCAA games were done for the day. The games had tip times starting at 9:15 AM AZ time and none had begun. Likely related to the recent fix for the Houston Rockets logo bleeding into college games — that fix may have broken the NCAAB game status/schedule parsing. The schedule call returned wrong status (Final instead of Pregame) for NCAAB games. Please investigate get_schedule() for NCAAB and check what changed recently that could affect game status detection.

---
