# Jakarta dashboard release · 11 October 2026

Dedicated to Kiki Yunita of the Jakarta Investment Agency. The dedication is stated in the dashboard footer, the atlas footer and the README; `scripts/test-release-contract.mjs` fails if it is removed from any of them.

## Version 1.0.0 · 11 October 2026

Released as `v1.0.0` on `main`. Version is one value stated the same way in four places — `package.json`, `ATLAS_VERSION` in `src/index.ts` (`/api/health` and five `/api/atlas/*` payloads), `DASHBOARD_VERSION` in `public/dashboard.js` (the footer shows `v1.0.0 · <build tag>`), and the release contract test that fails when any of them drifts.

Maturity tier: **Pilot**. It is live at a public domain, bilingual, with automated gates on every release and {source, tier, date} on every number. It is not Production and not Contract, because: Open-Meteo throttles the Worker (the client refetches from the visitor's browser), no measured air network or live transit/congestion source is wired, flood stations publish official thresholds rather than readings, and the building archive is an Overture snapshot with mixed height sources. The gate that would move it up is a keyed weather plan or a measured source, not more code.

Release order is fixed: `npm run release` runs typecheck, verify, every test suite, deploy, and then all three live smokes against the deployed bytes before the tag is written. A tag is never written on a red gate.

Active source repo: `Nonarkara/jakarta-dashboard` (private). Local checkout: `/Users/nonarkara/Projects/dashboards/Jakarta-dashboard`. The original atlas repo was forked with its full history; all atlas interactive content is preserved.

Dashboard `/`, full atlas `/atlas`. The deployed Worker deliberately retains `jakarta-3d-atlas`, its account, custom domain and R2 archives. Only this new dashboard repo should deploy to that Worker now. Asset HTML canonicalization is disabled because the Worker routes root/atlas to different HTML files; otherwise `/atlas` redirects to root and embeds the dashboard recursively.

Console register. Design read: a Jakarta research desk with one dominant map and aligned observation/official-bulletin rails. Reference: existing HCMC operations layout and Vignelli's 1972 subway diagram. Main divisions 2px, local rows 1px. Named batik palette exception and three appearance modes are retained. Mobile map appears before supporting rails. Language/theme/selection changes never remount the iframe.

New live data: five verified BMKG `adm4` locations (Kemayoran, Penjaringan, Cengkareng Barat, Tebet Timur, Pisangan Baru); BMKG regional weather alerts and national latest earthquake; aggregate PetaBencana reports. Static prepared data: 240 operator GTFS routes, 8,091 source stop rows; 678 public health and 3,525 school reference points. Store source dates and licenses in assets/ledger. No measured air network or live transit/congestion source is claimed.

Air adapters now require UTC offset zero and a returned model grid within 35 km (global CAMS grid); weather allows 20 km. These limits accommodate gridded output while rejecting the audited 44 km shift. Source coordinates remain separate from requested samples. Tests cover nonzero offset and shifted location. Building identity/provenance improvements from the audit remain a later data rebake; existing archive was preserved.

## Original atlas context (retained)

# JKTx atlas (Jakarta)

Ported 2026-10-10 from `hcmc-3d-atlas` at commit 7695ff9. Same engine, same
house rules, Jakarta data. Read `hcmc-3d-atlas/context.md` for the shared
design history; this file records what differs.

## Live values

- Worker: `jakarta-3d-atlas` on account `74ad6bf8dfaaccf82de6f0847f7d2d54`
- Domains: `jakarta.nonarkara.org` (custom domain), `jakarta-3d-atlas.drnon.workers.dev`
- R2: bucket `jakarta-tiles`, keys `buildings/jakarta-v1.pmtiles`, `buildings/jakarta-waterways.pmtiles`
- Repo: `github.com/Nonarkara/jakarta-3d-atlas` (private)
- Bbox: 106.65–107.00 E, 6.40–6.08 S (DKI mainland; Kepulauan Seribu excluded). UTM 48S, EPSG:32748.
- Google 2.5D manifest cell `2f` (EPSG_32748, 2023); GHSL tile R10_C29.

## Register and palette

Console register, same as HCMC. Palette is batik: indigo ground (#0f1b33),
limestone text (#f1e7d0), soga gold accent (#d8a24a) in dark; limestone paper
with indigo text and soga brown (#7a3e1d) in light. Chosen so the two cities do
not read as the same product with a different label. Contrast is enforced by
`scripts/test-theme-contract.mjs`.

Language: Bahasa Indonesia default, English complete. Catalog in
`public/translations.js` (`window.ATLAS_ID`), keyed by English source text.

## Conserved invariants

- Building heights are real metres; `scripts/verify-local.mjs` fails on any
  multiplier, including one hidden in `HEIGHT_GET`.
- Every height carries its source (`hs`): measured, floors, google, ghsl, estimated.
- Missing data is never an all-clear and never a zero.

## Landmark decision (2026-10-10)

Curated landmarks are only Autograph Tower (OSM outline, CTBUH 382.9 m) and
Monas (OSM's 28-part model, 132 m). Jakarta OSM tags real heights on most
towers and maps Gama Tower as stepped parts, so the Overture bake carries them
as measured heights. Curating one published height over a whole outline was
wrong here: Gama's outline is its 22 m podium; Istiqlal's and the Cathedral's
published heights belong to a dome and spires, not the whole footprint.

## Removed from the HCMC build

VNTT sensors, simulated buses, the HCMC dashboard proxy (scoreboard, incidents,
traffic flow, risk score), and the hand-sketched flood zones. No Jakarta open
source replaces them. Air quality now reads Open-Meteo / CAMS directly at five
sample points (one per kota).

## Maturity

Public demo (T0/T1). Buildings are an Overture snapshot with mixed height
sources; rail is OSM as mapped; weather and air are model estimates. Not an
official warning surface: the watch strip points to BMKG and BPBD DKI Jakarta.

## Known upstream limit (2026-10-10)

Open-Meteo answers 503 to the Worker (shared Cloudflare egress is throttled;
HCMC's Worker sees the same). `/api/atlas/rainfall`, `/api/atlas/air-quality`
and the watch's place values therefore read "unavailable" server-side. The
client fetches the same provider from the visitor's browser with the same
gates (rain table, rain lens, watch strip, AQI layer), so the page shows
values. `scripts/smoke-atlas-api.mjs` reports this as a warning, not a
failure. A keyed Open-Meteo plan would remove it; none has been bought.

## Jakarta local identity and CRM · 11 October 2026

This supersedes the earlier batik colour interpretation. The user explicitly requested Palette Design Core, a more local colour/type combination, and CRM Jakarta integration. Read `docs/JAKARTA-DESIGN-AND-CRM.md` for source evidence, the full type brief and access limits.

Palette/Wada plate 267 is source-verified in the local Palette catalog: Cream Yellow #fdbf68, Yellow Orange #f99d1b, Benzol Green #00978d, Blue #006eb8. Production tokens adapt the relationship, not the exact book inks or official Jakarta brand swatches. Blue-derived neutral carrier 80%, bounded green masthead/CRM field 15%, warm yellow/orange action pointer 5%. Jakarta's official MENOR colour meanings supply the local interpretation. Semantic rain/AQI and provider legend colours stay independent of the brand. The accent exception is named, load-bearing and approved by the user's palette request.

Type: self-hosted Plus Jakarta Sans (Tokotype, city identity commission; OFL 1.1), body/controls 14px, supporting text 12px, main heading 28px; real variable weights and tabular figures. The font-role exception replaces system UI/mono body with a script-appropriate city family. No decorative textures, rounded corners, gradients or shadows. Design read: a Jakarta civic observation desk with one dominant map and clear paths into city reporting. References: +Jakarta, TransJakarta and CRM; Palette's Bauhaus/Bringhurst interpretation. Dials 4/2/6. Existing features and map instance remain.

CRM monthly viewer URL is taken from the first-party monthly page. Viewer loads only on user action, has a close control and direct official fallback. Official daily/monthly/kelurahan/map links and reporting guidance are provided. No citizen identity/text/photo collection and no private API/report replication. CRM counts are not presented as locally fetched or live. The homepage/other pages timed out during investigation; no uptime claim is made. CSP allows only the two Google report hosts in addition to same-origin frames.


## Dense map workbench revision · 11 October 2026

The user's rejection of the type and nested hero scrolling supersedes the earlier Plus Jakarta Sans choice. Use self-hosted Adobe Source Sans 3 (SIL OFL), 13px body / 11px metadata on desktop and 14px / 12px on phones. The embedded atlas is a bounded viewport, not a second page: lenses, evidence entry and map form a fixed grid. Tools, environment, data and attribution remain inside an explicit evidence drawer. Standalone atlas keeps its page. Desktop map action strip uses 30px controls; coarse pointers retain 44px targets. Preserve every provider tier and date; density is spacing and hierarchy, never dropping provenance.


## Bounded hero and detail popups · 11 October 2026

The user's explicit request to stop page bleed replaces the long scrolling dashboard. Default shell occupies one viewport: header, map/desktop readings, slim footer. Weather detail, transit, civic facilities, CRM and Sources are native modal dialogs opened by nav buttons. Original content and IDs remain. Close/Escape restore focus; selecting a map overlay closes a popup to expose the map. At phone/tablet width, weather observations and warnings move into their accessible dialogs, never disappear. Map drawing and its source drawer are unchanged.


## Jakarta Satu 3D patterns · 11 October 2026

Observed public source: https://jakartasatu.jakarta.go.id/geoportal/peta/3d. Adopted place search, height/type filters, legend and reset-view jobs in a bounded Explore popup. Improve with explicit source-tag grouping, height-provenance filtering and checked viewport counts (rendered simplified footprints, not a census). Loading/failing map data produce no numeric count. Keep height geometries unchanged. Landmark parts filter using the tallest published part per name. No official land-use attributes, meshes, RDTR geometry or proprietary scene assets were copied; official 3D/RDTR links remain available for comparison.

## Official portal imports · 11 October 2026

Data kota dialog adds 37 JIC project proposals (9 sectors; 31 publisher point coordinates, 2 duplicate coordinates quarantined, 4 without points), 154 Satpol PP flood-prone reference rows for 2024 aggregated into 104 kelurahan-period groups, five JSC planning-document records plus two selected facts from the 2023 annual report, and Bappeda top20/2045 planning target. Current Pantau Banjir water/pump feed timed out and is explicitly not imported. Existing CRM report retained.

Green-space selector adds 5,842 valid polygons from Jakarta Satu model_gab_rth (5,847 source records; one out-of-region, four null/empty geometries withheld). Categories decoded from public field domain; no staff/certificate fields. These are reference inventory, not all publicly accessible parks. No area totals. Single selected polygon goes through existing overlay bridge; building, rail, flood and environmental layers unchanged. Popup data loads on open; 3.8MB green inventory loads only on selection. New official-data.js participates in version stamping and exact edge-byte smoke. See docs/OFFICIAL-PORTALS-2026-10-11.md for contracts and refresh limitations.

## Native Bahasa Indonesia / English interface

A visible language action in the compact masthead and each native popup switches the same host/atlas preference without remounting the iframe. Both language storage keys are synchronized; same-origin embedded atlas initializes from its host, and standalone links carry `lang` in both directions. Loop guard ignores identical language acknowledgements. Data kota is labelled Riset / Research. Research metadata uses a reviewed presentation glossary (`reference-language.js`) for planning titles, proposed cost/area/start text, local numbers, and public facility categories; source snapshots, units, proper names and original documents remain intact. Research query, sector/topic and expanded project rows survive switching. Accessibility names/placeholders switch alongside visible labels. Original publisher-hosted CRM reports/PDFs retain their publisher language.

## Banjir / Flood desk · 11 October 2026

A ninth nav popup, `flood-dialog` ("Banjir / Flood desk", nav label bilingual), couples the live official signals the dashboard already holds (BMKG warnings, the five-point BMKG rain forecast, PetaBencana report counts, latest earthquake) with a dated Jakarta Satu monitoring-network bake from `scripts/prepare-flood-network.py` (`npm run prepare:flood`), served as `public/flood-data.js` + `public/data/jakarta-v1/{awlr,arr,pumps,situ,risk}.geojson`, `population.json`, `flood-network.json`.

Content: 28 AWLR water-level stations in the catalog (25 inside the DKI map bbox carry official SIAGA 1–4 alert-threshold bands in cm, grouped by river; one station publishes no bands and says so); 56 ARR rain gauges (47 in region, with basin, city and installed year); 263 pumps, 589 floodgates, 147 reservoirs (geometry only from the FeatureServer variants; MapServer layers publish attributes without shape); 1,900 flood-risk polygons whose classes are strictly {Ringan, Sedang, Berat}, summarised per kelurahan and joined 260/260 to 2023 semester-2 population (WNI, children, elderly 60+, family cards) so the risk table can state exposure; 28 situ with official condition categories. Counts reconcile in `scripts/test-flood-network.mjs`.

Honesty rules: these services publish no observation dates, so thresholds and classes are labelled official reference, not readings; the dialog shows no live water level anywhere. Pantau Banjir timed out (45 s), PetaBencana's floodgauges topology returned empty, and both remain explicit `accessStates` with official links and checked dates inside `flood-network.json`. Upstream catchment stations outside the map bbox stay listed, named, never mapped. The 4.46 MB risk geometry loads only when a kelurahan is selected, through the existing overlay bridge. Every value keeps {source, tier, date}; the conservation law holds. The new suite in the test chain proves field allowlists, DKI bounds, SIAGA parsing, the class domain, population reconciliation and the access states; `smoke-dashboard.mjs` checks exact deployed bytes for all seven new assets and the stamped `flood-data.js` tag. Raw source captures: `data/source-evidence/flood-network-2026-10-11/`.

## Map insight lenses · 12 October 2026

Four lenses added to the atlas map beside the weather and satellite lenses, reachable in one tap from the dashboard's map. They compute from assets already baked in this project; `scripts/prepare-insight-views.py` makes no network call, so a new view never becomes a new claim. Output is `public/data/jakarta-v1/insight.json` (115 KB, one digest per input asset, plus a staleness test that fails the build).

**Flood exposure** shades each of the 260 flood-mapped neighbourhoods by the share of its own mapped land in the heavy class, weighted across classes, and lists them by residents on severe land. A neighbourhood carries its residents once: many risk polygons do not multiply the people living there, and no city-wide total is offered. Population is Semester 2 2023 and joins 260/260. The top six are Kapuk, Duri Kosambi, Pejagalan, Rawa Buaya, Tegal Alur and Semanan, which is the known coastal and northern flood belt.

**Height confidence** recolours the building extrusion by `hs` instead of by height, reusing the four theme stops so the lens introduces no new colour, and reports the share of buildings on screen in each tier. It forces 3D because a flat fill cannot carry it. Counts are simplified rendered footprints, not a census. It is about how well a height is known, not how well a footprint is drawn.

**Green space** aggregates the reference polygons per borough and states that the area is computed from published geometry rather than a publisher total. 124 rows with a blank `kota` were placed through the official kelurahan they name; 464 that carry neither borough nor neighbourhood stay unplaced and are counted, never spread. 144 polygons with no stated category are counted too.

**Flood monitoring** maps the published stations, gauges and pumps and names the gap: 106 of the 260 flood-mapped neighbourhoods have a published pump, 154 do not. AWLR and ARR records publish a city and an address but no neighbourhood, so they are never attributed to one by inference. `pumps.geojson` holds three inventories in one file — only its 263 `Pompa` rows are pumps; 589 floodgates and 147 reservoirs are counted under their own names, and all 589 floodgates publish no borough, so that figure is null per borough and the unattributed total is reported instead of a zero.

Bands are quartiles of the measured spread, not rounded constants, and are recomputed on theme change. Each panel prints its source and checked date. `scripts/test-insight-runtime.mjs` boots the real `app.js` against a fake map and drives all four lenses, proving they build their real layers, clear them on exit, and never publish an absence as a zero.

## Research paper, legal basis, builder · 12 October 2026

The Research dialog (`official-dialog`) gains three tabs beside projects, flood history and reports: how the system was built, the legal basis, and the builder. The paper tab states the five-step method, the live/dated/unavailable states with real examples, four charts computed at view time from the shipped `insight.json` and `flood-network.json` (top-8 severe-land residents, 692/1141/67 class mix, green hectares by borough, pump gap by borough), and a build inventory drawn from the loaded records. The legal tab states the demo is independent and non-affiliated, lists each source's terms from `THIRD_PARTY_NOTICES.md`, and restates the no-personal-data rule. The builder tab carries the DEPA/ASCN bio with verified links (`ascn.nonarkara.org` checked live; email and LinkedIn as given). All copy is bilingual via `data-en`; topics without source records hide the download link; `scripts/test-research-paper.mjs` guards structure, bilingual pairs, computed figures and house presentation rules.

## GIBS caps variant fix · 11 October 2026

The deploy-time NASA environment smoke failed on aerosol while all other GIBS layers passed. Diagnosis: NASA serves different `WMTSCapabilities.xml` variants per egress; the Cloudflare-egress variant writes daily layer dates with a `T00:00:00Z` suffix (`<Default>2026-10-12T00:00:00Z</Default>`, timestamped `<Value>` ranges) that the date-only regexes missed, flipping the product to unavailable. The dated-fallback logic for staged future Defaults was already correct and stays. The `Default` and `Value` regexes in `handleEnvironment` now tolerate an optional time suffix on both forms; `scripts/test-environment-contract.mjs` stages the time-suffixed variant and asserts the product still resolves to a bare day never ahead of today.

## Satu Data ISPU monthly reference · 12 October 2026

Follow-up to the audited "not yet connected" air-measurement gap. Satu Data Jakarta is a Vue SPA — its `/api/v2/satudata/...` paths return SPA HTML on the same host and the data.go.id CKAN API 404s (Next.js portal), but the dataset resource listing exposes an anonymous CSV export at the publisher's backend origin (`satudata.jakarta.go.id/backend/restapi/v1/datasets/export/…`), inspected directly: 3,501 daily rows, 13 station-name spelling variants across five stations (DKI1 Bundaran HI · DKI2 Kelapa Gading · DKI3 Jagakarsa · DKI4 Lubang Buaya · DKI5 Kebon Jeruk), coverage 2024-01 → 2025-11, categories BAIK/SEDANG/TIDAK SEHAT/SANGAT TIDAK SEHAT per Permen LHK 14/2020, plus 21 no-data days (`TIDAK ADA DATA`, never interpolated).

`npm run prepare:ispu` (`scripts/prepare-ispu-reference.py`) bakes the export into `public/data/jakarta-v1/ispu-reference.json` (tier `official-monitoring-reference`): per station, coverage window, the latest batch period (2025-11 — eleven months stale, labelled as such), monthly mean daily max, worst day with category and critical pollutant, day counts; category legend with regulation bounds; publisher, source/export URLs, sha256, the raw-evidence path and retrievedAt retained; all bake-time refusals are explicit `SystemExit`s (never `assert`, which `-O` strips); raw CSV under `data/source-evidence/ispu-2026-10-12/`.

Surfaced in the observations panel beside the CAMS model block (`#ispu-summary`, loaded once at boot like `transit.json`, re-rendered on language switch): each station as a dated-reading row whose `evidence()` stamp carries our own checked timestamp (`retrievedAt`, labelled *diperiksa*), with the publisher's batch period in the copy, plus an explicit note that batches are monthly and no-data days are never filled. The `Open-Meteo / CAMS` ledger row keeps its "US AQI is not ISPU" qualifier; a new `Satu Data · ISPU` ledger row carries the attribution and license gap; the `Udara Jakarta / BPS / BIG` row now says official ISPU ships as a monthly reference while statistics and tides remain unconnected. The conservation law holds: every value keeps {source, tier, date}; the block never claims live data; the evidence stamp carries our own checked timestamp (`retrievedAt`, labelled *diperiksa*) while the publisher's batch period stays in the copy — a date-only stamp routed through the datetime renderer would fabricate a time of day. `scripts/test-official-data.mjs` no longer pins snapshot magic numbers: it re-parses the committed raw CSV named by `evidencePath`, recomputes each station's coverage, day counts, latest batch, mean daily max and worst day, and refuses any drift between bake and source bytes; `smoke-dashboard.mjs` checks exact deployed bytes. The release gate's stamp commit now passes a pathspec (a bare `git commit` would sweep anything a parallel agent staged mid-release) and names the runner from `RELEASE_AGENT` instead of a hardcoded agent id.

## Adversarial hardening round · 12 October 2026

A fresh reviewer attacked the ISPU and insight-lens rounds. Confirmed and fixed at root: exposure-lens rows flew to a hardcoded city centre regardless of the kelurahan clicked — `prepare-insight-views.py` now bakes a bbox-centre per neighbourhood (`center` on every exposure row; the panel flies there or does not fly), pinned by `test-insight-views.mjs` (centroid domain per row) and `test-insight-runtime.mjs` (fake-map flight equals the row's centroid). The release gate's committed-work promise was time-of-check/to-time-of-deploy: the clean-tree gate now repeats immediately before `npm run deploy`, the stamp gate compares `HEAD` against worktree+index, and a POSIX-mkdir lock (`.deploy-locked`, git-ignored, trap-cleaned) serializes concurrent agent deploys — two raced and interleaved before this. The ISPU contract test recomputes the sha256 of the committed raw CSV, so the evidence bytes are identical to the ones the bake digested. The confidence lens now prints its checked date like the other three. Dead identifiers removed (`lensNote`, two phantom layer ids). The post-deploy byte check (`smoke-dashboard.mjs`) now covers every statically fetched asset: health/schools geojson, rail/landmarks/areas, and a deterministic first/middle/last sample of the 240 transit route details with status checks on the rest. Cyber hygiene sweep across the range found no secrets, no TODO/FIXME residue, no filemode changes, and docs that reconcile with shipped bytes.
