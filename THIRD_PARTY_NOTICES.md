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
- PetaBencana aggregate reports: CC BY-NC 4.0 for non-commercial use; commercial use requires the publisher's agreement. https://docs.petabencana.id/informasi-lisensi-data. This public research demo displays aggregate recent report counts; no resident text, photos or household coordinates are redistributed.
- fast-xml-parser: MIT license, npm package pinned in package-lock.json.

## Jakarta typography and Palette adaptation · 11 October 2026

Plus Jakarta Sans: Copyright 2020 The Plus Jakarta Sans Project Authors, https://github.com/tokotype/PlusJakartaSans. SIL Open Font License 1.1, full license included at `public/fonts/PlusJakartaSans-OFL.txt`. The unmodified variable webfont is self-hosted from upstream commit 18d1cd2f7ea10481919d2f05c1f7064b7307fc26.

Palette plate 267: Sanzo Wada's relationship, via Matt DesLauriers' MIT-licensed digital conversion data (Copyright (c) 2020 Matt DesLauriers), which credits Dain M. Blodorn Kim. Production shades and role assignments are our own adaptation. Values are digital conversions, not exact printed inks. Palette reference: https://colors.nonarkara.org/#plate-267. The dataset notice and MIT permission/disclaimer are available at https://github.com/mattdesl/dictionary-of-colour-combinations; no source book scans are distributed.

CRM: official hosted monthly report by Jakarta Smart City/CRM; the Google report URL comes from https://crm.jakarta.go.id/data-bulanan. The report is displayed on demand as the publisher's own iframe. No private complaint data or copied report metrics are stored. Links, periods and data access remain publisher-controlled; no official affiliation is claimed by this research dashboard.


Logo artwork: supplied by the project owner as “Jakarta Civic Dashboard Logo Explorations.png” on 11 October 2026. The original raster is retained in `public/brand/jakarta-logo-set.png`; CSS frames its app icon and wordmark, and the favicon uses the same app-icon region. No external license or official Jakarta government endorsement is asserted.
