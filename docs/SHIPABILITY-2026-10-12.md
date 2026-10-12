# Jakarta shipability audit · 12 October 2026

Scope: current private dashboard checkout, acquired assets, executed map lenses, historical source contracts, water scenario, release gates and live UI. Preserve version 1.0.0, the Kiki Yunita dedication, paper typography, all original layers and the bounded hero.

## Verdict

Pilot, with useful reference and observation overlays. Not a calibrated flood forecast. No acquired dataset supplies measured water speed, discharge, pump throughput, surveyed channel cross-sections, drainage connectivity or a suitable terrain model. No old GIF/flow simulation asset was found in either Jakarta checkout. The animation added here is an explicitly labelled preparedness scenario rather than recovered hydraulic work.

The supplied report matches commits 900aeea and 02a4220. The current paper-step row-span guard remains in the release gate. Its visual proof is checked alongside the new scenario, rather than taken from the report as evidence.

## Acquired datasets and what the user can read

| Data / provenance | Surface | Meaning and limit |
|---|---|---|
| Overture September 2026 footprints; OSM, Google 2023 and GHSL 2018 heights | City 3D, height confidence, Explore filters | Real metres; mixed provenance; simplified viewport counts, not census |
| OSM rail and waterways; Esri / OSM basemaps | City map / layer menu | Mapped geometry; no observed current or water speed |
| BMKG forecasts, CAP bulletins, quake | Weather, warnings, flood desk | Five kelurahan forecasts and regional/national notices; dates stay visible |
| CAMS / Open-Meteo five model samples | Air / rainfall evidence | Model estimates; US AQI differs from measured ISPU; upstream/browser fallback remains |
| Official ISPU monthly batches, 2024–November 2025 | Weather reference | Dated station measurements, never a live network |
| RainViewer, JMA Himawari, NASA GIBS, GDACS | Radar / cloud / observed & recurring water / aerosol | Product-specific date, resolution and coverage; no echo or cloud-obscured pixels cannot establish safety |
| PetaBencana reports | Flood desk / warnings | Last-hour citizen-report aggregate; empty reports do not mean dry streets |
| BPBD / Dinas SDA 12-station hourly table, 12 October 2026 09:00–15:00 WIB | Flood desk | Dated observation snapshot; signed one-hour local level changes in cm/h, not flow velocity; direct automatic fetch publisher-blocked |
| 28 AWLR / 56 ARR inventory | Flood desk / monitoring map | Station locations and official thresholds; no current sensor values |
| 263 pumps / 589 floodgates / 147 reservoirs | Monitoring map | Three distinct asset kinds, now distinct legend/paint; capacities and operation unknown |
| 1,900 risk polygons, 260 population joins | Exposure map / Research paper / flood desk | Historical/reference class mix and Semester 2 2023 population; area-weighted population proxy assumes uniform density, not people geolocated on severe land |
| 28 situ, published conditions | Flood desk | Inventory conditions, not measured retention capacity |
| 5,842 valid green polygons | Green-space lens / Civic selector | Reference inventory includes cemeteries, strips, undeveloped land; computed area is not official total or public-access claim |
| 240 GTFS routes / health & school inventories | Transit / Civic / selected overlays | Scheduled routes and reference facilities; no bus speed, live position or available capacity |
| 37 investment proposals / 154 annual flood-prone records | Research | Proposal stage and 2024 history; quarantined coordinates remain withheld |
| JSC planning & 2023 report / Bappeda 2045 vision | Research reports | Historical achievements and future targets are distinguished |
| CRM official report viewer and links | Citizen services | Publisher-hosted reports, not imported private complaints or copied live totals |

## Fixes

1. Monitoring geometry previously gave every row in the shared infrastructure file the same pump identity. Preserve all 999 features; assign Pompa, Pintu Air and Waduk & Embung distinct kinds, sizes and theme paints, with a matching legend. Failed inventory fetches now state which map input is absent.
2. The exposure colour is a weighted class mix (Ringan 1, Sedang 3, Berat 6), not severe share alone. Explain the actual calculation. Relabel the population ranking as an area-weighted proxy in both languages and explain its uniform-density assumption in the map and paper.
3. Add a lightweight Water arrival scenario / Skenario kedatangan air lens. Katulampa → Depok → Manggarai uses published station coordinates. Approximate historical BPBD travel-time guidance is 3 + 6 hours; factor 0.5–2 changes the assumed duration to 4.5–18 hours. A separate user-controlled local gauge level/rise does not transfer heights between station datums. No flood polygon, street depth or warning is generated.
4. Keep exact published station coordinates in red text, WGS84, six decimals. Display precision is not a claim of survey accuracy. Station-to-station dashed segments and the interpolated marker are explicitly schematic, not river geometry.

5. Direct switches between insight lenses previously retained prior risk/green/station layers and confidence paints. Clear the previous lens before building the next; runtime tests now cover direct transitions as well as returning to city view.

6. Put embedded evidence context and controls in a single bounded popup; long bilingual headings no longer overlap the body. Monitoring point selection shows its published name and WGS84 coordinate in red.

7. Preserve map-ready status through language switching; fit the three-station scenario with enough bottom clearance for published labels above the retained quick-jump controls.
8. Replace a fixed post-deploy sleep with bounded exact-byte convergence (three consecutive canonical probes, then three custom-domain probes). Disposable probe keys prevent early checks from using the real release cache key. The new verifier was executed against the current live build and both hostname streaks passed.

9. Import the BPBD public hourly table as a reproducible dated snapshot: 12 stations × 7 hours, including negative local datums and signed hourly changes. Current machine requests receive security-block HTML, while the public web reading surfaced the publisher table dated 12 October at 15:00 WIB. This corrects the earlier absolute claim that no public readings exist. The UI says the automatic feed is not verified and never applies unmatched Jakarta Satu catalogue SIAGA bands to BPBD values.

## Sources and access

[BPBD preparedness guide, 2021](https://bpbd.jakarta.go.id/data/files/perpustakaan/2021/11/11/30/163662760561-buku-saku-panduan-kesiapsiagaan-menghadapi-banjir-bagi-masyarakat.pdf) publicly indexed the 3-hour Katulampa–Depok and 6-hour Depok–Manggarai guidance during this audit. Direct PDF requests returned the publisher's security-block HTML, not a PDF. The UI discloses this access state; no PDF capture or current timing calibration is claimed. The independent official [Korlantas report](https://korlantas.polri.go.id/intensitas-hujan-tinggi-katulampa-siaga-1/) is publicly indexed with BPBD's approximate 6–9-hour end-to-end guidance; its direct web fetch timed out. Historical timing is a preparedness illustration only.

Coordinates and bands are copied exactly from the existing, dated Jakarta Satu monitoring capture, retrieved 11 October 2026 23:47 UTC. The new scenario JSON records these sources and limitations. Previously reversed public Jakarta Satu patterns remain credited; no proprietary 3D assets were copied.

## Verification

Runtime tests exercise station endpoints, separate segment durations, arrival clamping, variable factor, local negative gauge datum, actual MapLibre sources/layers and cleanup on exit. Monitoring tests reconcile 263/589/147 distinct geometry categories. Existing paper grid protection and all other contract suites remain in the canonical release. Browser proof and final release identity are recorded after live verification below.

## Final release receipt

Application source: `4e56575` (preceding map/scenario fixes `62f7e4e`, readiness/convergence `06e0049`, theme legend `b0ec430`). Build: `jakarta-atlas-20261012-1791797612-4e56575`. Worker version: `affd8ec4-f54f-4351-860b-e9b1d8c2749d`. Repository remains private.

Canonical `RELEASE_AGENT=codex npm run release`: typecheck, 12 local checks, full contract test chain, deployment, three consecutive exact-byte probes on the Worker hostname and then the custom domain, atlas smoke, 14/14 API checks (no hard failures), dashboard smoke including exact BPBD snapshot bytes. All green. The first earlier release attempt caught stale atlas bytes during propagation; that red gate was not called success. The fixed convergence step passed on subsequent canonical releases.

Browser proof: desktop 1280×800 and phone 390×844 have equal client/scroll dimensions, so no outer page bleed. Evidence popup headings/controls share one bounded scroll region. Live map shows published station names and red WGS84 locations; a monitoring-point tap returned a reservoir identity and its coordinates. Scenario playback, elapsed-time scrubbing, factor change, local gauge change, Bahasa/English switching, ready-status preservation and return to city view were exercised. The reported paper-step layout is readable at 390px in light, dark and contrast; five steps and three original states remain. Final BPBD table has all twelve rows and retains negative datum and falling-level signs in both languages.

The reused browser tab retained five unattributed MutationObserver `observe(Node)` errors spanning earlier local/reload navigations. They did not reproduce in a fresh final-build tab after map readiness and complete BPBD table rendering (fresh error log empty). This receipt does not claim a universal absence of browser errors.

Visuals: `WATER-SCENARIO-LIVE-2026-10-12.jpg` (final build), `WATER-ROUTE-LIVE-2026-10-12.jpg`, `WATER-SCENARIO-PHONE-LIVE-2026-10-12.jpg`, `MONITORING-LOCATION-LIVE-2026-10-12.jpg` (same map implementation before the BPBD import), `BPBD-WATER-PHONE-LIVE-2026-10-12.jpg` (final observation table), and `PAPER-VERIFIED-{LIGHT,DARK,CONTRAST}-2026-10-12.jpg`. Viewport override reset; live root left in Bahasa on the city overview.

Remaining boundary: hourly BPBD table is manually captured and dated, not an automated live feed. Historical travel timing plus user assumptions are not calibrated hydraulics. No discharge/flow velocity, reconciled gauge datums, terrain, tide series, surveyed channel cross-sections, drainage connectivity or pump capacity has been acquired for a street-level inundation model. OSM waterways remain available as mapped reference geometry. Original source observation gaps and coordinate quarantines remain visible.
