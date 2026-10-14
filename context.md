# Jakarta dashboard release · 11 October 2026

## Shipability and Bayer typography · 14 October 2026

Reconciled the prior committed river/air release and the pending NASA/forecast additions. Three assigned agents completed adapter hardening, Research/inventory and source-catalogue work; the parent reviewed and integrated the client behavior, typography and release checks. Owner explicitly chose the free CTAN Universa implementation after confirming Herbert Bayer's Universal.

Human task: a resident or researcher opens a phone link to compare dated city evidence and inspect assumptions. Chosen composition keeps the dominant map and compact controls, with methodology/profile in the existing Research modal; a simultaneous map/research split would spend permanent viewport space on secondary reading. Universa Civic is a 6.7 KB self-hosted GPL-2.0-or-later conversion of Christian Holm's CTAN Universa medium-upright specimen, with original source archive, full licence and conversion script distributed. Headings/navigation use it; Source Sans 3 retains long evidence and numeric reading. It is the owner-selected free implementation, not P22's commercial revival or an exact Bayer original. All earned maps/charts, compact masthead, aligned gutters, bilingual profile and Kiki dedication remain.

NASA FIRMS CSV is schema/size/row/date bounded, rejects blank coordinates and impossible times, admits only 24-hour regional detections and preserves unknown FRP. NOAA-20 true-colour uses the correct JPEG path and has no invented numeric legend. Regional haze permits zoom 4 while active and restores the city zoom floor 9 on exit; detections start disabled and load on demand. A hot pixel never becomes a confirmed fire or a pollutant source attribution. Selection shows precise red coordinates/acquisition time. Air forecast hours are bounded, sorted and deduplicated. The wind illustration explicitly uses 1 real second = 1 scenario hour, stops at six scenario hours, keeps dates in its two-day table, has a retryable failure, aborts on exit and avoids stale callback/listener reuse.

Stale-only hydrology preserves dated station evidence in a validated structured 503 envelope rather than discarding it; current counts stay zero and the response remains no-store. Research's five source states, independent manifest inventories, correct 0–100% pump coverage and legal/source notices survive missing chart feeds. Source catalogue JSON/CSV has 35 records, exact asset hashes and explicit integrated/candidate/blocked states. PetaBencana polygon probe returned a 2024 observation, retained as stale candidate; ridership/budget pages are reachable but no unverified numerical exports are presented as integrated. Original scenario-source schematic description stays alongside the mapped-route metadata.

Local receipts: typecheck, all contract suites and 12/12 verification pass; font regeneration produced identical SHA256 twice; actual 390 px Research and desktop typography inspected. NASA adapter returned 11,463 admitted regional detections on the local probe. Real-user/fluent-human review has not been performed. Canonical release and live receipts follow below.

Final live release: `jakarta-atlas-20261014-1791990078-2d6dde4`, Worker `2da73d0d-ff93-431b-9bca-9ebce370532c`. All required gates passed, including frozen release inputs, three consecutive exact-byte probes on both hostnames, atlas/dashboard smokes and API envelope checks (15/16 API readings available; rainfall Worker egress returned 503 with the existing browser fallback). Live air pane displays 48 dated model rows and explicit units, retaining air while invalid/unavailable wind stays null; no wind transport is assumed in that state. Live regional haze visibly renders the thermal points above satellite imagery. Repeated scenario entry/exit is corrected to remove label layers before their shared station source; the runtime fake now enforces MapLibre's reference rule. Cached thermal evidence seeds source creation and is raised above later raster layers. A general evidence refresh delegates to the air controller instead of erasing it. Phone masthead remains 23 px and document width exactly 390 px at the tested viewport. Screenshots: `docs/RESEARCH-UNIVERSA-LIVE-2026-10-14.jpg`, `docs/RESEARCH-UNIVERSA-PHONE-LIVE-2026-10-14.jpg`, `docs/HAZE-LIVE-2026-10-14.jpg`, `docs/AIR-TIMELINE-LIVE-2026-10-14.jpg`. External map glyph requests can return 404 and use MapLibre's local fallback; no claim of zero provider warnings. This remains a Pilot, without calibrated hydraulic inundation or pollutant dispersion.

## Shared text alignment · 12 October 2026

Modal toolbars, detail bodies and explorer panels share a 12 px reading gutter. Project disclosures and unframed search results no longer add stray 4/12 px indents. Native selects use the same text inset as search fields, with a CSS chevron retaining the selection affordance. Rails use the same 8 px edge as compact chrome; atlas evidence context/body share one gutter. Existing intentional framed insets, content, languages and slim bar heights remain. Live research bounds verified at desktop: toolbar/body/project row x=103, search/select text x=116; at 390 px: x=30 and x=43 respectively. Visual receipts: `docs/ALIGNMENT-DESKTOP-2026-10-12.jpg`, `docs/ALIGNMENT-MOBILE-2026-10-12.jpg`. Canonical clean-checkout release passed typecheck, verification, all test suites, exact-byte convergence and live atlas/API/dashboard smokes; build `jakarta-atlas-20261012-1791823836-a2cd5f3`, Worker version `19d1a963-0002-45b2-85db-8b1b0803a83e`. Unrelated dirty insight-runtime test was preserved and excluded from the release checkout.

## Landmark authoring exploration · 12 October 2026

`docs/landmarks/README.md` records the img2threejs evaluation and a reusable city asset/admission contract. Pinned upstream v2.0.0 commit `a669e9a97cea4452b1c2310c5cca6aa0f6657c1f`; 38 budget/target-resolution tests passed in an isolated checkout. Recommendation: offline authoring, first Monas pilot, real metre constraints and source footprints preserved. HCMC already contains landmark GLBs and needs its own renderer adapter. No reconstructed asset or runtime integration was produced by this exploration, and no application deploy is needed for these documentation changes.

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

## Shipability and water scenario · 12 October 2026

Water arrival scenario is a labelled historical preparedness illustration: published Katulampa/Depok/Manggarai station coordinates, BPBD 2021 approximate 3+6 hour guidance, user-adjustable time factor, independent user-assumed local gauge level/rise. Dashed straight connections are schematic, not river geometry; no flood extent/depth, measured speed or calibrated hydraulics is claimed. PDF direct access was publisher-blocked; UI records that. Published station coordinates remain red. Playback starts only on action, pauses on hidden document and lens exit, and all four scenario layers clear on exit. Monitoring now distinguishes all shared-file infrastructure kinds (263 pumps, 589 gates, 147 reservoirs). Exposure colour explanation states the 1/3/6 weighted class mix and population charts now state their uniform-density area proxy assumption. Full audit: docs/SHIPABILITY-2026-10-12.md.

BPBD public homepage table was accessible through the web reading surface on 12 October 2026, while direct automated HTTP was publisher-blocked. A dated 12-station × seven-hour observation snapshot (09:00–15:00 WIB) is prepared reproducibly from recorded numerical TSV facts by prepare-bpbd-reference.py. Flood desk shows source/time and signed cm/h level changes, explicitly not flow velocity or live feed. Do not join these values to Jakarta Satu SIAGA thresholds: local datums have not been reconciled.

## Compact map chrome · 12 October 2026

User rejected remaining top-bar/HUD real estate. Both atlas and root are now map-first workbenches. Full atlas has two compact rows (36+36px desktop, 44+44px phone), evidence in the lens row, label-sized Layers/Quick jump/City watch/Source buttons and full details on demand. Original metadata, source tables, environmental controls and footer are preserved in About/Sources; flyover lives inside Quick jump. Root map controls live in Controls; mobile section navigation uses one Menu disclosure. No permanent lower action strip or default hint consumes map height; active selection captions remain. Embedded header stays hidden. ResizeObserver only resizes for actual map viewport dimension changes, preserving camera motion through reading updates. Native focus returns to visible Controls after drawer-launched dialogs. See docs/COMPACT-MAP-CHROME-2026-10-12.md.

## Half-height phone masthead · 12 October 2026

At the user's explicit request, the root dashboard phone masthead is now 23px including its border, half the previous 46px. The existing logo, Menu, language switch and Controls remain in one row; logo geometry and vertical padding shrink together. Menu/settings contents retain their existing full-size controls. Local browser measurement at 390×844 confirms 23px and no document overflow; Menu and Controls both open correctly. Desktop remains unchanged. This is an intentional compact masthead exception to the earlier 44px top-action height.

Live receipt: build `jakarta-atlas-20261012-1791819471-7b835f7` (implementation `7b835f7`). Canonical release gates, exact-byte checks, atlas/dashboard smokes and 14/14 API checks passed. Live 390×844 DOM measurement confirms 23px masthead and no page overflow. Local English layout also fits at 320px with the same 23px masthead. Screenshot: `docs/HALF-HEIGHT-PHONE-LIVE-2026-10-12.jpg`.

## Slim map control frames · 12 October 2026

User requested tighter top/bottom button frames. Phone lens row now 24px (from 44px); map disclosure labels 24px, Quick jump outer frame 26px, zoom buttons 28px. Smaller padding retains existing labels/actions and full expanded settings. Root footer has 1px vertical padding and 11px text. Full phone atlas header is 24px. Attribution starts collapsed on demand: MapLibre 6.4.1 compact=true still initially sets open/compact-show, so setup removes these once; native tap behavior and source content stay intact. Local browser confirms 28px collapsed attribution and successful full-text expansion to 64px, with all quick destinations retained.

Live receipt: implementation `32837fc`, build `jakarta-atlas-20261012-1791819827-32837fc`, Worker `1b27fc44-e418-4a7b-9ae3-de76318ee4e6`. Full canonical release passed from an isolated committed checkout because a concurrent test edit was present in the shared checkout; that edit remains untouched. Live phone measurements: lens row 24px, map disclosure summaries 24px, Quick jump 26px, zoom 28px, collapsed attribution 28px; footer 15.20px. Screenshot: `docs/SLIM-CONTROL-FRAMES-LIVE-2026-10-12.jpg`. Desktop atlas measurements: 36px header, 28px lenses, 736px map at 1280×800; no page overflow.

## Waterways and traffic observation lenses · 12 October 2026

Dedicated Waterways & inflow and Traffic cameras lenses preserve the slim map workbench. Lazy-loaded 3,885 OSM ways add streams/drains/ditches and water-body polygons to the existing river/canal tile reference; map colours are geographic classification signals. 4,340 public camera references are clustered/searchable, with catalogue dates and unknown uptime. 21 distinct public toll HLS streams from 26 Bina Marga cards play on request through a fixed catalogue-only proxy (upstream lacks CORS); no recording or credential handling. Kilometre-only streams stay unmapped. hls.js 1.7.3 light module is self-hosted with Apache license.

Public Ciliwung gauges expose local-datum levels, while separate homepage discharge cards are publisher predictions. Future observation times are quarantined; prediction valid times stay explicit. The constant-flow volume tool is per section; no serial-station sums. Geographic sectors locate published station origins relative to Monas, not measured flow vectors. NASA MODIS water/flood classification and JAXA TE-Global model discharge/flood fraction can be overlaid as independent dated comparisons; satellite extent alone cannot confirm volume. No full-city measured inflow or precise flood hydraulics is claimed. Full source/rebuild/access contracts: docs/WATER-TRAFFIC-2026-10-12.md and THIRD_PARTY_NOTICES.md.

Local browser evidence: public JTC KM10+600 video decoded at640×480, readyState4, currentTime13.69s and paused=false; switching to water stops the player. Volume selector 31.51m³/s×1h outputs113436m³; JAXA flood-fraction selection has no page errors. Full release and live receipts follow.

Final release `jakarta-atlas-20261012-1791822639-9ca25ec` / Worker `f81b8f0f-2013-4636-8ac4-c56d61ce85f8` passes the full canonical gate. Live JTC KM19+000 plays decoded640×480 video past86s. Stream availability varies; failures show status and official fallback. Prefer tested MSE decoder over native capability hints; fixed catalogue-only media paths and transparent public request headers. Gauge layers omit optional filter entirely rather than supplying undefined. No matching gauge warning on the final build. Live58gauges/five predictions/JAXA run available; phone390×844 has no overflow. Receipts in docs/WATER-TRAFFIC-2026-10-12.md.

## Robustness, river and air release · 13 October 2026

Executed the approved plan in `docs/AUDIT-PLAN-2026-10-13.md` in order.

**Reliability.** `src/hydrology.ts` treats the cache as optional infrastructure: a cache read fault is a miss (never a 500), a cache write fault never discards fetched data, and publisher faults alone produce 503/no-store. Gauge readings carry an explicit `levelState` — fresh (≤ 3 h), stale (kept as dated evidence), unknown — and only fresh levels count as current; the three-hour ceiling is a stated trial display policy, not a provider interval. Total hydrology outage is 503/no-store, partial data keeps per-branch failure states, and a malformed-but-200 payload sets no availability flag. The water/traffic observation client bounds every fetch with a 12 s abort signal, cancels on lens exit, and offers an explicit retry on failure. The scenario stop resets both the label and `aria-pressed`; the runtime test pins start/pause/scrub/central-stop/exit state resets. All cache-fault and outage tests live in the same commit as the fixes.

**Research opens on the system explanation.** The dialog's default topic is now "How this was built", opening with the approved bilingual purpose voice (three paragraphs, MITF register: read Jakarta through its data; every measurement carries its own validity; compare evidence, change assumptions, keep the difference clear). A fourth evidence state — model & scenario — sits beside live, dated and unavailable. The risk chart translates display labels (Heavy/Moderate/Light) while publisher identifiers stay intact; the pump bar now encodes its printed coverage fraction, with presence-is-not-capacity stated.

**Mapped Ciliwung corridor.** `scripts/prepare-ciliwung-route.py` queries Overpass river/canal ways past the map's −6.4 cutoff and builds a graph from shared way node IDs. Station anchors come from `water-scenario.json` (never hand-typed); admission gates are published in `ciliwung-manifest.json`: 2 km endpoint tolerance, 3.5 km chord bound (waived only with majority Ciliwung naming), chord-relative length bounds, and a majority-of-other-named-waterway refusal that recognises the Sundanese spelling "Ci Liwung". Both station pairs admitted (Katulampa→Depok 42.5 km, Depok→Manggarai 47.7 km, endpoints 1.9–14 m from mapped nodes); the arrival lens traverses the mapped polylines by cumulative distance under the unchanged historical 3 h / 6 h timing, states the OSM source and retrieval date, and keeps the dashed schematic fallback for any unadmitted pair. `scripts/test-ciliwung-route.mjs` recomputes every gate from the shipped bytes and refuses any connector edge over 5 km; the runtime test pins on-geometry marker placement.

**Air and wind.** `/api/atlas/air-timeline` joins a 48-hour CAMS PM2.5/PM10/dust/AOD timeline with wind on exactly equal UTC timestamps, retaining both model cells' identity, the 0.4°/~45 km resolution and the interpolated-hourly caveat; nonzero UTC offsets, grids beyond 35 km (air) / 20 km (wind), unit mismatches, timestamp mismatches and empty windows all fail to 503/no-store, and out-of-range values stay null. The lazy `air-timeline.js` lens renders the compact 48-row table with model provenance, plus a user-started uniform-wind transport illustration: bearing = wind FROM + 180°, distance = speed × elapsed, live red coordinates, no derived concentration or plume width; it stops on button, lens exit and hidden document. `scripts/test-air-timeline.mjs` proves the validation, outage and transport math.

Shipability leftovers folded in: the transit-detail smoke sweep now aborts on a 15 s timeout, brand/loader/vendor/maplibre bytes are exact-checked, the deploy lock prints its recovery path, and the "dead" logo-set deletion was refused — THIRD_PARTY_NOTICES names it as retained owner artwork.
