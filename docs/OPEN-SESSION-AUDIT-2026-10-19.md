# Open-session audit · 19 October 2026

The inherited release passed its checks, but those checks did not cover clock progression while a person kept the page open.

## Fixed

- Wind transport integrated a full hour for a partial animation hour. It now integrates remaining seconds exactly, preserves missing-hour slots, starts from the current UTC model hour, validates freshness at click time and updates the visible start-hour caption.
- Research fetched once, then resumed old winds and fire detections after returning to a hidden tab. A single-flight, abortable session now refreshes every five minutes while visible, clears the old view during refresh, reloads on return, and exposes bilingual manual refresh. Model admission requires the current hour and a checkedAt within ten minutes. FIRMS uses its actual FeatureCollection/fetchedAt contract, with a 45-minute cache admission limit and per-detection 24-hour filter. Failed feeds remain explicit.
- Gauge state and counts stayed fresh after their three-hour deadline. The actual water controller now schedules the earliest expiry, rechecks on return, and updates counts/list/selected reading without remounting the map. Dated evidence remains available. Nulls and implausible future observations never become current.
- Phone pressure labels collided. Collision-aware placement and small leaders retain every contour. Existing 1 hPa shared interval is unchanged.

## Verification

Typecheck, 12/12 local verification, and all 37 npm test commands passed. The earlier report's 47-suite count was not the current package command count. New controlled-clock tests exercise the real session/controller, partial seconds, current-hour selection, missing hours, hidden requests, aborts, late replies, disposal, actual FIRMS payload and exact three-hour expiry. An independent reviewer reran the relevant tests and approved the 390/1024/1440 visual review against all seven anti-slop rules. Screenshots are in session-audit-2026-10-18 (the audit crossed midnight).

Research was exercised in both languages: playing then refreshing stops old motion, reloads the field, and resets the play state. A real midnight transition advanced the displayed model hour to 19 October 00:00 WIB.

## Boundaries

This release improves temporal correctness; it does not increase the model grid resolution or establish calibrated hydraulic/pollution forecasting. Other atlas lenses still fetch on reopening. No claim that every public dataset has been exhausted. No Cloudflare account rule or Dependabot mode was changed. TypeScript remains 5.9.3. Palette 267, CTAN Universa/Source Sans 3, compact chrome and every existing map/data layer are preserved.

Verified lesson: Scars/Debug-Logs/2026-10-19-wind-transport-must-integrate-partial-hours-and-preserve-missing-hour-time-slots.md.

Live release receipt follows after canonical release.
