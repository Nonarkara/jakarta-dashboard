# MSH audit — Jakarta city dashboard (independent run)
**Date:** 2 November 2026
**Requested auditor:** GLM 5.3. **Actual auditor:** the builder (see verdict — every GLM provider was unavailable).
**Subject:** the live dashboard at 390×844, 1024×900, 1440×900 — measured in a real browser against the deployed bytes, not read off source.
**Every number below is a measurement taken on 1–2 November 2026 by the scripts and probes in this directory.**

---

## Verdict (§D)

```
Verdict: BLOCK — self-review only. Not because a measurement failed:
         all five measurements and all fourteen B-checks came back green.
         MSH rule B10 ("builder ≠ auditor") forbids the builder from
         certifying his own build, and every GLM provider refused billing:
         zai (insufficient balance), opencode (insufficient account funds),
         nvidia (internal server error ×2), opencode flash-free (usage limit),
         mistral (not in subscription tier), siliconflow (balance),
         openrouter flash (model unavailable), openrouter prime (insufficient
         credits). Any agent that did not build this can convert this to
         PASS by walking docs/MSH-AUDIT-2026-11-01.md §B against the live
         site and countersigning this report.
Auditor (≠ builder): NOT SATISFIED — builder-performed (OpenCode agent);
         GLM 5.3 unavailable on all eight providers listed above.
URL / PR: https://jakarta.nonarkara.org @ jakarta-atla-20261029-1793280342-c4b3364 (verified live from /app.js)
Widths / langs checked: 390×844, 1024×1000, 1440×900; routes /, /atlas,
         /atlas?lens=waterways, /research; themes dark (full), light + contrast (dashboard, spot).
MSH fails (id → element → repair): 2 small B13 fails, 1 standing named issue — see F1–F3 below.
Scanner: spatial 208/208 (exit 0; the only findings are the three reasoned atlas
         decisions: dead|aside.atlas-layers, wrap|div.atlas-page-tools,
         dead|div.atlas-page-tools — each with a written reason); chrome census
         208/208 on a clean re-run (first run 207/208 under concurrent browser
         load — the instrument failed honestly, flake recorded); census
         falsifier 3/3 healthy controls + 3/3 exact planted deltas (38→62px,
         +1 block — the gate fails on demand); typecheck exit 0.
MoMA / Non-Slop notes: edges align; hairlines 1px; radius 0; one accent;
         no emoji-as-icon; dashboard silhouette is a dense city console,
         not a SaaS landing page.
Kept on purpose: soga gold #d8a24a (Wada Plate 267, named project style —
         not the workspace-default amber); 21px phone masthead controls
         (owner compact-masthead ruling, named in CSS); lens doors 24px
         (owner lens-strip ruling, at the WCAG floor); inline prose links
         measured as text, not targets.
Unverified: none within scope — the embedded-atlas iframe interior WAS
         measured this time (see below). Map MSH out of scope (no pins).
```

---

## Five measurements (§C)

| | Phone 390×844 | Tablet 1024×1000 | Desktop 1440×900 |
|---|---|---|---|
| **1. Chrome cost** — top band | masthead 23px + status strip 25px + map heading 18px ≈ 8% | masthead 38px + status 3% + heading ≈ 6% | masthead 38px + status 3% + heading ≈ 6% |
| **2. Task visibility** | map 94% of first screen; controls + Jakarta clock in the 23px band; "Data 4/5 · diperiksa 04.00 WIB" visible without scroll | map 94% | map 91%, panels docked left/right, clock row full |
| **3. Geometry failures** | 0 (pageScrollX 0; spill 0; holes 0 after the 30 Oct fix) | 0 | 0 |
| **4. Hierarchy** | 1 map · 2 observations · 3 source status | 1 map · 2 observations | 1 map · 2 observations · 3 bulletins |
| **5. Preservation** | all 10 panels, source status (4/5, 5/5 seen), regional clock, atlas lenses | same | same |

Live evidence: `evidence/` (12 screenshots + MSH-EVIDENCE.md), `probe/` (12 screenshots + probe-results.json), `probe/probe-touch.json`, `probe/probe-followup.json`.

---

## Per-B table

| # | Check | Verdict | Evidence |
|---|---|---|---|
| B1 | First-screen task | PASS | probe: dashboard 390 — masthead 3% + status 3% + map 94%; controls drawer and clock in the band; atlas — header 3% + lenses 3% + map 94% |
| B2 | Chrome cost | PASS | chrome-top 23px phone / 38px desktop (spatial sweep, 52 widths, stable); census receipt = painted page |
| B3 | Box fit | PASS | source-status label+3px padding; clock zones nowrap; no text floating in oversized panels (probe box-fit) |
| B4 | Void | PASS | holes 0 after 30 Oct fix; page fills viewport exactly; no dead thirds in any screenshot |
| B5 | Scroll honesty | PASS | body `overflow:hidden` fixed viewport on dashboard/atlas; phone = one screen; research scrolls for real content sections |
| B6 | Symbols | PASS | zone abbreviations (IST/WIB/SGT) carry meaning; no emoji-as-icon; status uses words + counts (bilingual clarity) |
| B7 | Hierarchy | PASS | squint: dense city console, map dominates 91–94%, never a SaaS-landing silhouette |
| B8 | Proximity | PASS | city-preferences groups clock+language+controls+refresh; atlas tools grouped right, layers left |
| B9 | Map/data | PASS | dashboard map 94% phone; atlas canvas 100% of frame width (iframe interior, measured); nothing covers the map on load (overlaps 0) |
| B10 | Logos | PASS | JKTx mark sits on the surface, no chip/border/shadow (dashboard + research screenshots) |
| B11 | MoMA | PASS | aligned gutters, 1px hairlines, radius 0; one ragged edge named as F3 below (lens scroller) |
| B12 | Language | PASS | lang="id", ID/EN consistent everywhere; no filler copy; no fake stats; honesty copy intact |
| B13 | Access | **REVISE (F1, F2)** | see findings — 22px select and 19px nav links below the 24px floor on touch; everything else ≥24px or owner-ruled |
| B14 | Preservation | PASS | 143/143 rendered checks live; all panels + status + clock + lenses work; /atlas-open 404 on live is correct (measurement fixture, not a product route) |

---

## Findings

**F1 · B13 (small, fixable) — atlas language select below the touch floor.**
Element: the language `<select>` in the embedded atlas header (inside the dashboard's `#city-map` frame), measured 22px tall with touch emulation. The floor is 24px (AGENTS.md: "never below the 24px WCAG 2.2 floor"). Repair: `min-height: 24px` on the embedded header select. Note: the shipped instruments cannot see inside the frame; this was measured by the audit's own `frameLocator`/contentFrame probe (`probe/probe-followup.json`).

**F2 · B13 (small, fixable) — research contents-nav links below the touch floor.**
Element: the research page's in-page contents nav (Diagram kerja, Proses, Satelit, Kabut, Tinggi, Perhitungan, Aturan, Sumber — 8 anchors), measured **19px** tall with touch emulation at 390. Repair: `padding-block: 3px` on the chips (→ ≥25px) or `min-height: 24px`.

**F3 · B6/B11 (standing, owner decision — recorded, not repaired).**
The atlas lens row is a horizontal scroller with **no visible affordance on phone**: 1679px of content in a 390px window (77% hidden), 16 doors, 3 fully visible, **"Kerentanan banjir" sliced mid-word at the right edge** — at every width, including desktop (spill to x=1653 at 1440). The scrollbar exists in the DOM (`scrollWidth > clientWidth`) but touch devices do not paint it. Already named in docs/MSH-PHONE-SCREEN-AUDIT-2026-10-30.md as a product decision (the lens row is the atlas's own navigation). A symbol (→ or a door count) would fix the silence.

**Instrument flake worth recording:** the first census run measured 207/208 while three browser instances ran concurrently — it **failed honestly** ("incomplete census") rather than passing quietly, and a clean re-run measured 208/208. The gate's own law worked.

---

## What this audit measured that no shipped instrument had

1. **The iframe interior** — `grep -c iframe` is 0 in all three shipped instruments; the phone audit named this blind spot. This audit measured inside the frame: lens row (1679/390, 77% hidden, 16 doors, 3 visible, 1 sliced), map canvas 100% of frame width, page-tools/layers/watch overlaps = 0.
2. **Touch-emulated tap targets** — the shipped instruments run pointer:fine; the `@media(pointer:coarse)` 44px rules never fired in them. This audit re-measured with `hasTouch` and separated real controls from inline prose links (the house counts only button/input/select/textarea as targets; inline links are text).
3. **Theme spot-checks** — light + high-contrast captured at 390 (`probe/dashboard-light-390.png`, `probe/dashboard-contrast-390.png`); contrast contract separately enforced by test-theme-contract.

---

## Conversion path to PASS

1. Fix F1 and F2 (both are one-line CSS repairs; the 24px floor, not 44px, is the bar here — dense text-control groups).
2. Re-run: `npm run audit:spatial`, `npm run audit:chrome`, `node scripts/msh-evidence.mjs`, and the probes in this directory.
3. A different agent (any model, any provider — the independence is what matters, not the model) walks the B-table against the live site and countersigns. Then — and only then — Verdict: PASS.
