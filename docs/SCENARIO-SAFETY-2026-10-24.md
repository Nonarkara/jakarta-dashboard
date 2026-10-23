# Scenario admission audit · 24 October 2026

Territory: numeric/data admission in the existing polder model. Preserve other agents’ work and existing layout. Initial canonical tree clean at99be5bb.

Reproduced sparse24-slot rain being treated as complete and returning a zero account; reproduced finite extreme area producing Infinity/NaN that JSON converts to null. Array.every skips missing slots. Validate a dense view, reject nonfinite derived totals, require UTC-hour alignment, and reject invalid clock/missing boundary. Add executable regressions. No CSS, map, font, source data or layout changes.

Verification and release results pending. This scoped audit does not certify that every security/design defect in the codebase has been eliminated.

Independent review reproduced additional loss of small inflows with1e20 starting water. Shared1e12m³ numerical bound now caps initial/available space and derived gross/initial+runoff; nonfinite totals or conservation residual above1e−3m³ are refused. This is a calculation/display limit, not a measured capacity. Existing input controls share that maximum without changing layout. Failed context loads clear cached context/polygons/view before retry. Independent reviewer and focused regressions pass. Production-dependency npm audit reports0 known vulnerabilities; this does not certify application security.
