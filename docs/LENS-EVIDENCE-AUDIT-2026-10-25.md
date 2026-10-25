# Lens evidence audit — 25 October 2026

**Subject:** the water lens of the Jakarta 3D atlas, and the deep link the
water-recovery receipt publishes.
**Release audited:** `jakarta-atlas-20261025-1792913608-001fbbc` (the live build
when this pass began).
**Release shipped:** `jakarta-atlas-20261025-1792945397-f014ee6`.
**Law:** `docs/ANTI-SLOP-DESIGN.md` v1.11 (project) and
`/Users/nonarkara/Projects/DESIGN-ANTI-SLOP.md` v1.12 (shared stack).

The report is written in the law's §7 form. Every number here was measured; the
receipt of the pass being audited is at
`docs/WATER-RECOVERY-AUDIT-2026-10-25.md` and is treated as a claim, not as a
measurement.

---

## Found

**1. The water lens's evidence was sealed shut, on the deep link and on the
click alike.** Measured on the live release `…-001fbbc` at 1440, 1024 and 390:
`#atlas-lens-evidence.open === false`. Inside that closed `<details>` sat the
lens title ("Alur air terpetakan, bukti air masuk"), its description, the count
of 3,885 mapped features, the legend of their kinds, the gauge inventory, the
polder budget and the retry chip. The reader got the hydrography map and a
rail whose first tab read "Lihat bukti" among fourteen lens buttons.

Evidence: `docs/lens-evidence-2026-10-25/deep-link-before-1440.png`,
`deep-link-before-390.png`, `panel-before-1440.json`.

**2. Four lenses opened their evidence and the water lens did not.** Rain,
haze, air and flood monitoring open the panel on a desktop screen; waterways
and traffic never did. The water branch was added after the rule and the rule
was never written down — so there was nothing for the branch to follow.

**3. The legend was an orphan.** On the live page the panel's children were, in
order: the count (index 0), the description (1), then four sections, then the
legend at **index 7** — six elements below the count it explains, wedged
between "Tutupan lahan · WorldCover 2021" and "Air masuk · pos & volume",
where it belonged to neither. It was also unlabelled: a bare line of numbers,
"Badan air 1.677 · Saluran 441 · Sungai 686 · Kanal 186 · Anak sungai 8 …".

**4. The legend was also a line of nothing.** The recovery pass moved the
legend's content into an asynchronous loader but left its placement. For the
whole load the legend was an empty `<p class="note">` holding 26px of margin:
a row of dashes that occupies space and says nothing. An empty paragraph has
no box, so a check on *box height* calls it empty — the space is in the
margins. The first version of this pass's own guard made exactly that
mistake, and the audit's mutation caught it.

**5. Neither audit could see any of it.** `scripts/geometry-audit.mjs` opened
the panel itself, by hand, on the line before every measurement — so its "5
viewports × 6 lenses" verdict described a state no reader is given.
`scripts/audit-rendered.mjs` audited `/atlas`, which opens on the city lens,
and never visited a lens deep link at all. The receipt's own published
screenshot, `docs/water-recovery-2026-10-25/live-1440.png`, shows the
hand-made state: the panel open and the budget section open, two clicks past
the link.

**6. The layer order the receipt claims was checked, holds in the order that
actually occurs — measured, not assumed.** The live add-layer log shows the
official drainage and polder group resolving *before* the 3,885-feature OSM
reference: `official-drain-lines`, `official-polder-fill` and
`official-polder-lines` were added with no anchor, and the water layers were
then inserted beneath `official-drain-lines`. The final style order (bottom
first) is `network-water-fill` → `network-water-lines` → `network-water-labels`
→ `official-drain-lines` → `official-polder-fill` → `official-polder-lines` →
`network-gauges`: the water fill stays beneath the official drainage, the
labels stay above the fill, and the gauges stay on top. Recorded in
`panel-before-1440.json`. The forced 9-second OSM delay was **not** completed
(this pass's browser run died on a screenshot timeout), so the extreme case is
reported as unverified in *Remaining*.

---

## Changed

**`public/app.js`** — the waterways/traffic branch opens the evidence panel on
a desktop screen **when the lens is chosen and before the fetch**, so the
panel opens and fills in front of the reader instead of appearing fifteen
seconds later. Same idiom as rain, haze, air and flood monitoring; the same
700px phone rule, so a phone keeps the map.

**`public/water-traffic.js`** — the legend is created with the count and the
description, appended **directly under the count** it explains, labelled
"Per jenis · …" / "By kind · …", and hidden while it has nothing to say. When
the mapped reference fails, it stays hidden and empty instead of leaving a
hole.

**`scripts/test-lens-evidence.mjs`** (new) — two contracts: the app opens the
evidence for the lens whose product is the panel, and the legend is the
count's own breakdown (adjacent, labelled, and never a line of nothing).

**`scripts/mutate-lens-evidence.mjs`** (new) — four mutants: the lens stops
opening its evidence; the legend goes back to its shipped place below four
unrelated sections; the legend holds a line of space while the count is in
flight; the legend fills but never appears. **4/4 killed.**

**`scripts/audit-rendered.mjs`** — a new block visits `/atlas?lens=waterways`
at 1440 and 1024 and measures the state a reader gets, with nothing opened by
hand: the panel is open, the lens title is painted, the legend sits under the
count, and an empty legend occupies 0px. Each of the three checks proves
itself by putting the page back into the defect and requiring the same
function to report it.

**`scripts/geometry-audit.mjs`** — asserts the deep link **arrived** with its
evidence open, before the audit touches anything. The forced click stays, for
the phone, where the folded panel is the only state there is.

**`scripts/msh-evidence.mjs`** — the deep link is recorded as a route of its
own, at the law's three widths.

**`docs/ANTI-SLOP-DESIGN.md` → 1.11**, and the shared law → 1.12, with the
evidence of the defect above.

**`package.json`** — the new test and its mutation harness are in `npm test`.

---

## Verified

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run verify` | 13/13 |
| `npm test` | exit 0 — including the lens contract and **4/4 mutants killed** |
| `npm run release` | exit 0 — `jakarta-atlas-20261025-1792945397-f014ee6` |
| `node scripts/audit-rendered.mjs` (live) | **64/64** against `https://jakarta.nonarkara.org` |
| `node scripts/audit-rendered.mjs` (local build) | 64/64 |
| Live deep link, 1440 | panel **open**, legend **adjacent** (0 elements between), title painted |
| Live deep link, 1024 | panel **open**, legend **adjacent**, title painted |
| Live deep link, 390 | panel folded by design; legend adjacent in the DOM |
| Live traffic lens, 1440 | panel **open** |
| `node scripts/geometry-audit.mjs` (live) | **PASS** — 5 viewports × 6 lenses, no overlap, no sideways overflow, touch targets held, exit 0 — with the new "the deep link arrived open" assertion passing for the water lens at 1440 |

The live measurements are in `docs/lens-evidence-2026-10-25/panel-after-live.json`;
the pixels are `deep-link-after-waterways-1440.png`,
`deep-link-after-waterways-1024.png`, `deep-link-after-waterways-390.png` and
`deep-link-after-traffic-1440.png`.

---

## Remaining

1. **The forced 9-second OSM delay was not re-measured.** The natural order
   was measured on the live site and holds (see *Found* 6). The extreme
   ordering — the official group first *and* the OSM reference nine seconds
   late — was not completed; the browser run died on a screenshot timeout.
   Reported as unverified rather than as a pass.

2. **The lens-open policy is still the owner's call.** Waterways and traffic
   now open their evidence because their product is a number. Exposure, green
   space, the arrival scenario, height confidence, city, night, rain radar,
   Himawari, observed water and recurring water keep theirs folded, because
   their product is the map. That is a defensible line, but it is a line this
   pass drew at the boundary of what it could prove. If the owner wants the
   rule stated differently, the branch is one line each.

3. **A phone keeps the panel folded.** Below 700px the water lens shows the
   map and the "Lihat bukti" rail tab; the evidence is one tap away, and the
   map keeps the screen. That is the existing house rule, not a defect — but
   it means the deep link's promise is weaker on a phone, and the law's §6
   records it as folded at 390.

4. **`/api/atlas/hydrology` is slow on the live edge.** On a click (not a deep
   link) the gauge section was still "Memuat pembacaan penerbit…" after 12
   seconds at 390. The panel says it is loading, which is honest, but the
   latency is upstream and was not investigated here.

5. **The instrument's falsifier still exits 1 on three receipt rules that do
   not bite**, for the measured reasons recorded in the previous pass. It must
   not be weakened to go green.

6. **Owner-account items, unchanged:** the Perplexity connector (absent from
   the catalogue), the GitHub Actions spending limit (manual push path in use)
   and the Cloudflare rate-limit namespace (one dashboard step, then uncomment
   `[[ratelimits]]` in `wrangler.toml`).

7. **Open by design:** field validation and calibrated flood forecasting
   (`docs/ADMIN-READINESS.md`).

---

## The law that comes out of it

**A deep link must deliver the lens it names; a guard that opens the
disclosure before it measures has measured a state nobody was given; and an
orphan is not fixed by moving it closer to its subject — it is fixed by naming
what it belongs to.**
