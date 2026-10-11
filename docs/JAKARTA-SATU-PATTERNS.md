# Jakarta Satu 3D → Explore workbench

Source: https://jakartasatu.jakarta.go.id/geoportal/peta/3d, browser-observed 11 October 2026. Anonymous public UI loaded after an initial navigation timeout. Search (Cari Alamat), separate Layer and Legenda tools, pan/rotate/reset, building-use dropdown and height range 0–500m were visible. The layer list included buildings, non-buildings, RDTR 2022, transport, trees, kelurahan boundaries and aerial photographs. The publisher displayed a building count, but its count scope was not independently established and is not copied into our metrics.

| Source pattern | Landed here | Improvement / limits |
|---|---|---|
| Address search | Explore → curated city-view search | 12 existing views, with names, chapters, descriptions and tags; explicitly not a geocoder. Transit and civic searches remain available. |
| Height and use filters | Explore → height range, tag groups | Group existing source tags rather than claim official land use; add height-provenance filtering and an explicit unknown-height choice. |
| Building count | Checked viewport count | Deduplicate vector feature IDs; label simplified rendered footprints and snapshot date. No count during loading, missing map data or hidden layers. Not a census. |
| Separate legend | Explore → height ramp + evidence links | Reflect actual theme ramp stops; distinguish warm selection/landmark symbols. Scientific overlays retain their own legends. |
| Reset | Reset city view | Stop camera tours and return to Sudirman–Thamrin in 3D; clear filters separately. |
| Planning layers | Direct official 3D/RDTR links | No undocumented private endpoints, copyrighted meshes or official land-use attributes copied. |

Preserved: bounded hero, native detail popups, all existing layers, building heights, source/tier/date metadata, route and civic search. Rejected: rounded toolbar surfaces, giant default-open filter panel and unlabeled building totals. Our tool remains closed until requested.

Source datasets remain Overture/OSM/Microsoft/Google footprints and mixed-source height estimates, with named landmark references. Height filters change visibility only. Landmark parts use the maximum published height among parts with the same name, so filtering a monument does not retain only its low plinth. Layer-specific original label filters are retained on apply/reset.
