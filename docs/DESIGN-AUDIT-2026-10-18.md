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

This is a design/integration release, not new calibrated flood or pollution forecasting. Angular isobars remain the honest shape of the existing sparse model grid. Public feed availability can vary. The pre-existing remote CI budget block is not resolved by a local green gate.
