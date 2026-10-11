# Jakarta dashboard release

Authorized by the user's request to create a private repository, retain the detailed HCMC style and go live at jakarta.nonarkara.org.

## Decisions

Separate private repository: Nonarkara/jakarta-dashboard, preserving the atlas repository and its history. Reuse the deployed Worker and R2 archives so the existing custom domain does not need a destructive migration. Dashboard at `/`; complete atlas at `/atlas`. No paid providers or credentials are needed.

Console register. Design read: a Jakarta research desk where the city map holds the center and official weather, transport and civic evidence remain within reach. Reference: HCMC's existing observation/map/decision arrangement and the 1972 Vignelli subway diagram. Retain Jakarta's named batik palette exception. Main boundary 2px; local separators 1px. Map dominates; supporting detail expands below it.

## Sacred items

All 3D buildings, curated landmarks, OSM rail/waterways, quick jumps, flyover, environment layers, inspection, themes and bilingual text remain. No existing file collapses by 30%. Every value retains source, tier and date; unknown is never zero. No synthetic vehicle positions, congestion or risk score.

## Proposed changes

- New `public/dashboard.html`, `dashboard.css`, `dashboard.js`: bilingual observation/map/evidence shell, BMKG forecast chart/table, alerts, earthquake context, transit search and routes, civic feature search, source ledger and JSON export.
- New `src/jakarta.ts`: bounded cached first-party BMKG forecast, warning and earthquake adapters plus conditional public flood-report status. Static source catalog.
- New data preparation script and versioned assets: licensed official TransJakarta GTFS and public Jakarta Satu facility geometry with manifest. Validate shape/coordinates, keep public selected fields, and cap payloads. Civic redistribution conditions stay explicit.
- Surgical changes `src/index.ts`, `public/app.js`: dashboard routing, UTC and grid-location gates; atlas parent bridge for selected public route/POI overlays. New feeds do not change building heights.
- Stamp all new assets, add meaningful adapter/client tests, retain and run existing suites. Update smoke to inspect `/atlas` and dashboard separately.
- README/context/third-party notices document provenance, geography, scheduled vs observed values, and deployment.

## Verification

Run existing verify/typecheck/test and new response-boundary tests, live atlas smoke plus new dashboard checks. Exercise language, search, selection, evidence export and map in a real browser; verify phone layout. Commit, push, deploy through existing script, confirm the exact build on canonical and custom domains. Save release evidence.
