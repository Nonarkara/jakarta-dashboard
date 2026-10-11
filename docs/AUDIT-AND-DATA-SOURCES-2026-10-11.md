# Jakarta atlas: code audit and public data opportunities

Checked 11 October 2026, Asia/Bangkok. Scope: Jakarta repository at `c2b00fb`, deployed `https://jakarta.nonarkara.org`, the original HCMC atlas, and selected HCMC dashboard ingestion/API files. This is an audit and source investigation; application behavior has not been changed.

## Assessment

The atlas is a working public research demo. It preserves the HCMC map engine, per-building height categories, bilingual controls, dated satellite products and explicit model labels. Jakarta-specific feeds can make it substantially more useful without inventing risk scores, congestion or vehicle positions. The largest gap is local observations and official warnings, rather than the map renderer.

The original port removed VNTT sensors, simulated buses, HCMC incident/scoreboard proxies and sketched flood areas. That was appropriate: those records cannot become Jakarta observations by changing coordinates. The Jakarta build currently uses Overture/OSM, Google building heights, GHSL, Esri, Open-Meteo/CAMS, NASA GIBS, JMA imagery, RainViewer and GDACS. It does not yet integrate Indonesian government data.

## Verification

- `npm run verify`: 12/12 passed; `npm run typecheck`: passed; `npm test`: all six suites passed.
- `node scripts/smoke-atlas.mjs`: all checks passed, including both PMTiles archives and Range/CORS behavior.
- `node scripts/smoke-atlas-api.mjs`: 14/14 passed with no provider warnings on this run.
- `npm audit --omit=dev --json`: zero reported production dependency vulnerabilities. This covers npm packages, not a complete security audit or the separately vendored MapLibre runtime.
- Live browser inspection showed the loaded 3D buildings and rail on a narrow viewport, with Bahasa Indonesia controls and the public-demo label. Full keyboard, desktop and multi-device interaction testing was not performed.
- Live health reported the building archive present, 124.65 MiB. Weather and air were available at all five sample points; current weather valid time was `2026-10-11T06:15Z`. Surface water and aerosol dates were 10 October, satellite rain 9 October, Himawari `2026-10-11T05:30:00Z`, and radar had 13 frames.
- The documented Open-Meteo Worker failure did not occur during this audit. Keep browser fallback: one successful interval does not establish that shared-egress throttling is fixed.

Probe evidence is saved beside this report in `SOURCE-PROBES*.json`. Each request records its URL and UTC check time. HTTP 200 is separated from valid payloads and from usable observations. Counts below are service-wide counts at check time, not audited coverage, unique facilities or a current census.

## Code findings

### P2: Air-quality responses do not enforce UTC

`src/index.ts:537` and `src/index.ts:617` check freshness and coordinates but omit `utc_offset_seconds === 0`. `normalizedUtc` then appends `Z` to timezone-free provider strings. Rainfall enforces the offset; air quality does not. The browser air paths have the same omission.

Reproduced against the transpiled Worker with fresh, correctly located synthetic provider rows: both `utc_offset_seconds: 0` and `utc_offset_seconds: 25200` returned HTTP 200 with five accepted AQI rows. The existing air tests even omit offset metadata. A non-UTC response can therefore be relabeled as UTC and misrepresent age. Require explicit zero offset in every air adapter, and test missing/nonzero offsets. This is a boundary-validation defect; today's real response was requested with UTC.

### P2: Location gates allow a sample roughly 44 km away

`src/index.ts:468`, `src/index.ts:539` and `src/index.ts:619` allow a difference of 0.5 degrees on each axis. The browser adapters use the same tolerance. That exceeds the atlas's north–south span and can accept a nearby wrong city or shifted multi-location response. A Worker reproduction moved every air row 0.4 degrees north; all five rows were accepted and output under the requested Jakarta sample coordinates.

Define allowed displacement using the provider's documented grid/returned coordinates and actual distance. Retain the returned grid location and displacement for air as weather already does. Do not arbitrarily force exact coordinate equality: gridded models legitimately snap requests to cells.

### P2: Building records cannot be traced back to their source identity

`scripts/bake-buildings.py:101` takes only `sources[1].dataset`. The emitted properties at line 280 omit the Overture ID, source record IDs, release and observation dates; Tippecanoe generates new IDs. `hs=measured` identifies an upstream height tag, not verified survey accuracy. This is enough for exploratory rendering but insufficient for reproducible per-building evidence or stable selections across rebakes.

Preserve Overture identity and source provenance in a compact property or a sidecar manifest. Publish release/build timestamps and height-product epochs. Call tagged heights tagged, unless a survey source is independently established. The 2023 Google and 2018 GHSL values must remain dated estimates.

### P2: Mainland bounding box is not an administrative boundary or a catchment

The extraction uses a rectangle and requires complete footprints inside it (`scripts/bake-buildings.py:92`). It includes neighboring urban fabric, omits border-crossing footprints, and excludes Kepulauan Seribu. The UI counts describe the processed rectangle, not a DKI building census. District API records are explicitly approximate centroids.

Use versioned administrative polygons for DKI statistics, and a separate Jabodetabek/upstream catchment extent for water monitoring. Katulampa and Depok are relevant upstream locations outside the current map's city gate; do not discard their hydrological evidence merely because they are outside DKI.

### P3: Health and provider diagnostics are incomplete

`src/index.ts:650` checks only the building archive. Missing waterways or environmental outages can coexist with `ok: true`; version remains `0.1.0` rather than the stamped release. `fetchEnvironmentProvider` catches upstream errors without retaining their status or reason. Treat this endpoint as liveness, or add separately named archive/feed health states and build identity. Retain bounded diagnostics for 429/503/timeouts without turning missing readings into zero.

### P3: Embedding is not ready for a separate Jakarta dashboard

`src/index.ts:675` sets `frame-ancestors 'self'`, while the client has a parent-message bridge. Cross-origin embedding will be refused. Before adding an HCMC-like shell, choose its actual origin, allow that exact origin in CSP and message validation, and test the deployed iframe. There is no separate Jakarta shell in this repository today.

## Indonesian sources: usable now and conditional

Access categories: **open endpoint** means anonymous machine access observed; **public download** means a published file; **semi-open** means public viewing or registered/requested access, with unresolved automation or redistribution conditions. None implies an SLA.

| Source and publisher evidence | What it adds | Observed access and limits | Recommended use |
|---|---|---|---|
| [BMKG forecasts](https://data.bmkg.go.id/prakiraan-cuaca/) | Kelurahan/desa forecasts: temperature, humidity, wind, cloud and weather descriptions in ID/EN | JSON HTTP 200, CORS `*`, no key; three days at three-hour intervals, updated twice daily; 60 requests/min/IP; attribution required | First addition. Cache a bounded set of verified `adm4` locations. Distinguish issued time from forecast-valid time. |
| [BMKG weather CAP](https://data.bmkg.go.id/peringatan-dini-cuaca/) | Official nowcast alerts with affected polygons, urgency, severity, certainty and expiry | RSS HTTP 200; no CORS header in probe, so fetch through Worker; 60 requests/min/IP; attribution required | Put official warnings ahead of atlas-derived notices. Handle updates/cancellations/expiry and DKI plus upstream polygons. |
| [BMKG earthquakes](https://data.bmkg.go.id/gempabumi/) | Latest event, felt events, M5+ list, shakemap reference | `autogempa.json` HTTP 200, CORS `*`, no key; updates on events; 60 requests/min/IP | Regional context, with felt intensity when provided. Latest event is not necessarily near Jakarta. BMKG's coordinate string is latitude then longitude; convert to GeoJSON order. |
| [TransJakarta official GTFS license](https://ppid.transjakarta.co.id/informasi/berkala), [ZIP](https://gtfs.transjakarta.co.id/files/file_gtfs.zip) | Routes, stops/platforms, shapes, service calendars, stop times, frequencies and fares | ZIP HTTP 200; 240 route rows and 8,091 stop rows; CC BY 4.0 explicitly stated by operator; no CORS header. `agency_timezone=Asia/Jakarta`; no `feed_info.txt` in the checked archive | Download on a schedule, validate and bake geometry. Store checksum/retrieval time and calendar coverage. Stops include platform/direction records. This is scheduled service, not actual bus movement. |
| [Jakarta Satu ArcGIS catalog](https://jakartasatu.jakarta.go.id/server/rest/services/JakartaSatu?f=pjson) | Government roads, transport, facilities and green space | Anonymous catalog/services available; CORS reflected atlas origin. Six layer count queries returned valid results; two other services returned ArcGIS error 500 inside HTTP 200 | Use public planning layers after checking per-layer rights and metadata; validate error bodies, pagination and CRS. Exact endpoints below. |
| [Satu Data Jakarta](https://satudata.jakarta.go.id/open-data/detail/data-kejadian-bencana-banjir), [official portal description](https://www.jakarta.go.id/satu-data) | Flood history, ISPU, population, waste and sector statistics | Public dataset page HTTP 200. This audit did not prove a stable export/API resource; do not assume CKAN or invent a download URL | Obtain dated CSV/XLSX exports and bake snapshots. Preserve dataset ID, publisher, reporting period and update time. |
| [Udara Jakarta](https://udara.jakarta.go.id/), [terms](https://udara.jakarta.go.id/ketentuan-layanan) | Official station observations, locations and historical air trends, including SPKU and LCS | Public site HTTP 200; no documented public API established. Terms distinguish viewing from reproduction/distribution and require permission for the latter | Semi-open: request an approved station feed/export through DLH/PPID. Keep SPKU and low-cost sensors distinct. Keep Indonesian ISPU separate from US AQI. |
| [PetaBencana reports](https://docs.petabencana.id/routes/laporan-urun-daya), [gauge documentation](https://docs.petabencana.id/routes/pemantauan-tma) | Crowdsourced flood evidence and documented gauge observations | Current `api.petabencana.id/reports` HTTP 200 with CORS `*`, empty result; gauges HTTP 200 with empty topology despite requested GeoJSON. Legacy `data` host gauges/reports also empty. Legacy flood polygons HTTP 500; current-host flood request HTTP 400 | Candidate feed, not proven active gauge coverage. Reports default to last hour. Supply identifying User-Agent; validate geometry and coverage; store observation time. Empty reports mean no reports returned. |
| [PetaBencana license](https://docs.petabencana.id/informasi-lisensi-data) | Rights for the preceding feeds | Free attributed non-commercial use under CC BY-NC 4.0; commercial use follows a separate agreement | Record this distinction before institution/commercial redistribution. Archive/protected routes need publisher-issued access. |
| [BPBD public information](https://bpbd.jakarta.go.id/ppid) | Official disaster records, water-gate status and agency validation route | Public site was blocked by a government filtering page in web retrieval; machine API not established here | Semi-open: BPBD/PPID or Smart City agreement for stable TMA/pump/flood-event feeds. Do not scrape private JAKI endpoints or claim a sensor network is wired. |
| [BNPB ArcGIS](https://gis.bnpb.go.id/server/rest/services), [InaRISK](https://inarisk.bnpb.go.id/) | Historical Jakarta flood mapping, hazard/risk context, disaster-event services | Anonymous REST catalog HTTP 200 with reflected CORS; `Banjir_Jakarta_2020`, `inarisk`, `Kelas_Banjir` and weekly-event services listed. Layer queries/epochs/rights not yet validated | Dated planning context. Historical inundation and modeled hazard must be separate from current flood reports. |
| [BIG DEMNAS](https://www.big.go.id/content/product/demnas), [ImageServer](https://geoservices.big.go.id/raster/rest/services/DEMNAS/DEM_Indonesia/ImageServer?f=pjson) | National terrain for coastal/drainage context | Anonymous image-service metadata HTTP 200; reflected CORS; WGS84 with declared vertical coordinate reference. Pixel spacing approximately 0.000075 degrees | Check export access, terms, terrain accuracy and vertical datum before baking. A DEM alone cannot establish present flood depth or current subsidence. |
| [BIG tide service](https://srgi.big.go.id/tides/panj), [BMKG marine weather](https://www.bmkg.go.id/cuaca/maritim) | Coastal and port context | Public publisher pages found; a Jakarta station feed and redistribution terms were not verified | Semi-open follow-up for rob/coastal flooding. Tie levels to a named station and vertical datum. |
| [BPS API access guide](https://ppid.bps.go.id/upload/doc/LW11_BPS_WEBAPI_1647413405.pdf), [BPS Jakarta](https://jakarta.bps.go.id/) | Population, density, poverty, economy and administrative statistics | Public publications/tables; API registration and key documented by BPS. No key created or API data pulled | Prefer dated published tables for baseline denominators; use approved API ingestion for refresh. Verify domain IDs rather than confusing BPS and Kemendagri codes. |
| [Bank Indonesia JISDOR](https://www.bi.go.id/en/statistik/informasi-kurs/jisdor/Default.aspx), [published web service](https://www.bi.go.id/biwebservice/wskursbi.asmx?op=getSubKursJisdor2) | Official USD/IDR benchmark | Public documentation discovered; service payload not probed. Published on banking days, so weekends are not outages | National economic context beside Jakarta BPS series. Cache daily; retain reference date. |
| [BRIN subsidence study](https://ejournal.brin.go.id/JTL/article/view/1125) | Research basis for Jakarta land deformation | Public paper, dated research; reusable per-point GIS package not established | Research/request route, not a live layer. Obtain measurement interval, reference frame, uncertainty and point/raster data before mapping rates. |

### Exact endpoint examples

```text
BMKG forecast:
https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=31.71.03.1001
  Returned Kemayoran, Jakarta Pusat, Asia/Jakarta.
BMKG warnings:
https://www.bmkg.go.id/alerts/nowcast/id
https://www.bmkg.go.id/alerts/nowcast/en
  Follow the published detail CAP links; do not construct unverified alert IDs.
BMKG latest earthquake:
https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json
PetaBencana reports:
https://api.petabencana.id/reports?admin=ID-JK&geoformat=geojson&disaster=flood
```

BMKG's returned `tp` field was observed, but its interval and unit are not explained in the public field list checked here. Do not substitute it for Open-Meteo's millimetre totals until those semantics are confirmed. The existing Open-Meteo gust, pressure and complete 24-hour precipitation values remain useful complementary model fields.

### Jakarta Satu service evidence

Base: `https://jakartasatu.jakarta.go.id/server/rest/services/JakartaSatu/`.

| Service/layer suffix | Count returned | Meaning and caution |
|---|---:|---|
| `Peta_Jalan/MapServer/0` | 102,616 | Road segments; geometry and road attributes, not measured speed. |
| `Fasilitas_Kesehatan/MapServer/0` | 678 | Facility records; not available beds or emergency capacity. |
| `Jalur_Kereta_Api/MapServer/0` | 263 | Rail geometry; not train positions. |
| `Jalur_Transjakarta/MapServer/0` | 24 | Corridor geometry; official GTFS is broader and should be checked for current network coverage. |
| `model_gab_rth/MapServer/0` | 5,847 | Green-space records; declared area needs unit/geometry verification. |
| `Sekolah/MapServer/0` | 3,525 | School records; not enrollment or shelter readiness. |

Count requests used `/query?where=1%3D1&returnCountOnly=true&f=json`. Metadata and count are verified; complete geometry extraction remains future work. Request selected public fields and exclude editor/user identifiers from exported map properties.

`batas_kelurahan_vs_dukcapil/MapServer` and `Laporan_air_Tanah_Jakartasatu/MapServer` returned internal ArcGIS error 500 in HTTP 200 bodies. They are catalog leads, not working datasets. `Transjakarta/MapServer` metadata also loaded, but the GTFS provides a clearer licensed source for bus geometry.

## Global sources already used in HCMC: portability

These sources were found in the HCMC atlas or selected dashboard files. Country/global availability must not be interpreted as neighborhood observation coverage.

| Source | Jakarta decision |
|---|---|
| [Overture](https://docs.overturemaps.org/attribution/), [Google Open Buildings](https://sites.research.google/open-buildings/), [GHSL](https://human-settlement.emergency.copernicus.eu/), [OSM](https://www.openstreetmap.org/copyright) | Already integrated. Keep release/epoch and estimated-height distinctions; validate mainland coverage against official boundaries. OSM is useful for drainage/POIs, but mapping completeness varies. |
| [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/), [RainViewer](https://www.rainviewer.com/api.html), JMA Himawari | Already integrated and returned metadata on this run. Product availability is not proof of valid pixels over Jakarta. Verify local radar coverage. Cloud-masked/coarse MODIS pixels cannot resolve a flooded street. |
| [Open-Meteo/CAMS](https://open-meteo.com/en/docs/air-quality-api) | Already integrated. Five model samples are not five stations or district averages. Keep free-service non-commercial terms and throttle fallback. |
| [GDACS](https://www.gdacs.org/) | Already integrated for current tropical cyclones within 800 km. It is regional event context; BMKG should supply local official warnings. |
| [USGS](https://earthquake.usgs.gov/fdsnws/event/1/) | Reusable no-key regional earthquake catalog. Pair with BMKG local felt/shakemap records, deduplicate events and state radius/period. |
| [NASA EONET](https://eonet.gsfc.nasa.gov/) | HCMC uses v2.1; validate current supported version and Indonesian event coverage before porting. Regional curated events, not a complete city incident log. |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html) | Registered free MAP_KEY; use Indonesia/bbox query, not inherited THA. The selected HCMC ingestion file contains THA. Satellite thermal detections are not confirmed building fires. |
| [World Bank](https://api.worldbank.org/v2/country/IDN/indicator/NY.GDP.MKTP.CD?format=json&mrv=1) | Anonymous API returned an Indonesian national GDP record. National comparison/context only; use BPS for Jakarta-level statistics. |
| [ReliefWeb](https://apidoc.reliefweb.int/) | Current docs require v2 and a pre-approved appname. HCMC source points to v1, now documented as retired. Port the concept after updating access/version, not the old endpoint. |
| [HDX/HAPI](https://hapi.humdata.org/) | HCMC includes rainfall, food-price and conflict ingestion paths. Validate current endpoint schemas, access and actual Indonesia records before reuse. An API family alone does not prove Jakarta coverage. |
| [OpenAQ](https://docs.openaq.org/using-the-api/api-key) | Additional registered-key option for measured air. Jakarta stations, dates and provider permissions still need validation. Keep key in Worker environment. |

VNTT, Vietcombank/Vietnam currency providers, Thailand camera systems, hand-drawn HCMC flood zones and simulated buses are not Jakarta sources. JAKI app visibility does not by itself provide authorized access to internal APIs. A public camera should remain visual context; do not infer congestion or counts without a validated method.

## Integration order

1. **Repair data gates:** explicit UTC offset, provider-specific grid displacement, response shape/count/unit checks. Add meaningful behavioral tests for the reproduced failures before new feeds reuse these adapters.
2. **Official weather:** Worker adapters for BMKG CAP and a small verified `adm4` forecast set. Label official alerts separately from atlas model notices and retain the existing regional imagery.
3. **Scheduled transport:** download and validate official TransJakarta GTFS, bake shapes/stops, display service calendar and scheduled headway. Preserve OSM rail and never animate scheduled records as observed vehicles.
4. **Planning context:** dated Jakarta Satu roads, health, schools and green space; separately verify a usable DKI boundary source and BPS baseline tables. Cache static data locally/R2 rather than querying large GIS layers from every browser.
5. **Reported flooding:** integrate PetaBencana only after validating host/format and active data coverage; request BPBD feeds for observed TMA and official flood events. Keep no-reports, stale gauges and unavailable services as separate states.
6. **Measured air/coast:** approved DLH station exports/API, BIG tides and terrain, then a dated and reviewed subsidence product. Keep US AQI, ISPU, concentrations, radar and AOD as separate measures.

Every new record should retain publisher/source URL, data tier, geographic scope, issue/observation time, valid-until when applicable, retrieval time, units/index system, rights, and missing/stale state. Slow geometry gets a versioned snapshot and checksum; live providers get bounded calls, cache and failure diagnostics. Add CSP hosts only for the adapters actually needed. No paid credentials, accounts, provider agreements or external messages were created during this audit.

The next useful outcome is an atlas with official warnings, licensed scheduled transit and dated civic layers. A district risk score should wait until coverage, denominators, thresholds and validation support it.

## Later verification: official portal imports

The subsequent requested-source study proved Satu Data's anonymous JSON endpoint through its own **Lihat JSON** interface. The earlier “export/API resource not proved” finding above is superseded for the 2024 Satpol PP flood-prone dataset only. Imported public references, project proposals, report facts, coordinate/geometry exclusions and the Pantau Banjir timeout are documented in [OFFICIAL-PORTALS-2026-10-11.md](OFFICIAL-PORTALS-2026-10-11.md). A portal's open classification does not establish a blanket reuse license for all its datasets.

## Later verification: flood desk monitoring network

The Jakarta Satu ROOT REST catalog proved anonymously open for the flood-desk sources too: AWLR (28 stations with SIAGA 1–4 cm bands), ARR (56 gauges), Peta_Kerja_BPAD (263 pumps, 589 floodgates, 147 reservoirs; geometry only on FeatureServer variants), Resiko_Bencana (1,900 polygons, classes Ringan/Sedang/Berat, dotted KDEPUM kelurahan codes) and Kependudukan 2023 semester 2 (267 kelurahan joined 260/260 into the risk summary). Pantau Banjir still times out and PetaBencana's floodgauges topology returns empty; both ship as explicit access states, not imports. Live water levels are still not published by any open machine feed the audit could verify — the dialog shows official thresholds and classes only. Bake, contracts and raw captures: `scripts/prepare-flood-network.py`, `scripts/test-flood-network.mjs`, `data/source-evidence/flood-network-2026-10-11/`.
