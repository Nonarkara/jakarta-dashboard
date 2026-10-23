# A boundary water budget · 23 October 2026

Question: given the published polder boundary and this rain profile, how much water must be stored or drained, and what changes under an explicitly assumed pump rate?

Join: DSDA polygon ID/coordinates → native WorldCover 2021 pixel centres → returned Open-Meteo model cell and hourly end times. Derive boundary area in EPSG:32748; land-cover classes are context, never inferred permeability. Hash every raw input, preserve holes/multipolygons, exclude invalid OBJECTID48 without repair. Boundary scenarios overlap and must not be added into a city total.

Implement an on-demand water-budget tool inside Waterways evidence, preserving prepaint layout and compact chrome. A selectable boundary appears on the map; hourly gross rain, assumed runoff, actual removed water and balance form one readable graph with a text table. Start at all-rain-as-runoff/zero-pumping upper-bound assumptions, with storage unknown (blank), not a manufactured capacity. Optional available storage is a comparison threshold: water above it is a scenario excess, not mapped inundation or actual spill. Model precipitation endpoints mark preceding hourly intervals. Require all24 consecutive hours, fresh source and actual returned model cell within20km; no fill or extrapolation. A labelled test storm remains usable when live rain is unavailable. Export calculation/source/assumption snapshot and selected geometry.

Evidence: existing raw DSDA gzip and hash-verified native WorldCover crop acquired15October. Rain uses existing bounded /api/atlas/rainfall. No new network dependency, unknown terrain/tide/drain capacity/datum/operations remain outside calculation. EPA SWMM is a future calibrated-routing path, not the engine shipped here.

Verification: independent scientific review; reproducible raw→cooked bake and invariant tests; conservation/zero/expiry/incomplete-hour/distance tests; real browser controls and chart values at390/1024/1440 including unavailable state; existing spatial baseline/reasons and hash-pinned instruments preserved. Canonical release, live rendered gates and exact bytes, evidence recorded under law§7. No extra bars/cards.
