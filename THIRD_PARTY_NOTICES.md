# Third-party notices

## Palette

The appearance themes are the atlas's own batik reading: an indigo ground,
limestone text and a soga-brown/gold accent. The values are screen colours
chosen for contrast (checked by `scripts/test-theme-contract.mjs`), not a
claim about any historic dye or textile standard. No third-party palette is
reproduced.

## Geographic and environmental data

- Building footprints: Overture Maps Foundation (OpenStreetMap ODbL, Microsoft ML Building Footprints ODbL, Google Open Buildings CC BY 4.0 / ODbL).
- Per-building heights: Google Open Buildings 2.5D Temporal (2023), CC BY 4.0. Area heights: GHS-BUILT-H R2023A, European Commission JRC, CC BY 4.0.
- Rail, waterways and landmark outlines: © OpenStreetMap contributors, ODbL.


See the [README](README.md#data-and-rights) for source-specific credits and terms.
This notice does not relicense the map data, Esri imagery, height products, or
upstream environmental feeds.

## MapLibre GL JS 6.4.1

Vendored from its npm release. BSD 3-Clause license: `public/vendor/maplibre-6.4.1/LICENSE.txt`.

## Environmental products added 5 October 2026

- NASA GIBS / LANCE: MODIS Terra aerosol optical depth, MODIS Terra+Aqua 3-day flood/surface-water classification, and IMERG precipitation-rate visualization. Provider WMTS product identifiers, dates and matrix sets are read from [NASA capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml). Surface-water legend colors follow [MODIS_Flood.xml](https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Flood.xml). NASA visualizations are distinct from analyzed/surveyed urban flood polygons. Original products and their dataset terms apply.
- Radar imagery and coverage: [RainViewer](https://www.rainviewer.com). Visible attribution is provided on the selected map and in the source ledger. The radar legend samples the rain column of its [Universal Blue color table](https://www.rainviewer.com/files/rainviewer_api_colors_table.csv), not invented severity classes. Its [API terms](https://www.rainviewer.com/api.html) describe personal, educational and small community use without SLA; high-volume commercial use needs a separate arrangement.
- Direct modeled precipitation and forecasts: [Open-Meteo](https://open-meteo.com/en/docs). Data requires CC BY 4.0 attribution. Its [free-service terms](https://open-meteo.com/en/terms) restrict use to non-commercial applications and set request limits. This public demo uses cached multi-location calls; a commercial or contracted deployment needs an appropriate service agreement. No paid subscription or credential has been created.

Public access does not establish an operational SLA or clear every institutional redistribution right.

## OpenStreetMap standard basemap and Himawari infrared

The selectable street basemap uses https://tile.openstreetmap.org/{z}/{x}/{y}.png with visible © OpenStreetMap contributors attribution and ordinary browser caching/referrers. No offline download or bulk prefetch is provided. Best-effort public service: https://operations.osmfoundation.org/policies/tiles/.

Himawari AHI Band 13 clean infrared imagery is served by NASA GIBS with JMA attribution. Ten-minute timestamps and available intervals come from live WMTS capabilities. The image shows cloud-top brightness temperature (kelvin), not measured rain; rainfall context comes from radar or IMERG. Source: https://www.jma.go.jp/jma/jma-eng/jma-center/nowcasting/index.html.

## Jakarta dashboard additions · 11 October 2026

- BMKG official forecasts, warnings and earthquake data: visible BMKG attribution, links and issue/valid/observation times. Public API limits documented at https://data.bmkg.go.id/; upstream output is normalized, cached and validated. CAP lat/lon pairs are converted to GeoJSON lon/lat.
- GTFS Static Transjakarta © 2026 PT Transportasi Jakarta, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Published license: https://ppid.transjakarta.co.id/informasi/berkala. Original ZIP: https://gtfs.transjakarta.co.id/files/file_gtfs.zip. Changes: normalized JSON, representative trips per direction, rounded coordinates and simplified geometry. The manifest retains SHA-256 and retrieval time. No claim of actual vehicle positions.
- Jakarta Satu © Pemprov DKI Jakarta. Public health/school reference fields and WGS84 geometry selected from published ArcGIS services. Retrieval date and source URLs are retained; observation epoch and an explicit dataset open license were not published in inspected metadata. Facility records are not a live-capacity system.
- Jakarta Satu flood desk © Pemprov DKI Jakarta. AWLR/ARR station points with official SIAGA alert thresholds, pumps/floodgates/reservoirs geometry, flood-risk reference polygons (Resiko_Bencana), situ inventory and 2023 semester-2 population from the same published ArcGIS services, selected fields only. Alert thresholds and risk classes are dated official reference, not live readings; no observation epoch or dataset open license was published in inspected metadata. Raw source captures are retained under `data/source-evidence/`.
- Satu Data Jakarta ISPU © Dinas Lingkungan Hidup DKI Jakarta. Daily ISPU measurements for the five official SPKU stations (DKI1–DKI5) from the publisher's anonymous CSV export, normalized to monthly dated references (mean daily max, worst day, category per Permen LHK 14/2020). The latest publisher batch is labelled with its own period and is never presented as a live feed; no values are interpolated for no-data days. Dataset license was not stated in inspected metadata; publisher attribution is retained. Raw export retained under `data/source-evidence/`.
- PetaBencana aggregate reports: CC BY-NC 4.0 for non-commercial use; commercial use requires the publisher's agreement. https://docs.petabencana.id/informasi-lisensi-data. This public research demo displays aggregate recent report counts; no resident text, photos or household coordinates are redistributed.
- fast-xml-parser: MIT license, npm package pinned in package-lock.json.

## Jakarta typography and Palette adaptation · 11 October 2026

Plus Jakarta Sans was used for the wordmark in the first release and is **not shipped any more**: the interface reads in Source Sans 3 and the display face is Universa Civic, so the Plus Jakarta Sans webfont and its OFL were removed from the served tree on 21 October 2026 rather than left on the edge unused. For the record, that typeface is Copyright 2020 The Plus Jakarta Sans Project Authors, https://github.com/tokotype/PlusJakartaSans, SIL Open Font License 1.1; the unmodified variable webfont had been self-hosted from upstream commit 18d1cd2f7ea10481919d2f05c1f7064b7307fc26. No Plus Jakarta Sans glyph is now served or rendered.

Palette plate 267: Sanzo Wada's relationship, via Matt DesLauriers' MIT-licensed digital conversion data (Copyright (c) 2020 Matt DesLauriers), which credits Dain M. Blodorn Kim. Production shades and role assignments are our own adaptation. Values are digital conversions, not exact printed inks. Palette reference: https://colors.nonarkara.org/#plate-267. The dataset notice and MIT permission/disclaimer are available at https://github.com/mattdesl/dictionary-of-colour-combinations; no source book scans are distributed.

CRM: official hosted monthly report by Jakarta Smart City/CRM; the Google report URL comes from https://crm.jakarta.go.id/data-bulanan. The report is displayed on demand as the publisher's own iframe. No private complaint data or copied report metrics are stored. Links, periods and data access remain publisher-controlled; no official affiliation is claimed by this research dashboard.


Logo artwork: supplied by the project owner on 11 October 2026. The original raster is retained in the repository at `docs/brand/jakarta-logo-set.png`, and the reconstructed symbol at `docs/brand/jktx-symbol-v2.png`; both were moved out of the served tree on 21 October 2026, because no page loads them. What the site ships is derived from them: `public/brand/jktx-symbol.png`, the symbol cropped to its own artwork at 30 KB, which CSS frames as the app icon, and `public/brand/jktx-favicon.png`, the same mark at 64x64 for the browser tab. No external license or official Jakarta government endorsement is asserted.


Logo production correction: `jktx-symbol-v2.png` is an AI-assisted transparent reconstruction of the red Monas/blue-layer symbol from the owner-supplied sheet. It replaces presentation-sheet cropping on the live surfaces. The JKTx wordmark is native text, set in Source Sans 3 (SIL OFL 1.1) - it is not the Plus Jakarta Sans the first release used, and no Plus Jakarta Sans is served now. Original sheet retained as source evidence; no official government endorsement asserted.


Source Sans 3 variable upright: Adobe Source Sans, copyright 2010-2024 Adobe, SIL OFL 1.1. Original WOFF2 from https://github.com/adobe-fonts/source-sans, release branch `WOFF2/VF/SourceSans 3VF-Upright.ttf.woff2`; full license retained in `public/fonts/SourceSans3-OFL.txt`. It is the interface and reading face, and it sets the JKTx wordmark; the earlier Plus Jakarta Sans webfont has been removed from the served tree rather than kept as unused historical source.

## Water and traffic observation lenses · 12 October 2026

- Expanded water network: © OpenStreetMap contributors, ODbL. Overpass snapshot dated 2026-06-01, captured 12 October 2026; five-decimal coordinates, 0.00002° line simplification. Source ways retained; not every physical drain or multipolygon relation. Original-geometry length computed by this project.
- Ciliwung corridor route (Katulampa → Depok → Manggarai): © OpenStreetMap contributors, ODbL. Overpass river/canal ways in the corridor, connected through shared way node IDs; station-to-station paths admitted only through published geometric gates (endpoint tolerance 2 km, chord bound 3.5 km, chord-relative length bounds, no majority of another named waterway). Raw Overpass capture retained under `data/source-evidence/ciliwung-2026-10-13/`. The scenario timing stays the BPBD 2021 historical assumption, never a speed derived from the mapped length.
- Air timeline and wind transport: Open-Meteo / CAMS and Open-Meteo wind models, CC BY 4.0 with the noncommercial free-service condition already noted above. One CAMS cell's 48-hour output with its grid identity and native-resolution caveat shown; the uniform-wind marker is speed × elapsed along one bearing — no concentration, plume or smoke attribution is computed.
- Hydrology: BBWS Ciliwung Cisadane / EWS Sodetan Ciliwung, public gauge readings and separately labelled publisher predictions. No general open license stated. Local gauge datum is not discharge; predicted serial sections are never summed. Credentials, authenticated cameras and credential-bearing responses are not stored or used.
- NASA: existing GIBS/LANCE MODIS 3-day flood classification, 250m, observation date explicit. JAXA/EORC Today’s Earth: satellite-informed TE-Global model (~0.1°), run timestamp explicit, not direct observed inundation. See https://www.eorc.jaxa.jp/water/documents.html and provider terms.
- Camera catalogue: public ArcGIS CCTV Jakarta 2019 feature service, catalog data edited 23 April 2025. Source-specific redistribution license not stated; locations and source links attributed, video kept on provider. 4,340 records are camera references, not verified active cameras.
- Toll camera video: Bina Marga public CCTV viewer links to Jasa Marga streams (https://binamarga.pu.go.id/contents/cctv_tol/?id_ruas=dalam-kota). 26 published cards / 21 unique HLS streams. No coordinates on that page; not given invented map positions. On-demand pass-through only, no recording. Playlist/segment availability is not independent verification of scene capture time.
- YouTube: provider players and channel links for Andi Saputra Siahaan / Jakarta Street Cam and World Live Cam 24. No current live channel broadcast verified at collection; availability/replay stays explicit. No video downloads or copied streaming URLs.
- hls.js 1.7.3 light ES module: Apache-2.0, license preserved at public/vendor/hls-1.7.3/LICENSE.txt. Source package https://www.npmjs.com/package/hls.js.

## Haze evidence · 14 October 2026

- NASA FIRMS / NOAA-20 VIIRS Collection 2 near-real-time thermal detections: the adapter uses the anonymous [Southeast Asia regional CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv), attributed to NASA FIRMS. Product documentation and acknowledgement guidance remain at [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/active_fire). Nominal 375 m thermal anomalies are not independently confirmed fires or measured smoke emissions; FRP is radiative power in MW, not PM mass. Only valid, geographically bounded, recent records are admitted. NRT data may later be revised. Anonymous access does not establish an SLA or a blanket license for every NASA-linked product; original product terms apply. No API key, account, private feed or credential-bearing endpoint is used.
- NASA GIBS NOAA-20 VIIRS corrected-reflectance true-colour visualization: product identifier `VIIRS_NOAA20_CorrectedReflectance_TrueColor`, available dates read from [NASA WMTS capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml), with NASA/NOAA attribution retained. Visible satellite imagery can show cloud, land, water and possible smoke; it does not quantify surface PM concentration or confirm the source of a plume. The true-colour image and thermal detections are separate observations with their own acquisition times. Original dataset terms apply; this notice asserts no new redistribution permission.

## Universa / Herbert Bayer typography · 14 October 2026

The owner selected Christian Holm's free CTAN Universa implementation of Herbert Bayer's Universal: https://ctan.org/pkg/universa. Copyright Christian Holm, 1998, GNU GPL version 2 or later. Our independent web conversion, Universa Civic, traces the distributed medium-upright specimen; it is not P22's commercial revival or an exact historical reconstruction. Full original sources/documentation are redistributed at `public/fonts/universa/source.zip`, the GPL text at `LICENSE.txt`, and the conversion source at `scripts/prepare-universa-font.py`. Headings and navigation use the 6.7 KB self-hosted WOFF2; Source Sans 3 retains reading/data text and unsupported glyph fallback. No commercial font or font-service subscription is used.
