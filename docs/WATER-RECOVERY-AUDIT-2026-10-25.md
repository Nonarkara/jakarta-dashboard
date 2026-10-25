# Waterways recovery audit · 25 October 2026

## Found

Claude's `ef19fda` layout changes already belong to main and the live preparedness release. The other wind-compass branch is patch-equivalent to merged commit `06cef6e`; merging its old tree again adds no missing feature. Canonical and retired working trees were clean at the audit start. No other agent's files were restored or removed.

The OSM asset request blocked mounting the independent polder budget, coastal forecast and drainage tools until completion or the 12-second timeout. Its failure message offered no scoped recovery. Separately, hydrology completion flew the map back to Jakarta, even if a person had already selected a location. Nonblocking OSM introduces completion-order risks: a delayed fill could cover preparedness markers, and raster context could cover the water vectors.

## Changed

The independent water tools mount immediately. OSM loading/failure uses a source-specific status and native EN/ID Retry action. One retry runs at a time and changes only that reference, preserving the open budget and edited assumptions. Exit aborts requests; epoch checks discard late arrivals. The initial city camera move happens on lens entry, so late gauges never overwrite a subsequent selection.

A shared layer anchor reads actual style order. Satellite and land-cover context insert beneath existing water/reference foreground layers; late waterways insert below official drainage, gauges, budget and preparedness markers. This handles either request order. The Retry action is a content-fit 32px chip with a full hairline, avoiding the inherited full-width 44px button/right-border artifact found in visual review. Existing first-screen answer, 68px phone control clearance, fonts, palette, layers, data, calculations and provenance remain.

## Verified before release

- Actual-controller tests cover stalled OSM with independent budget mounted, failure→single retry→success, unchanged budget DOM/state, late raster/vector/marker ordering, no late gauge camera reset, cancellation, discarded late completion, malformed reference and Bahasa recovery. The old implementation fails the new independent-mount assertion.
- Existing water-traffic, water-context, preparedness runtime and polder-budget tests pass. The 1 km² / 50 mm scenario still conserves to 50,000 m³.
- A local HTTP fixture returns one OSM 503 then proxies the real application. In the actual browser, Retry recovered 3,885 features while Pluit, pump=3, explicit storm mode and the open budget persisted. Fixture code is temporary and never ships.
- Failure/recovered screenshots at 1440/1024/390 were independently reviewed against all seven design rules. Initial oversized Retry finding fixed and re-captured; async ordering finding reproduced independently and closed. All six final screenshots pass. Phone width/scrollWidth=390; answer y381–413 inside panel y104–740; 68px right clearance retained.
- Geometry audit passed five viewport sizes × six lenses, waterways budget open, including 320px. No baseline/instrument changes. Production dependency audit reports zero known advisories; this is not an exhaustive security certificate.

## Production

Canonical release completed with exit 0: `jakarta-atlas-20261025-1792913608-001fbbc`, implementation `001fbbc`, stamp `8cd53d7`, Worker `be33e506-b236-4c8c-a67e-11482481a555`.

- All 48 test commands, typecheck, 13/13 verification, unchanged 208 spatial measurements, three consecutive matching-byte probes on both hosts, atlas/dashboard/official-network/water/haze smokes, 37/37 API checks and 50/50 live rendered checks passed. Complete output: `water-recovery-2026-10-25/release-results.txt`.
- Actual production browser shows 3,885 mapped features. Pluit/pump=3/explicit storm remain through the EN→ID switch. Live captures at 1440/1024/390 and 320 verify the answer, scientific units and native controls. Phone 390: width=scrollWidth=390, header=24px, answer y381–413 inside panel y104–740, right edge330 (60px viewport margin plus 8px panel offset gives the retained 68px width reduction). At 320: width=scrollWidth=320, answer bottom397.3 < panel bottom464.
- No source outage was induced on production. The failure→Retry preservation test uses only the local controlled proxy; production assets match those tested bytes. Independent review closes both the async-order finding and the Retry-frame finding on the final local captures.
- Temporary proxy/dev processes stopped; no other agents' services or files changed. Source and stamp pushed to origin/main; final documentation receipt follows. No open GitHub PRs remained during this audit. Full-system readiness remains bounded by docs/ADMIN-READINESS.md: field validation, current operating capacity and calibrated hydraulics remain open. This change improves source recovery, not source availability or forecasting accuracy.
