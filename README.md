# Jakarta city dashboard

Dedicated to **Kiki Yunita** of the Jakarta Investment Agency.

Live: **https://jakarta.nonarkara.org** · complete atlas: **https://jakarta.nonarkara.org/atlas**

Private repository: https://github.com/Nonarkara/jakarta-dashboard. The original atlas history and documentation below are retained. Deploy this repository for the main domain; the separate atlas repository remains a source archive and should not overwrite the dashboard Worker.

The Bahasa Indonesia / English dashboard follows the HCMC observation–map–bulletin arrangement, with Jakarta's Palette 267 coastal/green/yellow relationship and the owner-selected CTAN Universa display face with Source Sans 3 for reading. It adds five official BMKG kelurahan forecasts, dated weather warnings for DKI/Jawa Barat/Banten, the latest Indonesia earthquake, PetaBencana report counts, searchable official TransJakarta scheduled routes and stops, and dated Jakarta Satu health/school reference points. Source, tier and time remain visible; missing inputs never become a safety claim.

Search a route and select it to draw the scheduled alignment. Select a stop or civic facility to locate its reference point. Language/theme changes retain the same map instance. The forecast chart has a complete text table. Export evidence JSON for source payloads and selected geometry. The complete atlas retains all building, environment, inspection and navigation controls.

The Research dialog now has three more tabs beside the project, flood and report data: how the system was built (method, live/dated/unavailable states, charts computed from the shipped records, build inventory), the legal basis (independent demo, source licenses, no personal data, non-affiliation), and the builder (bio and contact).

The Banjir / Flood desk popup couples those live signals with the dated Jakarta Satu monitoring network: AWLR water-level stations with official SIAGA 1–4 alert thresholds grouped by river, ARR rain gauges, pumps, floodgates and reservoirs, flood-risk reference polygons joined to 2023 kelurahan population, and the situ inventory. This flood desk keeps published thresholds separate from the live, local-datum BBWS readings in the waterways lens. Unavailable feeds stay explicit states with official links.

## Boundary water budget · 23 October 2026

In `/atlas?lens=waterways`, open evidence → Rain → polder water budget. Select one of 64 valid DSDA boundaries, use a complete current hourly model-rain profile or explicitly choose a test storm, then change the assumed pumping/runoff. The account shows hourly water to store or drain, a zero-pump comparison, a readable table and a reproducible JSON export. Available space starts unknown; it is a comparison threshold, never a flood-depth estimate.

The offline join uses original DSDA polygons for metric area and native WorldCover 2021 pixel centres for land context, retaining holes. One invalid boundary is excluded and one original-boundary overlap pair is recorded; scenarios cannot be summed into a city total. Display geometry is separately simplified. `npm run prepare:polder-budget` reproduces the derived reference; `python3 scripts/prepare-polder-budget.py --check` rechecks it without writing. Raw hashes, algorithms, attribution and exclusions travel with the product. Land cover does not set a runoff coefficient. No terrain, tide, river exchange, calibrated drainage or measured pump/storage capacity is implied. See [the audit](docs/POLDER-BUDGET-AUDIT-2026-10-23.md).

## Local preparedness references · 25 October 2026

Inside the polder water budget, open **Preparedness · reference locations**. The original DSDA boundary selects published health/school reference points. Search and page the list, select a name to centre its point (with red WGS84 coordinates), or export all boundary records as CSV and a JSON preparation brief. The list works independently of current rainfall. Changing boundaries or lenses removes its markers/readout.

The reproducible join retains 1,990 distinct public records inside valid polders: 312 health and 1,678 school records. Exact duplicate source records (140 health / 627 school extras) are merged with source row indexes retained; different names at one coordinate remain separate. These are source records, not a verified census of operating facilities. Sources were retrieved 11 October; observation dates and operating/shelter capacity remain unknown. Rounded positions near boundaries require field verification. `npm run prepare:preparedness` exercises hole/edge/multipart fixtures and rebuilds; `python3 scripts/prepare-polder-facilities.py --check` reproduces without writing. [Read the audit](docs/PREPAREDNESS-CONTEXT-AUDIT-2026-10-25.md).

## Water context acquired · 15 October 2026

The waterways evidence panel now includes an independent BMKG Tanjung Priok coastal forecast and an optional ESA WorldCover 2021 land-cover overlay. Tide and wave heights retain their forecast times and metre units; the unknown vertical datum prevents a river/terrain join. WorldCover is a 10 m historical classification, displayed at 20 m using nearest-neighbour sampling, with full-native cell composition in a mainland rectangle. Built-up is not measured impermeability; permanent water is not current flood extent. Full publisher attribution, raw crop, checksums and reproduction scripts are retained.

`/api/atlas/coastal` validates one fixed anonymous BMKG port feed with time, size and row bounds and explicit outages. `npm run prepare:landcover` regenerates WorldCover assets offline from the hash-checked acquired crop; `-- --fetch` explicitly refreshes it. The Research ledger has 57 contracts; public river/rain readings with contradictory UTC/WIB timestamps remain a candidate. Detailed acquisition receipts are in `docs/WATER-CANDIDATE-PROBES-2026-10-15.md` and `docs/TERRAIN-SATELLITE-PROBES-2026-10-15.md`. A distinct live Depok southern-route capture replaces reliance on the reported duplicate evidence, without changing route geometry or claiming calibrated flow.

## Map insight lenses

The map carries four lenses beside the weather and satellite ones, each one tap from the page people land on. All four compute from assets already baked here — `npm run prepare:insight` makes no network call, so a new view never becomes a new claim.

- **Flood exposure** — the 260 flood-mapped neighbourhoods shaded by the share of their own land in the heavy class, listed by residents on severe land. A neighbourhood counts its residents once no matter how many risk polygons it has, and no city-wide total is offered. Top of the list: Kapuk, Duri Kosambi, Pejagalan, Rawa Buaya, Tegal Alur, Semanan.
- **Height confidence** — the building extrusion recoloured by height *source* instead of height, with the share of buildings on screen in each tier. Bright is tagged or published; dim is a type default with no measurement and no satellite signal.
- **Green space** — reference polygons aggregated per borough, with the area labelled as computed from published geometry rather than a publisher total. Rows that name no borough and no neighbourhood are counted, not spread.
- **Flood monitoring** — published stations, gauges and pumps, and the gap beside them: 106 of the 260 mapped neighbourhoods have a published pump. Water-level and rain records publish no neighbourhood, so they are never attributed to one by inference.

Risk classes, station inventories and green polygons are official reference data, not live observations. A neighbourhood with nothing published in them is not a cleared neighbourhood.

## Local design and citizen services

Palette/Wada plate 267 supplies a documented warm/cool relationship, adapted into dark coastal, city-daylight and high-contrast modes. The current typography uses the owner-selected CTAN Universa display face and Source Sans 3 for functional text and reading. The earlier Tokotype exploration, actual palette tokens, contrast proof and local source evidence remain recorded in `docs/JAKARTA-DESIGN-AND-CRM.md`. Source/period text is larger; scientific layer legends keep their own semantic colours.

The citizen-services section links to CRM's official daily, monthly, kelurahan and map destinations. Its monthly Looker viewer loads only when selected, keeps the publisher's period/filter controls and can be closed without remounting the city map. A direct report link is available above the viewer. No report submission or citizen identity/photo collection occurs here, and no CRM totals are converted into local live readings.

## New dashboard data

- `npm run prepare:data`: fetch and validate TransJakarta GTFS and selected Jakarta Satu public fields. Outputs versioned JSON under `public/data/jakarta-v1`, including a checksum, publisher, retrieval time, CRS and simplification record. No resident data or staff/editor fields are included.
- `/api/jakarta/weather`: bounded five-location official forecasts, cached 30 minutes.
- `/api/jakarta/alerts?lang=id|en`: BMKG RSS plus bounded official CAP detail requests, cached three minutes. Expired/cancelled/test warnings do not appear as active.
- `/api/jakarta/earthquake`: latest national official event, not necessarily near Jakarta.
- `/api/jakarta/flood-reports`: one-hour report count only. An empty result does not establish dry streets. PetaBencana's non-commercial/commercial distinction applies.
- Existing `/api/atlas/*`, building tiles and waterways remain available.

- `npm run prepare:flood`: bake the Jakarta Satu flood-desk network — AWLR/ARR stations with SIAGA thresholds, pumps/floodgates/reservoirs, situ, risk polygons and kelurahan population — into versioned assets under `public/data/jakarta-v1`, with DKI-bbox quarantine and access-state records for unreachable sources.
- `npm run prepare:ciliwung`: bake the OSM Ciliwung corridor (river/canal ways through shared node IDs, published admission gates) into `public/data/jakarta-v1/ciliwung-{route.geojson,manifest.json}` for the water-arrival lens; raw Overpass capture retained as evidence.
- `npm run prepare:ispu`: bake the Satu Data Jakarta official ISPU CSV export (daily SPKU measurements, five stations, DKI1–DKI5) into a dated monthly reference at `public/data/jakarta-v1/ispu-reference.json`, with the raw export retained under `data/source-evidence/`.
- `npm run release` runs the full local gate (typecheck, verify, every test suite), stamps dashboard/atlas assets, deploys the existing Worker with its R2 binding and custom domain, and checks the exact deployed bytes plus provider envelopes. It refuses to deploy an uncommitted tree, so deployed bytes always trace to a commit. Do not deploy from the old atlas repo to this Worker.

Civic datasets publish no observation epoch or explicit dataset license in the inspected service metadata; the ledger labels their attribution/access limitation. GTFS is CC BY 4.0, normalized/simplified here; service calendars and selected representative trips are scheduled records. Official ISPU now ships as a dated monthly reference from Satu Data Jakarta (five SPKU stations, latest batch labelled, not live). BPS statistical baselines, subsidence, live vehicles and congestion remain unconnected. The independent BMKG Priok tide forecast is connected; its unknown vertical datum prevents a join to river levels or terrain.

---

# JKTx 3D Atlas — Jakarta, block by block

Live: **https://jakarta.nonarkara.org** (also https://jakarta-3d-atlas.drnon.workers.dev)

A Bahasa Indonesia / English 3D atlas of Jakarta, ported from
[hcmc-3d-atlas](https://github.com/Nonarkara/hcmc-3d-atlas). Every building
footprint in DKI Jakarta at a height in real metres, with the source of that
height one tap away; OpenStreetMap rail and waterways; and dated open
environmental layers (rain radar, NASA surface water and aerosol, Himawari
clouds, Open-Meteo rain and air quality, GDACS storms).

## How the city is built

| Layer | Source | Script |
|---|---|---|
| Building footprints | Overture Maps (Microsoft ML, Google Open Buildings, OSM) | `scripts/bake-buildings.py extract` |
| Building heights | OSM tags → floor count × 3.3 m → Google Open Buildings 2.5D (2023, per building) → GHSL (2018, 100 m average) → type default | `scripts/bake-buildings.py heights` + `bake` |
| Landmarks | OSM outline / parts, published heights (Autograph Tower, Monas) | `scripts/curate-landmarks.py` |
| Rail | OSM route relations: MRT, LRT Jakarta, LRT Jabodebek, KRL | `scripts/bake-osm-layers.py rail` |
| Rivers and canals | OSM `waterway=river|canal` | `scripts/bake-osm-layers.py waterways` |

Heights are never scaled. Satellite heights are capped at
max(6 m, 4 × √footprint area) so a sliver cannot stand as a pole. Each building
carries `hs` (height source) and `src` (footprint source); the inspect card
shows both.

## What is not here, on purpose

No TransJakarta positions, street congestion, flood sensors or land-subsidence
data: no open live source is wired in, and the atlas does not stand in fake
ones. The city-watch strip says "Congestion is not measured" rather than
showing a colour.

## Run

```bash
npm install
npm run verify && npm run typecheck && npm test
npx wrangler dev                                    # local; seed the preview bucket first
npm run release                                     # the only deploy path: gates, deploy, byte checks, live smokes
```

Rebuilding data (one-off, ~30 min, network heavy):

```bash
npm run bake:osm
npm run bake:buildings
npx wrangler r2 object put jakarta-tiles/buildings/jakarta-v1.pmtiles --file out/jakarta-buildings.pmtiles --remote
npx wrangler r2 object put jakarta-tiles/buildings/jakarta-waterways.pmtiles --file out/jakarta-waterways.pmtiles --remote
```

Bump the R2 key (`jakarta-v2`) and `PMTILES_R2_KEY` in `src/index.ts` when
re-baking, so no edge cache serves the old archive.

## Data and rights

Footprints © Overture Maps Foundation contributors (OSM ODbL, Microsoft ODbL,
Google CC BY 4.0). Heights: Google Open Buildings 2.5D Temporal (CC BY 4.0),
GHSL GHS-BUILT-H R2023A (EC JRC, CC BY 4.0). Rail, waterways and landmarks
© OpenStreetMap contributors (ODbL). Imagery Esri World Imagery. Weather and
air quality Open-Meteo / CAMS (CC BY 4.0, non-commercial free tier). Radar
RainViewer. Satellite layers NASA GIBS / LANCE and JMA Himawari. Storms GDACS.
See `THIRD_PARTY_NOTICES.md`.

## Integrated design rules · 18 October 2026

`AGENTS.md` and `docs/ANTI-SLOP-DESIGN.md` adopt the owner-supplied seven-rule design standard. `npm run audit:design` runs inside the full test and release gate; it checks objective layout/font contracts and Research loading/unknown states. Responsive screenshots and an independent visual review remain mandatory. Research now uses the city’s two font families and Palette 267, a compact contents row, unboxed metrics, sequential calculations and an optional wind animation. All existing sections, source tables, canvases and map lenses remain. Release byte checks include the Research route, client, label placement module, shared theme and dashboard CSS.


## Haze evidence · 19 October 2026

Open `/atlas?lens=haze` for 6/12/24-hour NOAA-20 hotspot screening, acquisition-age bars, ranked 0.5° cells, measured Singapore NEA regional PM2.5, on-demand ASMC situation/forecast graphics and JSON export. Visible evidence refreshes every five minutes; hiding the tab retires its field and returning fetches again. Map filtering and counts share the admitted selection. Wind trajectories retain their own 24-hour seed controls and Java grid limits. ASMC issue times remain printed on the graphic; no numeric raster concentration or transboundary source attribution is inferred. Details and limitations: `docs/HAZE-PLAN-2026-10-19.md`; source ledger has 60 contracts (41 integrated). `node scripts/smoke-haze.mjs` checks both healthy feeds and explicit outages.
