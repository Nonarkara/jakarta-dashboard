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
