# Jakarta city dashboard

Live: **https://jakarta.nonarkara.org** · complete atlas: **https://jakarta.nonarkara.org/atlas**

Private repository: https://github.com/Nonarkara/jakarta-dashboard. The original atlas history and documentation below are retained. Deploy this repository for the main domain; the separate atlas repository remains a source archive and should not overwrite the dashboard Worker.

The Bahasa Indonesia / English dashboard follows the HCMC observation–map–bulletin arrangement, with Jakarta's Palette 267 coastal/green/yellow relationship and self-hosted Plus Jakarta Sans. It adds five official BMKG kelurahan forecasts, dated weather warnings for DKI/Jawa Barat/Banten, the latest Indonesia earthquake, PetaBencana report counts, searchable official TransJakarta scheduled routes and stops, and dated Jakarta Satu health/school reference points. Source, tier and time remain visible; missing inputs never become a safety claim.

Search a route and select it to draw the scheduled alignment. Select a stop or civic facility to locate its reference point. Language/theme changes retain the same map instance. The forecast chart has a complete text table. Export evidence JSON for source payloads and selected geometry. The complete atlas retains all building, environment, inspection and navigation controls.

The Banjir / Flood desk popup couples those live signals with the dated Jakarta Satu monitoring network: AWLR water-level stations with official SIAGA 1–4 alert thresholds grouped by river, ARR rain gauges, pumps, floodgates and reservoirs, flood-risk reference polygons joined to 2023 kelurahan population, and the situ inventory. No live water level is shown anywhere; stations publish thresholds, not readings, and unavailable feeds stay explicit states with official links.

## Local design and citizen services

Palette/Wada plate 267 supplies a documented warm/cool relationship, adapted into dark coastal, city-daylight and high-contrast modes. Plus Jakarta Sans is the city-commissioned Tokotype family, self-hosted under OFL 1.1. The font, actual tokens, contrast proof and local source evidence are recorded in `docs/JAKARTA-DESIGN-AND-CRM.md`. Source/period text is larger; scientific layer legends keep their own semantic colours.

The citizen-services section links to CRM's official daily, monthly, kelurahan and map destinations. Its monthly Looker viewer loads only when selected, keeps the publisher's period/filter controls and can be closed without remounting the city map. A direct report link is available above the viewer. No report submission or citizen identity/photo collection occurs here, and no CRM totals are converted into local live readings.

## New dashboard data

- `npm run prepare:data`: fetch and validate TransJakarta GTFS and selected Jakarta Satu public fields. Outputs versioned JSON under `public/data/jakarta-v1`, including a checksum, publisher, retrieval time, CRS and simplification record. No resident data or staff/editor fields are included.
- `/api/jakarta/weather`: bounded five-location official forecasts, cached 30 minutes.
- `/api/jakarta/alerts?lang=id|en`: BMKG RSS plus bounded official CAP detail requests, cached three minutes. Expired/cancelled/test warnings do not appear as active.
- `/api/jakarta/earthquake`: latest national official event, not necessarily near Jakarta.
- `/api/jakarta/flood-reports`: one-hour report count only. An empty result does not establish dry streets. PetaBencana's non-commercial/commercial distinction applies.
- Existing `/api/atlas/*`, building tiles and waterways remain available.

- `npm run prepare:flood`: bake the Jakarta Satu flood-desk network — AWLR/ARR stations with SIAGA thresholds, pumps/floodgates/reservoirs, situ, risk polygons and kelurahan population — into versioned assets under `public/data/jakarta-v1`, with DKI-bbox quarantine and access-state records for unreachable sources.
- `npm run deploy:live` runs the full local gate (typecheck, verify, every test suite), stamps dashboard/atlas assets, deploys the existing Worker with its R2 binding and custom domain, and checks the exact deployed bytes plus provider envelopes. Do not deploy from the old atlas repo to this Worker.

Civic datasets publish no observation epoch or explicit dataset license in the inspected service metadata; the ledger labels their attribution/access limitation. GTFS is CC BY 4.0, normalized/simplified here; service calendars and selected representative trips are scheduled records. DLH measured-air, BPS statistical baselines, tides, subsidence, live vehicles and congestion remain unconnected.

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
npx wrangler dev --compatibility-date 2026-05-22   # local; seed the preview bucket first
npm run deploy                                      # stamp build id + wrangler deploy
node scripts/smoke-atlas.mjs && node scripts/smoke-atlas-api.mjs
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
