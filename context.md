# Jakarta dashboard release · 11 October 2026

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
