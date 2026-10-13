# Jakarta: robustness, river and air research release

13 October 2026. Read-only audit against `df40556`. Implementation pending the alignment gate. Existing version, dedication, maps, charts, bilingual interface, compact chrome and source records remain protected.

## Audit findings

Robustness investigator: `robustness_audit`; source/simulation investigator: `data_simulation_research`; Research/design investigator: `research_design_audit`. The parent assembled this scope. No application code changed during this audit.

| Priority | Demonstrated problem | Proposed correction |
|---|---|---|
| P1 | `src/hydrology.ts:36–41`: a cache-write failure turns successfully fetched data into HTTP 503; a cache-read failure escapes the handler. | Treat cache reads/writes as optional infrastructure; preserve valid fetched data. Separate cache faults from publisher faults. |
| P1 | `cleanGauge` accepts a 2020 reading as usable in 2026. | Preserve dated evidence, add explicit fresh/stale/unknown state, and count only fresh valid levels as current. Publish the freshness policy. |
| P2 | Total hydrology outage returns HTTP 200 and is cached for five minutes; successful malformed responses still set availability flags. | No valid data: 503/no-store. Partial valid data: show the usable branch plus its source-specific failure state. Separate HTTP access from validated availability. |
| P2 | Central scenario stop resets playback text but leaves `aria-pressed=true`. | Reset both state and label; test scrub, finish, visibility pause and lens exit. |
| P2 | Existing uncommitted test calls top-level `window.dispatchEvent` instead of `context.window.dispatchEvent`. | Preserve the other agent's assertions and make the one-line correction. Corrected source passed in-memory execution. |
| P2 | Observation client fetch has no timeout/cancellation. | Bound requests, cancel them on exit, preserve epoch guards, and show retryable failure. |
| P2 | Research opens on projects and omits the newer river/gauge/camera inventory and source terms. | Open on the system explanation; preserve all six topics and computed charts; derive counts/dates from manifests. |
| P2 | English risk chart leaks Indonesian class labels; pump bar length represents a different measure from its printed ratio. | Translate display labels, preserve publisher identifiers; bar encodes the displayed coverage fraction. Presence is not capacity or operation. |

The suspected duplicate scenario controls were **not** confirmed: `lensPanelBody()` already clears the panel. No change is proposed for that behavior. Existing map request tokens and controller epoch guards remain.

Current checks: typecheck and 12/12 local verification passed. Investigator-run water/traffic, environment and Jakarta contract suites passed. The full working-tree test gate is still blocked by the incorrect test-global reference above; this audit does not claim it passed unchanged.

## Decision and conservation law

Ship one bounded release: reliability fixes, stronger Research, an extended mapped Ciliwung route, an air forecast timeline and a wind-transport illustration. Every displayed result keeps its source, tier, time and assumptions. Observations, predictions, reference inventories and what-if results remain distinguishable.

The flood scenario will become geographically better located, not a calibrated street-flood forecast. The air timeline uses published model concentrations; the moving wind marker does not calculate new concentrations. No fabricated channel connections, concentration plume, smoke attribution or terrain-based inundation extent.

## Implementation scope

1. **Reliability first.** Modify `src/hydrology.ts`, `public/water-traffic.js`, `public/app.js`, and the relevant contract/runtime tests. Use a stated trial gauge freshness ceiling of three hours, expose source age and retain older rows as dated/stale evidence. This is a product freshness policy, not a claim about the provider's service interval. Add cache-fault and malformed/partial/outage tests, request cancellation and correct playback accessibility state. Repair the existing test without discarding its additions.
2. **Research as the first explanation.** Modify `public/dashboard.html`, `public/official-data.js`, `public/dashboard.css`, `public/jakarta-design.css`, and `scripts/test-research-paper.mjs`. Select the existing paper topic by default. Add concise bilingual purpose/profile copy; preserve the numbered method, all four computed charts, project/history/report/legal/profile topics and source downloads. Add explicit model/scenario rows beside the existing evidence states. Update legal/source inventory and coverage semantics. No new permanent bar or large card grid.
3. **Mapped river corridor.** Add a bounded preparation script and versioned route/manifest assets, raw public source evidence and notices. Query OSM Ciliwung geometry beyond the current −6.4 latitude limit to include Katulampa and Depok. Construct a graph from shared source node IDs and admit only connected station-to-station paths within a published endpoint tolerance. Retain gaps and the labelled schematic fallback if a route cannot be verified. Modify the existing arrival lens to traverse admitted geometry by cumulative distance using the historical assumed timing; keep local gauge assumptions independent.
4. **Air and haze.** Extend the existing validated air/weather adapters through a small dedicated module if needed; route it through `src/index.ts`. Add a lazy client module and bilingual lens labels. Fetch a 48-hour PM2.5/PM10/dust/AOD timeline and matching wind timestamps. Show grid coordinates, model resolution, source age and valid time; deduplicate common CAMS cells. Add a user-started uniform-wind transport illustration: bearing is wind FROM +180°, distance is speed × elapsed seconds. Show precise red coordinates, no derived concentration or plume width, and stop on lens exit/hidden document. Preserve NASA aerosol and satellite-water comparison lenses.
5. **Source contracts and verification.** Update source notices, source catalogue/manifest metadata, context and live smoke asset checks. Add failure-oriented tests for fresh/stale/future data, unit/UTC/grid checks, time joins, cardinal wind direction/zero wind, route connectivity/no invented connectors, cancellation and playback cleanup. Commit → push → canonical release → exact deployed-byte checks → browser receipts.

New data-backed controls use the existing evidence panel; expanded controls keep the established reading gutter. The 23 px phone masthead, 24 px phone lens row, bounded map viewport and original interactive content remain.

## Ready public data

Anonymous probes by the source investigator on 13 October 2026:

- **CAMS/Open-Meteo air:** [48-hour endpoint](https://air-quality-api.open-meteo.com/v1/air-quality?latitude=-6.1754&longitude=106.8272&hourly=pm2_5,pm10,aerosol_optical_depth,dust&forecast_days=2&timezone=UTC), HTTP 200 and 48 records for 13–14 October. Returned grid −6.199997, 106.80002. PM/dust in µg/m³; AOD dimensionless. [Official documentation](https://open-meteo.com/en/docs/air-quality-api): CAMS global 0.4° (~45 km), native three-hourly forecast; hourly API output is interpolated and does not establish hourly independent observations.
- **Open-Meteo wind:** [48-hour endpoint](https://api.open-meteo.com/v1/forecast?latitude=-6.1754&longitude=106.8272&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&forecast_days=2&timezone=UTC), HTTP 200 and 48 matching timestamps; m/s and meteorological FROM degrees. Returned grid −6.151142, 106.8421. [Weather documentation](https://open-meteo.com/en/docs). Retain returned model/grid identity.
- Open-Meteo data: [CC BY 4.0 with attribution; free hosted service has a separate noncommercial condition](https://open-meteo.com/en/licence). Existing project service constraints remain visible.

**Next candidate, excluded from this first implementation scope:** [NASA FIRMS regional VIIRS CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv), HTTP 200, 2.16 MB, 26,457 records. It contained dates 11–12 October despite the endpoint's “24h” name. Nominal 375 m thermal detections are not confirmed wildfires or Jakarta pollution sources. Add only after exact reuse terms, dated freshness, parsing bounds and industrial-heat context are resolved. [NASA source](https://firms.modaps.eosdis.nasa.gov/active_fire).

[BMKG Urban Jakarta](https://iklim.bmkg.go.id/id/urban-jakarta/) is an official reference for PM2.5 forecasts and related context. Its referenced data endpoint returned 403 in the anonymous probe; keep an official link, not a claimed functioning adapter.

## Open-source methods

The source investigator searched GitHub before proposing new work. [Open-Meteo weather-map-layer](https://github.com/open-meteo/weather-map-layer) offers a relevant wind-arrow pattern; the bounded scenario does not require adding that dependency. [Deltares SFINCS](https://github.com/Deltares/SFINCS) and [HydroMT-SFINCS](https://github.com/Deltares/hydromt_sfincs) are a credible later hydraulic path, requiring terrain/bathymetry, discharge/tide boundaries, structures, friction and validation. Their existence supplies neither Jakarta calibration nor a safe browser model. Keep that later work offline and separately reviewed. Existing MapLibre/PMTiles, NASA/JAXA layers and the img2threejs evaluation are preserved.

## Research opening — proposed voice

English draft:

> I built this dashboard so you can read Jakarta through its data and check what each view can actually tell you.
>
> A water level belongs to a gauge. A forecast belongs to a time. A satellite image has a resolution. I keep those limits visible because putting them on one map does not make them the same measurement.
>
> Compare the evidence. Change the assumptions. See what follows—and keep the difference clear.

Bahasa Indonesia draft:

> Saya membuat dasbor ini agar Anda bisa membaca Jakarta melalui datanya dan memeriksa apa yang benar-benar bisa dijelaskan oleh setiap tampilan.
>
> Tinggi air berlaku di titik pengukurnya. Prakiraan berlaku pada waktunya. Citra satelit punya batas resolusi. Saya menampilkan batas-batas itu karena menyatukannya dalam satu peta tidak membuatnya menjadi pengukuran yang sama.
>
> Bandingkan buktinya. Ubah asumsinya. Lihat hasilnya—dan tetap bedakan keduanya.

These are proposed site copy, not historical quotations. Profile retains the already supplied DEPA role, ASCN work, four named supported cities, contact links and dedication. No added credential or endorsement. Existing legal non-affiliation statement remains.

## Release acceptance

- Demonstrated failure cases corrected; missing, stale or rejected data never becomes zero/all-clear.
- River motion stays on admitted connected geometry, otherwise explicitly schematic. No local datum transfer or arbitrary timing calibration.
- Air timeline and wind transport distinguish model output from scenario; wind direction is checked, time joins exact, unknown values remain unknown.
- Research ID/EN labels and figures agree; inventory is derived from source assets, unavailable inputs are labelled.
- Browser review at 390 px and desktop: precise reading edges, compact bars, map visibility, keyboard focus and source access retained.
- Canonical release gates and specific live interactions pass with saved visual receipts. Report partial/unavailable external sources plainly.

## Alignment gate

Approve this bounded scope before application code edits. The applied planning skill explicitly requires stopping for plan approval; that gate is the only reason this turn ends at a reviewed plan instead of a deployment.
