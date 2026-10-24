# Scenario admission audit · 24 October 2026

Territory: numeric/data admission in the existing polder model. Preserve other agents’ work and existing layout. Initial canonical tree clean at99be5bb.

Reproduced sparse24-slot rain being treated as complete and returning a zero account; reproduced finite extreme area producing Infinity/NaN that JSON converts to null. Array.every skips missing slots. Validate a dense view, reject nonfinite derived totals, require UTC-hour alignment, and reject invalid clock/missing boundary. Add executable regressions. No CSS, map, font, source data or layout changes.

This scoped audit does not certify that every security/design defect in the codebase has been eliminated.

Independent review reproduced additional loss of small inflows with1e20 starting water. Shared1e12m³ numerical bound now caps initial/available space and derived gross/initial+runoff; nonfinite totals or conservation residual above1e−3m³ are refused. This is a calculation/display limit, not a measured capacity. Existing input controls share that maximum without changing layout. Failed context loads clear cached context/polygons/view before retry. Independent reviewer and focused regressions pass. Production-dependency npm audit reports0 known vulnerabilities; this does not certify application security.

## Release verification

Canonical release exited0 for `jakarta-atlas-20261023-1792779011-daf1308` (stamp `b8f6e02`, Worker `a711e48a-5057-41b8-961f-94dac5455c2e`). Typecheck,13/13 local verification, the full45-command test chain, unchanged208 fresh-load spatial measurements over52 widths/four routes, both-host three-probe exact-byte convergence,37/37 API checks, haze/dashboard/network/context smokes and50/50 live rendered checks passed. Browser rendering was verified by the existing canonical audit; no separate manual UI interaction is claimed for this patch.

Fetched the actual deployed model, checked its SHA256 against committed bytes, imported that identical module and verified sparse arrays/unsafe1e20 inputs return unavailable while the ordinary1km²/50mm scenario remains50,000m³ with conserved balance. Independent reviewer found no remaining blocker within the delegated numeric-admission scope. Production-dependency advisories:0 known vulnerabilities. The existing layout, fonts, maps and baseline/instrument hashes were preserved; no spatial redesign in this pass.

One canonical worktree exists. It was clean before work; no unrelated edits or worktrees were removed. Release stamp and this receipt are pushed after verification. Existing calibration, source-coverage and account-level caveats from prior audits remain applicable.
