# MSH — the law this project is held to

**This file is a pointer, not a copy.** The canonical law is the owner's, and
a stale copy of it in a project is exactly the failure mode the law is about:
rules bend over time, and the thing that bends first is the copy nobody
re-reads.

**The canonical text:**
- the owner's law, in the owner's workspace — `/Users/nonarkara/Projects/MSH.md`;
- the skill package's copy, which carries the same body and says not to rewrite
  it — `references/msh-law.md` in the `spatial-law` skill;
- the document the owner wrote and sent, kept untouched by the skill —
  `/Users/nonarkara/.minimax/v2/assets/2026/10/22/02-03-30-982-asset_20261022-020330-982_ecbc32be115d_1e794b73-pasted-text.txt`.

**If the skill package and the owner's law differ, the owner's law wins.**

## What binds this project

- **§1 The definition.** Spatial hallucination is when an interface invents a
  reason for things to occupy space, instead of arranging them around how
  people read, choose and act. The test for every region: *why is this here,
  why this size, and why this far from that?* "The grid put it there" is not
  an answer. The owner's own framing: SH is bad bureaucracy — bloated,
  disorganized, unbalanced, hard to read, longer than it should be. Good
  bureaucracy is a bento box: neat, varied, easy to transport. **MSH** is the
  standing order — when you find SH, massacre it.
- **§3 Recognize SH on sight.** Eleven symptoms: gigantic top bar, unjustified
  gaps, orphan photo or block, scattered actions, equal-weight everything,
  accidental wrapping, expensive small decision, inflated controls, stretched
  cards, empty hero or spacer, overlapping chrome.
- **§4 The laws.** Space must have a job; chrome earns its pixels; content
  determines size and the task determines the composition; compose the first
  screen before extending the page (390 × 844 and 1440 × 900, and the
  intermediate 1024); hierarchy must survive the viewport; relationships
  determine distance; responsive layout is a composition decision.
- **§5 Repair procedure.** Inspect the rendered geometry, name each failure
  precisely, repair the cause, preserve the product, render again, record
  evidence. **Do not solve SH by adding another spacer, panel, badge, slogan,
  stock image or row of identical cards.**
- **§6 Evidence required before declaring a pass.** Capture the real interface
  at 390, 1024 and 1440; for each viewport record chrome cost (height *and*
  share of the viewport, stacked bands together), task visibility, geometry
  failures, hierarchy and preservation. A large footprint is a prompt to
  investigate, not a universal numeric failure. Source scans and successful
  builds cannot prove a visual pass. If rendering was unavailable, report
  **unverified**.
- **§7 The agent's completion report.** **Found** (element, viewport, task
  cost) · **Changed** (the spatial demand removed) · **Verified** (screenshots,
  measured before/after, interactions exercised) · **Remaining** (never claim
  a clean pass while anything is left).

## How this project holds itself to it

| The law's demand | Where it is met |
|---|---|
| §3 the eleven symptoms, caught on sight | `scripts/spatial/` — the owner's instrument, vendored byte-identically and pinned by `scripts/spatial/INSTRUMENT-SHA256.txt`, which the gate verifies before it measures anything |
| §4 compose the first screen at 390 / 1024 / 1440 | `scripts/spatial-gate.mjs` sweeps 52 widths over four routes; `scripts/msh-evidence.mjs` captures the three the law names and writes `docs/msh/MSH-EVIDENCE.md` |
| §6 chrome cost, task visibility, geometry, hierarchy, preservation | `docs/msh/MSH-EVIDENCE.md` — measured on the **deployed** site, with the screenshots beside it |
| a hole may exist, but not without a written reason | `design/spatial-baseline.json` — the reasons block; a reason that no longer matches a measured decision is a **failure**, and deleting it is a thing a person does by hand |
| the rule must actually run | `scripts/spatial-reasons.mjs` — the instrument switches its own stale-reason check off whenever a sweep is narrowed by route, and this gate has to name its routes, so the project checks the rule itself against a complete sweep. `scripts/mutate-spatial-reasons.mjs` — four mutants, all killed |
| the page must have one layout before it is measured | `public/atlas-layout.js` assembles the atlas before the first paint; the workbench class is in the markup and the sections that move into the drawer are hidden where they stand. A page that paints one layout and settles into another is measured as a coin toss |
| a gate that has never failed protects nothing | `scripts/spatial/spatial-falsify.mjs` injects one real defect per mode, including a fixed bar that covers the work, and requires the gate to catch every one |
| the instrument must not drift from the law | the vendored files are pinned by hash; a hand-edited instrument fails the gate before it measures anything |

**The standing order: when you find SH, massacre it.** Remove the invented
need for space. Restore the useful picture. Make the screen help the human
read, choose and act.
