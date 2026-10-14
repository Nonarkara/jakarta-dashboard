# Jakarta source catalogue · 14 October 2026

The catalogue describes what this dashboard actually uses and what can be admitted next. It does not repeat the attachment's unverified portal totals, assumed APIs or operator counts.

Download the same inventory as [JSON](../public/data/jakarta-v1/source-catalog.json) or [CSV](../public/data/jakarta-v1/source-catalog.csv). Each row retains publisher, source page, inspected endpoint where known, access, status, license statement, source epoch, checked date, purpose and limits. Committed reference assets carry a SHA-256 so a reviewer can compare the inventory with the shipped bytes.

`integrated` means an existing application capability or committed dated reference asset. It does not mean a fresh measurement or operational availability. `candidate` means a public source found or probed but not admitted as current data. `blocked` records an access failure. `registration-required` is an account/key boundary; no credential was created. An unknown observation epoch is null. Retrieval cannot supply a missing observation date.

## Newly checked polygon source

Anonymous request:

```
https://data.petabencana.id/floods?admin=ID-JK&minimum_state=1&geoformat=geojson
```

The 14 October check returned HTTP 200, a FeatureCollection with one MultiPolygon in Lubang Buaya, state 2. Its `last_updated` is **27 September 2024**, not the request date. This is an accessible historical record, not current flooding. The default request returns Topology; explicitly requesting GeoJSON avoids adding a conversion dependency.

[Official field contract](https://docs.petabencana.id/master-1/routes/flooded-area): `area_id`, `geom_id`, `area_name`, `parent_name`, `city_name`, `state`, `last_updated`, and geometry. State 1 means unknown flooding; state 2 means 10–70 cm; state 3 means 71–150 cm; state 4 means more than 150 cm. These are publisher categories for the reported area, not a continuous measured depth surface. [License](https://docs.petabencana.id/informasi-lisensi-data): CC BY-NC 4.0; commercial use requires agreement.

A future current-area adapter should select only these fields, validate Polygon/MultiPolygon coordinates and record times, quarantine old/future rows, and report rejected counts. Missing or rejected rows must never turn into a no-flood verdict. Do not redistribute report text, photos or resident identities. Compare accepted dated polygons with NASA surface-water imagery; neither source measures incoming volume by itself.

## Ridership and budget

The attachment's [daily passengers dataset page](https://satudata.jakarta.go.id/open-data/detail?kategori=dataset&page_url=jumlah-penumpang-angkutan-umum-yang-terlayani-perhari&data_no=1) and [SMARTAPBD FAQ](https://apbd.jakarta.go.id/landingpage/faq) returned HTTP 200 HTML. No download rows or fiscal/operational units were inspected. Both stay candidates; the inventory leaves machine endpoints, periods and licenses unknown. It does not invent a Satu Data export ID from the working ISPU export.

Useful next admissions are dated ridership by operator and realized infrastructure expenditure by fiscal period. Before importing, verify actual export URL, dataset agency, period, units, reporting scope, totals versus subtotals and license. A service plan is not actual passenger movement; a budget proposal is not money already spent.

## Boundaries kept

The current river, flood, air and satellite records remain distinct: mapped geometry, official dated references, local-datum gauges, publisher discharge predictions, coarse atmospheric/hydrological models, observation-derived imagery and user scenarios. Current working-tree additions are not promoted to shipped status merely because files exist. The NOAA-20 thermal-anomaly capability is integrated: anonymous provider retrieval and the local adapter/UI were verified at 14:23:19 UTC on 14 October. Individual detection dates remain attached; counts change with the admitted 24-hour window. Deployment verification remains a separate release gate. The catalogue records the local adapter and upstream provider endpoints separately.

Validation checks JSON/CSV parity, unique IDs, admitted statuses, source URL schemes, existing local assets and exact hashes. Source probes are evidence of access at one check; no operational SLA is claimed.
