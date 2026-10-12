# Landmark reconstruction for the city dashboards

Exploration completed 12 October 2026. Recommendation: use img2threejs as an **offline landmark authoring workflow**, selectively improving recognizable silhouettes. Keep the existing geographic building network as the dashboard's operational geometry. No reconstructed model has been admitted or deployed by this exploration.

## What was checked

- Upstream: [img2threejs](https://github.com/img2threejs/img2threejs), Apache-2.0. Its default output is an agent-authored procedural TypeScript factory returning `THREE.Group`; it is not automatic photogrammetry.
- Inspected release: `v2.0.0`, resolved **commit** `a669e9a97cea4452b1c2310c5cca6aa0f6657c1f`. The annotated tag object is `fa55277ef5c655805d79bf27f23552b8d7e34a3b`; these are different identifiers. Pin the commit for reproducibility.
- Read `SKILL.md`, `docs/ARCHITECTURE.md`, `docs/EMISSION_TARGET_SOCKET.md`, the factory generator, tessellation implementation, target resolver and their tests from that release. The current main README/package also describes an installer; release and npm package versions are separate. Do not assume current main commands exist in the pinned release.
- Ran `python3 -m unittest forge.tests.test_tessellation_tiers forge.tests.test_targets` in an isolated checkout: **38 tests passed**. This verifies the tested budget selection and target resolution, not a landmark's visual fidelity, exporter output or phone performance.
- The base emission socket delegates explicitly selected exports to installed plugins. A GLB is not guaranteed by cloning the base repository. Keep the factory as the initial authoring artifact; separately validate any GLB exporter and its output.

## Best first subjects

| Dashboard | Subject | Benefit / boundary |
|---|---|---|
| Jakarta | Monumen Nasional (Monas) | First pilot: recognizable cup/platform, shaft and flame. Existing multipart OSM geometry and curated 132 m height provide alignment constraints. The flame shape still needs admitted photographic evidence. |
| Jakarta | Istiqlal Mosque | Dome and minaret silhouette; obtain separate dimensions and footprints for each part. Never apply dome/minaret height across the whole complex. |
| Jakarta | Jakarta Cathedral | Spires and roof profile; require multiple credited views and separate spire dimensions. |
| Jakarta | Wisma 46 | Distinctive crown and taper; obtain an authoritative outline/height and roof reference first. |
| Jakarta | Autograph Tower | Existing OSM footprint and cited 382.9 m constraint; refine identifiable crown/façade only when references add value. |
| HCMC | Landmark 81 / Vincom Landmark Plus | Existing GLBs found under `public/models/` and `public/models/hcmc-hero-buildings/`; assess those assets before proposing reconstruction. Their existence alone does not establish quality or runtime use. |
| Other city dashboards | Locally distinctive civic/heritage structures | Same admission rules and asset contract. Select from each city's existing landmark inventory; verify names, coordinates, source rights and renderer before authoring. |

These are a proposed queue, not a completed model inventory. Only Jakarta and HCMC were inspected for this exploration. No changes were made to other city repositories.

## One workflow, separate city adapters

The reusable unit is an asset package, not a copy of Jakarta's UI. Store each admitted landmark under `landmarks/<city>/<id>/`, with:

```text
manifest.json                 identity, georeference, dimensions, rights, confidence
references/                   admitted images and source/credit metadata
object-sculpt-spec.json        upstream authoring specification
.img2threejs/state.json        staged authoring evidence/checklist
createLandmarkModel.ts         generated and reviewed Three.js factory
reviews/                      reference comparisons and multi-angle renders
model.glb                     optional, only after a verified export
```

Manifest contract (required for admission, not an implemented runtime API):

- `schemaVersion`, `city`, stable `id`, localized `names`, source feature identifiers. Use native language plus English; e.g. `id/en` for Jakarta, `vi/en` for HCMC.
- WGS84 `anchorLngLat`, anchor definition (ground base centre, not arbitrary bounding-box centre), vertical datum and ground altitude. Unknown altitude/datum must remain explicit; do not imply surveyed elevation.
- Metre units, measured model bounds, ground pivot, local axes (`+X east`, `+Y up`, `+Z south` for the delivery convention), and heading clockwise from north. A city adapter must convert this convention to its renderer explicitly.
- Per-part dimensions with source/date and confidence. Separate measured/published constraints from reconstructed or inferred detail. Never fit a model by vertically exaggerating its published height.
- Every reference's URL, creator, rights, access date and local hash. Upstream code licensing does not license reference photographs.
- Upstream commit, specification hash, generated-artifact hash, optional exporter identity/version, actual triangles/draw calls/texture bytes and LOD assets.
- Review evidence, per-region confidence, native/English approximation label, exact fallback feature IDs and admission state. A missing review is `pending`, never `passed`.

Keep geographic and reconstructed bounds distinguishable. These illustrative shapes must not enter flood displacement, exposure, drainage, evacuation or surveyed-height calculations.

## Authoring sequence

1. Prefer a licensed existing model or surveyed geometry when available. Otherwise gather credited front/side/oblique views and independently sourced height/footprint constraints. A single photo cannot establish the hidden façade.
2. Use the pinned upstream checkout. Read its `SKILL.md` at the start of actual reconstruction, initialize local state, and run its `forge/next.py` gate. This document does not replace the upstream staged workflow.
3. Intake → quality contract → landmark-specific component/detail inventory → strict specification validation → staged factory generation. Follow the ordered review gates; never use `--allow-nonstrict` to admit an asset.
4. Compare reference-aligned renders and multiple azimuths. Check the identity-defining feature (Monas flame, Cathedral spires, Wisma crown) separately from the overall silhouette. Record uncertain hidden regions.
5. Measure finished geometry and performance. The upstream triangle budget chooses primitive tessellation; it is not a hard whole-model triangle ceiling. Count the actual output.
6. Package the reviewed factory. If a separately validated exporter is available, export GLB and review the exported render, dimensions, materials and hierarchy again. A valid GLB container does not establish a correct landmark.
7. Admit one Jakarta pilot only after browser placement, shared-depth occlusion, source picking, 2D fallback, failure recovery and mobile performance pass. Then reuse the asset contract through each city's renderer adapter.

Reproduce the upstream capability checks without global host installation:

```sh
git clone https://github.com/img2threejs/img2threejs.git /tmp/img2threejs-landmark-review
git -C /tmp/img2threejs-landmark-review checkout --detach a669e9a97cea4452b1c2310c5cca6aa0f6657c1f
cd /tmp/img2threejs-landmark-review
python3 -m unittest forge.tests.test_tessellation_tiers forge.tests.test_targets
```

Use a fresh review directory. No installer, private environment plugin or hosted image-to-mesh service is required for this capability check.

## Map integration and release boundaries

Jakarta uses MapLibre **6.4.1**, `public/app.js:addHeroLandmarks`, `jkt-landmarks-src`, and native `fill-extrusion`. Read the [official Three.js custom-layer example](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/) for the shared canvas/context and Mercator metre conversion. The current online example uses a newer MapLibre version; verify the pinned 6.4.1 render callback locally rather than pasting it unchanged.

- Render admitted models inside the map's custom 3D layer, sharing its GL context/depth; no second overlaid canvas. Reset renderer state and preserve the map's buffer. Preserve footprint-based picking and precise location/source labels.
- Load only visible, zoom-eligible landmarks; self-host the pinned runtime/assets. Start with one Monas model and measure at 390 px. Proposed initial ceilings: 6,000 triangles/model, 8 draw calls/model, 500 KB compressed geometry/model and 12,000 visible landmark triangles on phone. These are trial budgets, not measured results or upstream guarantees.
- Suppress only matching native extrusion feature IDs **after** model load and admission succeed. Restore them on load failure, style changes, disposal or 2D mode. Outline, source evidence and selection stay available. Never hide the whole building archive to remove one overlap.
- Use map-driven repaint for static landmarks; no permanent animation loop or automatic turntable. Dispose geometry/materials/textures on removal, handle context loss, and do not dispose the map's shared context.
- UI stays inside the existing selection/source surfaces. Label inferred detail `Model rekonstruksi · perkiraan` / `Reconstructed model · approximate`. No additional header, footer or persistent panel.
- HCMC's inspected dashboard uses Mapbox/deck.gl and already has a different landmark interface. Reuse the manifest and asset, but implement its adapter against that renderer's API and depth behavior. Do not transplant Jakarta's MapLibre callback blindly.

Release acceptance: real metre height and correct anchor/heading; no doubled buildings; selected landmark retains bilingual name/location/evidence; hidden/rear surfaces labelled; no added initial-load runtime cost while disabled; 2D/load failure restores original geometry; phone and desktop visual receipts; frame-time comparison with the same camera and layers before/after. Only then commit, push, deploy and verify the specific live model.

## Status

Exploration and reproducible capability checks complete. **No photographic reconstruction, GLB export, renderer integration or live landmark release has been verified yet.** The next concrete implementation is the reference-backed Monas pilot. This research changes no deployed dashboard bytes.
