# Live verification — 21 October 2026

What was measured on the **deployed** site, not on the local tree. The bytes on
the edge are the only deliverable; a local build is a claim, not a receipt.

**Build:** `jakarta-atlas-20261021-1792598910-24f8889`
**Commit:** `24f8889` (the tree that was deployed; the stamp commit `c22b437`
records the cache-busters written after it)
**URL:** https://jakarta.nonarkara.org
**Method:** the shared Chrome on CDP 9656, driven through Playwright
`connectOverCDP`. Viewport 1440×1000, and 390×844 for the phone reflow.

## The research page — the owner's named example

Dr Non's screenshot of the "Daftar sumber" section was called *"a prime example
of spatial hallucination"*. The chart's label column was `minmax(0,1fr)`, so a
short name stretched to fill the free space and invented a gulf between the
name and its own bar.

Measured on the deployed page, the gap between the end of each label and the
start of its bar:

| Chart | Rows | Label → bar gap | Widest gap | Bars width |
|---|---|---|---|---|
| `#height-bars` (building heights) | 5 | 14, 14, 14, 14, 14 | **14 px** | 485 px |
| `#src-status` (source status) | 4 | 14, 14, 14, 14 | **14 px** | 485 px |
| `#src-licence` (licence split) | 2 | 14, 14 | **14 px** | 485 px |

Fourteen pixels is the chart's own grid gap (`gap: 4px 14px`). There is no
invented space left between a name and its bar — the column is sized to its
content (`max-content`) and the bars share a left edge. The 485 px width is
`max-width: 65ch`, the reading measure.

Other geometry, same page, same deployment:

- The field frame is **707 × 716 px** and `hidden` is **false** — the frame
  keeps its place whether or not the model answers, and the `.stage-note`
  inside it carries the reason when it is empty. On this run the model
  answered, so the note was hidden and the canvas was drawn.
- The maths block is `minmax(0,24ch) minmax(0,65ch)` — measured
  `178.9px 484.6px` — so the term column and the formula column each answer
  their own content.
- The pipeline (`.pipe`) is **7 steps over two ranks**, 1120 × 432 px.
- The reading grid is `707.1px 392.8px` at 1440.

At **390 px** the chart reflows to the two-column mobile grid: the name and
its count share row 1, the meter spans row 2. No wrap, no orphan, no gulf.

## The atlas

- **The client is load-blocking.** At the `load` event:
  `readyState: "complete"`, `.atlas-workbench` present, canvas present. Before
  this pass the browser reported "loaded" while the atlas was an inert shell,
  so every check that read the page on load was reading a skeleton.
- **The status line is not a ribbon.** `#atlas-environment-status` measures
  **328 × 17 px** on one line under its heading. Before the fix it was a
  19 px-wide ribbon 370 px tall with 688 px of emptiness beneath the heading.
  The panel now answers its own width through a container query, not the
  viewport's.
- **"Refresh data" is not orphaned.** With the drawer open, the two actions
  sit on the same row: "Ikhtisar kawasan" at x 1045, y 274, 102 × 44; "Muat
  ulang data" at x 1163, y 274, 99 × 44. `sameRow: true`. The controls are two
  clusters — `.atlas-environment-layers` (354 × 97) and
  `.atlas-environment-actions` (354 × 44) — so the actions travel together.
- **The doors are reachable with the drawer open.** Hit-tested at their own
  centres: the research door (`.atlas-research-link`, 91 × 24) and city watch
  (`#atlas-watch`, 91 × 30) both return themselves as the element under the
  point. The opened drawer hangs below the row; it no longer covers them.

## What the release already checked, independently

`npm run release` ran on the committed tree and verified the deployed bytes,
not the local ones:

- `npm run typecheck` — clean
- `npm run verify` — 12/12
- `npm test` — the whole chain, exit 0
- `npm run audit:spatial` — 172 measurements across 4 routes and 43 widths
- `npm run audit:spatial:falsify` — 6/6 modes caught
- `npm run smoke` / `smoke:api` — 37/37 API, all assets
- `npm run smoke:dashboard` — exact build bytes on the dashboard
- `scripts/audit-rendered.mjs` — **38/38** against the live URL

## The release blocker the gate caught

`npm run release` failed on its first pass, inside `npm test`, before any
deploy: the Worker had gained `./rate-limit.js`, and three contract tests
compile the Worker into a `data:` URL module. A `data:` URL cannot resolve a
relative import, so the chain died with `ERR_UNSUPPORTED_RESOLVE_REQUEST` — a
Node internal — and the missing dependency was nowhere in the message.

`scripts/worker-bundle.mjs` now owns the import graph and refuses a
dependency that does not exist **by name**.
`scripts/test-worker-bundle.mjs` kills three mutants, 3/3.

The lesson is in both design laws: **a build step must not emit a reference it
cannot resolve, and it must name the cause.**
