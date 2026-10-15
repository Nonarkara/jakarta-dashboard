# Jakarta terrain and land-cover acquisition · 15 October 2026

A real Jakarta raster is now acquired. It is land cover, not the ground model still needed to calibrate water depth.

## Admitted: ESA WorldCover 2021 v200

The [publisher repository](https://github.com/ESA-WorldCover/esa-worldcover-datasets), [data-access page](https://esa-worldcover.org/en/data-access) and [official Earth Engine catalogue legend](https://developers.google.com/earth-engine/datasets/catalog/ESA_WorldCover_v200) identify the anonymous AWS COG route, data licence, class codes and semantic colours. The data licence is **CC BY 4.0**; the publisher repository's code licence is separate. No upstream code was copied.

Actual acquired tile: [S09E105](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_S09E105_Map.tif). The initial 16,384-byte range request returned HTTP 206, `Content-Range: bytes 0-16383/35646411`. Rasterio then read only the crop window through COG range access; the whole 35.6 MB tile was not saved. A native-value GeoTIFF crop is retained, so reproduction and pixel checks do not require network access.

| Contract | Acquired value |
|---|---|
| Classification period | 1 January–31 December 2021, from source TIFF tags |
| Retrieval | 15 October 2026; exact UTC timestamp in acquisition receipt |
| Bounds / CRS | `[106.65, -6.40, 107.00, -6.08]`, EPSG:4326 |
| Scope | Mainland rectangular window; includes sea and land outside DKI, excludes offshore islands |
| Native grid | 4,200 × 3,840 = **16,128,000 cells**; nominal 10 m, exact 1/12,000-degree spacing |
| Nodata | Source code 0; **0 cells** in this crop |
| Classification | Nine of the eleven possible non-nodata classes present |
| Display | 2,100 × 1,920 RGBA PNG; categorical nearest-neighbour 2:1, nominal 20 m |
| Raw crop | 1,116,794 bytes; SHA256 `4f926e3f19c6d437eb74dde957f845b7de032b19dff4bca6e1f50e70dcafaa1f` |
| Display image | 660,089 bytes; SHA256 `649ab1f7cfa5b384e88950723a0ce66db02f2ecf191828538c22c42a6ebe538e` |

Full-resolution crop counts: tree cover 2,907,416; shrubland 1,183; grassland 648,046; cropland 288,161; built-up 11,169,514; bare/sparse vegetation 50,468; permanent water 1,038,171; herbaceous wetland 20,407; mangroves 4,634; snow/ice and moss/lichen zero. Counts sum to 16,128,000. These are classified cells in a rectangle, not administrative statistics or physical area estimates. Geographic cells are not equal-area.

Use the optional map overlay to compare **historical land-cover classes** with waterways and official drainage references. Built-up is a classification, not a measured impermeable fraction. Permanent-water class is not current flood extent. Neither cell classification nor a changed colour supplies elevation, storage, river flow, drain capacity or a runoff coefficient. Classification errors and mixed pixels remain possible. Native semantic class colours explain the data; they are not a new interface accent. The four-corner image placement approximates the geographic grid in Mercator by about 2.7 m across this window, below the 20 m display cell; it is not survey precision.

Required map acknowledgement is carried in the JSON manifest: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. The manifest also includes the dataset DOI, licence link, source URL, bilingual limitations, exact corner coordinates, class counts, resolution and both asset hashes.

## Terrain access newly verified, not admitted as flood terrain

The [AWS open-data registry](https://registry.opendata.aws/copernicus-dem/) identifies Copernicus GLO-30 as a digital **surface** model containing buildings, infrastructure and vegetation. Its [publisher registry record](https://github.com/awslabs/open-data-registry/blob/main/datasets/copernicus-dem.yaml) describes the AWS archive as the 2021 release and points to its own data licence, not CC BY 4.0.

A bounded anonymous request for the actual [S07/E106 Jakarta tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S07_00_E106_00_DEM/Copernicus_DSM_COG_10_S07_00_E106_00_DEM.tif) succeeded with HTTP 206 and `Content-Range: bytes 0-16383/45527867`. This closes the question of whether an anonymously accessible Jakarta tile exists. Only header bytes, the probe receipt and registry metadata were retained; no elevations, masks or terrain simulation were admitted. A future crop must retain editing/error/water masks, source epoch and required notices, and reconcile vertical datum with local gauges. A 30 m DSM cannot substitute for surveyed drain inverts or bare-earth street terrain.

No new satellite flood event was admitted in this task. WorldCover permanent water does not confirm a dated inundation. The existing satellite-water views keep their original interpretation limits. DEMNAS, Dynamic World and event-based Sentinel-1 processing remain separate source/admission work.

## Reproduce and verify

Evidence directory: `data/source-evidence/terrain-satellite-2026-10-15/` contains the range-response header bytes, native Jakarta crop, acquisition receipt, publisher pages, legend page and Copernicus access probe. No credentials, editor identities or restricted data were used. Public Google browser configuration keys in the retained legend page were redacted; that page is documentation evidence, not a byte-identical source capture.

```
# Explicit network refresh of one fixed bounded Jakarta crop:
python3 scripts/prepare-worldcover-reference.py --fetch
# Offline regeneration from the hash-checked crop:
python3 scripts/prepare-worldcover-reference.py
node scripts/test-worldcover-reference.mjs
```

Preparation and the full pixel comparison require Python rasterio, numpy and Pillow; network refresh also requires requests. Runtime browser use needs none of them. The test reconciles native class counts, dates, CRS, nodata, bounding coordinates, PNG dimensions and hashes, and compares every display RGBA pixel to the nearest-neighbour rendering of the admitted crop. Offline regeneration reproduced the same PNG SHA256.
