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
