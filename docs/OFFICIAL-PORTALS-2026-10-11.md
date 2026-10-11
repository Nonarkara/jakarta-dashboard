# Official Jakarta sources · 11 October 2026

The hero remains a bounded map workspace. New reference data is opened through **Data kota**; green-space polygons are selected through **Fasilitas kota**. All previous weather, transit, civic, CRM, atlas and source dialogs remain available.

## Source contracts and delivered data

| Publisher | Imported / presented | Tier and limits |
|---|---|---|
| [Satu Data Jakarta](https://satudata.jakarta.go.id/home) / Satpol PP | Complete public export: 154 flood-prone reference rows for 2024, grouped into 104 kelurahan-period rows; search and JSON download | Annual reference, not current inundation or incident counts. File updated 7 April 2026, metadata updated 5 June 2026. Open classification; specific reuse license not stated. |
| [Jakarta Satu](https://jakartasatu.jakarta.go.id/geoportal) | 5,842 green-space polygons with names, publisher categories, kelurahan/kecamatan/kota; search and individual map overlays. Existing 678 health and 3,525 school points preserved | Public reference; observation date absent. Includes cemeteries, strips and undeveloped inventory, not necessarily publicly accessible parks. Source has 5,847 rows: one polygon outside the region, three null geometries and one empty geometry excluded. No area totals computed. |
| [Pantau Banjir](https://pantaubanjir.jakarta.go.id) | Dated access status and direct official link; historical monitoring-network fact from JSC annual report | HTTP/browser/web attempts timed out. Current water levels, pump operations and station status were not imported. Cached empty tables are not a current no-flood reading. |
| [CRM](https://crm.jakarta.go.id/data-bulanan) | Existing lazy publisher-hosted monthly report, daily/kelurahan/map/channel links retained | Report period and updates belong to publisher. No private complaints, reporter identities, photos or undocumented private API imported. |
| [Jakarta Smart City documents](https://smartcity.jakarta.go.id/en/dokumen/) | Five planning-document records (2024/2026), direct publisher PDF links; public 48-page [2023 annual report](https://smartcity.jakarta.go.id/docs/Laporan-Tahunan-Jakarta-Smart-City-2023.pdf) with two selected facts | Historical facts: 178 flood-monitoring points on page 9; more than 60 integrated JAKI services on page 10. No current coverage claim. Documents page label “Annual Reports” currently contains planning publications, distinguished in UI. |
| [Bappeda global-city vision](https://bappeda.jakarta.go.id/kota-global) | Top-20 by 2045 target, polycentric development direction, roadmap record Kepgub 294/2025 | Planning target, not achieved rank. English roadmap publisher detail: `/kota-global/188`. No 130 MB roadmap mirrored into public assets. |
| [Jakarta Investment Centre](https://invest.jakarta.go.id/potential-projects) | All 37 listed projects across nine sectors; proposed cost, expected start, land-area/scope and location fields; search, sector filter, expandable rows, JSON download and 31 explicit publisher-coordinate map points | Publisher proposals; not funding, construction progress or completion confirmation. No inferred boundaries/routes or geocoding. Observation date unavailable; retrieval timestamp recorded. Financial performance projections omitted. |

## Exact anonymous resources

Satu Data's **Lihat JSON** UI publishes this endpoint; retrieved response contains 154 data entries and `total_file:154`. UTF-8 BOM is present.

```text
https://ws.jakarta.go.id/gateway/DataPortalSatuDataJakarta/1.0/satudata?kategori=dataset&tipe=detail&url=data-titik-rawan-bencanabanjir
```

Source page:
https://satudata.jakarta.go.id/open-data/detail?kategori=dataset&page_url=data-titik-rawan-bencanabanjir&data_no=1

Coordinates are numeric-looking strings such as `-6214879,106819983` with no stated scale. They are withheld entirely from published aggregates and map rendering; no silent division by a million.

Jakarta Satu:

```text
https://jakartasatu.jakarta.go.id/server/rest/services/JakartaSatu/model_gab_rth/MapServer/0?f=pjson
https://jakartasatu.jakarta.go.id/server/rest/services/JakartaSatu/model_gab_rth/MapServer/0/query
```

Query contract: `where=1=1`, fields `NAMA,JENIS_OBJECT,KELURAHAN,KECAMATAN,KOTA`, `outSR=4326`, `f=geojson`, `orderByFields=OBJECTID`, record count 1000, offsets 0–5000. Reject ArcGIS error bodies even with HTTP 200. Map coded `JENIS_OBJECT` values using the public metadata domain. Whitelist five infrastructure fields; do not import staff/editor/certificate fields. Round geometry to six decimals, retain polygons/rings, verify closure and regional bounds. No area unit assumption.

Investment links are parsed from the public list's project anchors, then only four labelled detail fields are extracted from public HTML. Source hashes are stored per project. The Heritage Hub Kalibesar and Thamrin Boutique Hotel both publish `[106.849270,-6.213876]`; their map coordinates are quarantined with an explicit note, while source text is preserved. Four other projects lack explicit point coordinates. DMS and decimal conversion uses only labelled publisher location text; points remain publisher references, not a validated survey.

## Files and refresh

- `public/data/jakarta-v1/{projects,flood-reference,city-context}.json`
- `public/data/jakarta-v1/green.geojson` (~3.8 MB; fetched only when that civic layer is selected)
- `public/official-data.js` (three requested-data popup views; snapshots loaded on popup open)
- `scripts/prepare-official-portals.py`: anonymous JIC/green-space preparation; requires beautifulsoup4; bounded curl calls and three concurrent project reads.
- `scripts/prepare-official-context.py`: aggregates saved public Satu Data export and parses saved JSC document catalogue; source file retrieval timestamps retained separately from preparation time. Refresh those source files deliberately before rebuilding. Annual report facts and Bappeda target are reviewed references, not automatically extracted claims.
- Raw source evidence retained privately under `data/source-evidence/official-2026-10-11/`; only selected normalized public data is served.

No new external embed hosts or authentication permissions. Existing CRM viewer is preserved. Normalized source snapshots avoid live availability depending on slow portal pages; dates remain visible. Evidence export includes loaded official snapshots.

## Validation

Dataset contract tests check unique project IDs, source URLs, proposed-currency units, coordinate bounds and duplicate quarantine; flood total/period consistency and absent coordinates; green geometry bounds, ring closure, source-count reconciliation and field allowlist; historical versus planning tiers. Live release smoke additionally compares the exact official client, dashboard CSS and four data assets against local bytes.
