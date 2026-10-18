# Jakarta design integration · 18 October 2026

Reviewed the 15–17 October changes before editing: coastal/WorldCover evidence, drainage, wind and haze, regional pressure, stepped landmark parts, the wind compass, compact evidence rail and standalone Research. The changes below preserve their source contracts, geometry, live canvases, tables and controls.

## Seven-rule review

| Rule | Finding | Change and verification |
|---|---|---|
| Content-sized frames | Research metric boxes repeated equal cells; unavailable model left a square of empty space | Unboxed wrapping figure/status groups. Model stage hidden while loading or unavailable, restored for validated data. Runtime test exercises outage. |
| Balanced composition | Seven process columns at 760px squeezed short labels and long explanations | Three columns on wide screens, one on phone. Working diagram takes the dominant column; supporting methods stay subordinate. |
| Reading measure | Only the lede had a measure; warning text had its own scrollbar inside a scrolling rail | Research prose capped at65ch. Full warning text stays in the rail's single scroll context. Method prose uses the same measure. |
| Authored typography | Standalone Research used platform fonts and a separate palette; tiny Universa menus hindered scanning | Shared Palette267 and self-hosted Universa/SourceSans3. Universa identifies the city/headline; SourceSans handles navigation, evidence, values and canvas labels. Two authored families. |
| No empty ornaments | Framed metrics and source states looked like generic cards | Retained meaningful data bars, class swatches and table rules; removed decorative metric cell frames. |
| Hierarchy | Formula grid gave every calculation equal priority | Sequential method rows, readable headings and a contents row. Dominant live diagram preserved. |
| Compact, communicative interface | Rain intro repeated the detailed pressure explanation; section anchors hid headings; trajectory time labels overlapped | Short bilingual intro; detailed method remains.52px anchor clearance under37px Research bar. Collision-placed time labels with leader lines; path and6h markers unchanged. Existing21/24px phone chrome retained. |

Research now offers explicit wind play/pause and a static field by default; reduced motion stays still. Cross-page links carry the selected language and preserve the rain lens. Slow archive requests no longer hold unrelated counts hostage; a failed catalogue stays unknown, never0. Night-light wording distinguishes750m sensor resolution from500m imagery, matching the actual layer contract.

## Enforced stack rules

The two owner-supplied documents are adopted in `docs/ANTI-SLOP-DESIGN.md` and project `AGENTS.md`. The shared stack has a durable copy at `/Users/nonarkara/Projects/DESIGN-ANTI-SLOP.md`, referenced by `/Users/nonarkara/Projects/AGENTS.md`. That parent directory has no Git repository; the portable Jakarta copies are versioned here. The installed `anti-slop-design` skill already matched the supplied skill, so it was not duplicated or replaced.

`npm run audit:design` runs inside `npm test`, CI and the canonical release. Tests cover objective font/layout contracts, preserved sections/canvases, partial/outage data loading, unknown counts, language links, crowded label placement and canvas edges. They cannot establish beauty; responsive screenshots and independent review are separate requirements. Live byte checks now cover Research HTML/JS, label helper, shared theme and dashboard CSS.

## Independent review

`/root/independent_design_audit` inspected live and localhost at1440,1024,390px and reviewed the implementation without editing it. The reviewer found the anchor, canvas-font and time-label defects after the first pass; all three were fixed and rechecked. Final verdict: all seven categories checked, no blocking regression in reviewed changes. Actual wind play/pause changed aria-pressed true→false. At390, page widths remain390; the root masthead remains23px, standalone atlas header24px; Research's bar37px.

Saved before/after receipts are in `docs/design-audit-2026-10-18/`. Source and time variation between frames is expected for real publisher/model feeds; screenshots are layout receipts, not controlled comparisons of weather.

## Limits

This is a design/integration release, not new calibrated flood or pollution forecasting. Angular isobars remain the honest shape of the existing sparse model grid. Public feed availability can vary. The previous project record reports a remote CI budget block. This release proves the canonical local gate; it does not claim a new remote CI run.

## Live release receipt

Implementation `014ecdc`; stamp `97f8a7f`; build `jakarta-atlas-20261018-1792334510-014ecdc`; Worker `4c6517af-a7d4-4be2-975e-8ab838df4f3a`. Canonical release exited0. Typecheck,12/12verification,36test commands, exact bytes on both hosts, archive/source smoke checks,37/37API checks and all four dashboard provider envelopes passed. No soft availability failures were reported in this run.

Parent verified live Research play/pause (aria-pressed true→false), EN/ID section links (heading top52.09px under37pxbar), shared reading font and responsive widths1440/1024/390. Live source catalogue/diagram loaded; main dashboard retained the dominant map and compact phone bars. Independent reviewer inspected live screenshots and independently matched Research HTML bytes; their fresh postdeploy browser interaction was unavailable, so independent interaction evidence is from the identical implementation before deploy. Parent performed the postdeploy interactions.

The final evidence check caught four mislabeled-width after screenshots from the initial batched resize/capture pass. They were re-captured from the live build with resize and capture separated, along with the other after views. `dimensions.json` records all27actual pixel sizes; every filename width was checked against the image. Baseline capture heights vary and are retained as captured. All final after views are900px tall. No image was rescaled or edited to make it pass.
