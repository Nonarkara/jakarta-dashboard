# Jakarta: deliberate style choices

Updated: 4 November 2026. These record existing owner choices from the project design law; the shared MSH, glance-path and kinetic-grid canons still apply.

## Type

Universa Civic, the owner's free CTAN Universa choice, supplies identity/display. Source Sans3 supplies reading, controls and tabular numerals. No third design family. Platform fallbacks only support failed font loading.

## Colour

Palette267 coastal/green/yellow relationship, adapted in `public/jakarta-design.css`: daylight, coastal night and high contrast. These are adaptations, not an official Jakarta brand specification. Hazard classifications, OSM route colours, satellite classifications and confidence tiers keep their scientific/transport meaning independently of the interface accent.

## Layout

Column/modular edge instruments, with the working map as the initial visual entry. Selected evidence/status and its action sit on the map's edge; full methods are deliberate reading surfaces. One compact masthead, a reachable source disclosure, no decorative hero, boxed logo or repeated identity band. Version/build remain in the existing release footer.

Dense text-control groups use the adopted24px floor, lens-panel controls32px, map zoom/rotate44px. A larger isolated-control rule must not inflate every bar. Enlarged text may earn wrapping; it must not overlap controls, hide the first useful action or make opening source reading shrink the map.

## Motion

Animations remain user-controlled, respect reduced motion, and stop on task change, manual input, hidden page and exit. A clock is labeled device time; a tick is not a data check. Geographic inputs and heights remain source-traceable; source geometry never implies current access, walkability, entrance location or calibrated flood depth.

## Allow

- rule default-purple in app.js: OSM light-rail mode fallback is a transport symbol; route-specific colour tags take priority. It is not the interface accent.
- rule eyebrow-caps in style.css: source/layer group indexes carry operational hierarchy in the map instruments, not promotional section labels.
- rule type-scale in style.css: map scales, attribution, evidence and controls have distinct established reading tasks; preserve their readable sizes during surgical changes. The rendered compactness and contrast gates remain required.
- rule heavy-image in data/jakarta-v1/worldcover-2021-reference.png: lossless categorical raster20m display asset with source manifest/hash and nearest-neighbour interpretation; lossy image compression would change class colours. Loaded only on request.
- colour #fffdf5: Palette267 daylight raised paper surface, paired with dark ink and gold interface action colour.
- colour #c9644a: established scientific diagram reference stroke `--lacquer` for blocked source tiers, floor-count height estimates and pressure markers; independent of the interface action accent.
