# Scenario admission audit · 24 October 2026

Territory: numeric/data admission in the existing polder model. Preserve other agents’ work and existing layout. Initial canonical tree clean at99be5bb.

Reproduced sparse24-slot rain being treated as complete and returning a zero account; reproduced finite extreme area producing Infinity/NaN that JSON converts to null. Array.every skips missing slots. Validate a dense view, reject nonfinite derived totals, require UTC-hour alignment, and reject invalid clock/missing boundary. Add executable regressions. No CSS, map, font, source data or layout changes.

Verification and release results pending. This scoped audit does not certify that every security/design defect in the codebase has been eliminated.
