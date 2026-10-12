# Compact map chrome · 12 October 2026

User request: top bar and HUDs still occupy too much space for their information. Preserve all interactive maps, source/time labels, model layers, simulation, research content, language/theme controls and dedication.

## Changes

- Full atlas becomes a bounded workbench: 36px title/control row + 36px lens row on desktop; 44px + 44px on phones/coarse pointers. Move dataset-count eyebrow and maturity description into About, and view/basemap selectors into Controls. Every existing ID and value remains.
- Lens evidence moves into the lens row as its first sticky control. Context and evidence remain in a single bounded popup; the description no longer consumes another always-visible row.
- City watch starts collapsed at every width. The four readings and guidance live in a viewport-bounded popup. Sources, environmental controls, text tables, attribution and footer content stay in an explicit Sources drawer on the full atlas as well as the embedded atlas.
- Collapsed Layers and Quick jump fit their labels. Flyover remains inside Quick jump. Open panels keep all controls. Label typography uses Source Sans rather than tracked label mono.
- Dashboard map actions move into its existing Controls drawer. Default hint no longer reserves a bottom row; selected-overlay labels still appear on the map. Root phone navigation is a native Menu disclosure in a single masthead row. Keyboard close returns to the visible Controls summary for actions launched inside that drawer.
- The embedded atlas header remains hidden so it cannot become an accidental extra grid row. Popovers remain on screen and outside lens-row overflow clipping. Real map viewport changes resize the canvas; HUD/readings changes with identical viewport dimensions do not interrupt camera motion through a redundant resize.

## Local measurements

At desktop 1280×720, old full-atlas header 114.96px + lenses 54px + description 65px + expanded watch 97.59px covered about 332px before an unobstructed map. New full atlas: header 36px, lenses 36px, map 648px (90% of viewport), watch is a 30px label-sized button over the map.

Root dashboard: masthead 38px, map iframe 642.80px, existing readings/warnings rails retained. Phone 390×844: masthead 46px, iframe 758.80px; Menu is initially collapsed. Full atlas at 390×844: header 44px, lenses 44px, map 756px. Client/scroll dimensions agree in both axes. Phone tap targets stay 44px. These dimensions are real browser DOM measurements, not estimates from CSS.

## Verification

Full contract test chain passes. Added executed regression checks for visible focus restoration from drawer actions and map resize stability through HUD updates. Browser exercises: controls → filters → close/focus; phone Menu → Research; full-atlas Controls, collapsed/expanded watch, lens evidence and stage controls. The watch popup's inherited overflow clipping was found visually and corrected; its 360px popup fits the 390px viewport. Final deployment identity and visual receipts are recorded after live verification.
