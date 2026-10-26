# Panel control audit — 26 October 2026

**Subject:** the evidence panel's controls, and the gates that were supposed to
rule on them.
**Build audited:** `jakarta-atlas-20261025-1792952480-85ae974` (the live build
when this pass began).
**Law:** `docs/ANTI-SLOP-DESIGN.md` v1.12 (project) and
`/Users/nonarkara/Projects/DESIGN-ANTI-SLOP.md` v1.13 (shared stack).

This pass follows the 25 October pass, which made every panel lens arrive with
its evidence open on desktop. That pass was audited rather than believed, and
it held: the helper is one helper, the four extra lenses open, the phones stay
folded, the geometry audit sweeps nine lenses and holds all but `city` to the
arrival check. Its exposure-row fix is in house style.

What it missed is below. Every number was measured; the geometry audit's own
failure is the evidence.

---

## Found

**1. The panel's control floor was 44px, and every house style since had been
a carve-out from it.** `public/style.css` declared
`#atlas-lens-body button { min-height:44px }`. The house styles that followed
are all exceptions to it: the direct-child row (32px), the action row (32px),
the retry chip (32px), the observation link (0), the ranking row (24px). A
control nobody remembered to carve out was therefore a **44px slab round a 16px
line — 2.75× its own text**, against a law that says a box is its label plus
padding.

**2. Four such controls existed.** Measured by the geometry audit against the
live build, with every disclosure in the panel open:

```
FAIL 1440x900 air:     MSH, box bigger than its content (behind a disclosure):
                        air-transport-button is 44px tall round a 16px line (2.8x)
FAIL 1440x900 traffic: … Load selected camera is 44px tall round a 16px line (2.8x)
FAIL 1440x900 traffic: … Try current channel broadcast is 44px tall round a 16px line (2.8x)
FAIL 1440x900 traffic: … Try current channel broadcast is 44px tall round a 16px line (2.8x)
GEOMETRY AUDIT FAILED: 4 problems on https://jakarta.nonarkara.org
```

The traffic ones are the toll panel's "Muat kamera terpilih" and the YouTube
panel's two "Coba siaran kanal saat ini" — each a 44px box with a 16px line
floating in it and a stray hairline down its right edge. The air one is the
wind-transport button, in the panel the last pass widened.

**3. No audit had ever said so, for two reasons that are the same reason.**

- *The traffic lens was in no sweep.* The geometry audit listed six lenses,
  then nine. The lens with **33 controls in its panel** was in neither.
- *Even in a sweep it would have missed them.* A control inside a collapsed
  `<details>` is not on screen, so `checkVisibility` says no and the MSH rule
  never ran on it. The audit measured the panel's **arrival** state — and
  these controls only exist after the reader opens a section.

**4. The panel was measured while still filling.** The audit waited for the
panel body to cross **160 characters**. The traffic panel fills in stages — the
camera catalogue, then the toll catalogue — so it crossed 160 characters at
its first paragraph and was measured there.

**5. And the rail's rule was never scoped to the rail.** The rail is a `<nav>`
whose first child is the evidence panel, so `.atlas-lenses button` — the rule
that describes the rail's sixteen tabs — also reached the panel's thirty-three
controls. It gave them the rail's hairline separator: a stray 1px vertical
rule down the right of every panel button, in the middle of the panel, beside
text. It also gave them the rail's 44px height, which is how three of them
became slabs. A rule that is not scoped to what it describes reaches the thing
next door and dresses it wrong.

**6. An ad-hoc probe of my own missed one of the four.** A sweep of 190 panel
buttons across 14 lenses, with every disclosure open, found three slabs. The
gate found four: the air lens's transport button arrives later than the probe
waited. The gate is the instrument; the probe was a look around it.

---

## Changed

**`public/style.css`** — two changes. The floor is now the house style:
`#atlas-lens-body button { min-height:32px; padding:4px 0; }`, with the resets
the panel had been inheriting from the rail by accident — transparent, the
panel's ink and type, clickable, no border. A control is its label plus
padding; a dense list row may still go tighter (`.lens-row--button`). This
fixes the class, not the four instances: the next control nobody remembers to
carve out is right by default.

And the rail's rule is scoped to the rail (`.atlas-lenses > button`), so it
stops dressing the panel. The rail itself is unchanged: measured live and
local at 1440 and 390, the lens tab and the "Lihat bukti" summary render
identically — 24px, 12px, a 1px separator.

**`scripts/geometry-audit.mjs`**
- the sweep now names every lens that carries a panel — `traffic` and
  `coverage` join the nine;
- the panel is waited on until it **stops changing**, not until it crosses a
  threshold; a panel that never settles is reported as *unverified*, not as a
  pass;
- the controls are measured **with every disclosure open** — a control the
  reader can reach must be ruled on. The layout rules stay on the arrival
  state, because a fully expanded panel is not the state the reader arrives
  in, and the panel's own first screen is a separate question with its own
  answer (the polder budget's).

**`scripts/audit-rendered.mjs`** — the release-path gate, already run against
the deployed bytes, now opens the panel's disclosures and requires that **no
panel control is bigger than its own text**, with a bite test that puts a
control back on the 44px floor and requires the check to report it.

**`scripts/test-lens-evidence.mjs`** — three more contracts: the floor is not
44px, the sweep names every lens, and the audit opens the disclosures and
waits for the panel to settle.

**`scripts/mutate-lens-evidence.mjs`** — four more mutants: the floor goes
back to 44px, the traffic lens leaves the sweep, the rail's rule reaches the
panel again, the audit stops opening the disclosures. **8/8 killed.**

The harness now says so out loud too. A mutant whose anchor has gone stale is
an unverified guard, not a pass: one had gone stale — the floor mutant broke
because the rule grew a property — and the harness printed "7/8" without saying
which one it had not checked. It counts skips now, and fails on them.

**`docs/ANTI-SLOP-DESIGN.md` → 1.12**, the shared law → 1.13.

---

## Verified

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run verify` | 13/13 |
| `npm test` | exit 0 — including **8/8** lens mutants killed, no skips |
| `node scripts/audit-rendered.mjs` (local build, with the fix) | **68/68** |
| `node scripts/audit-rendered.mjs` (live) | **68/68** against `https://jakarta.nonarkara.org` |
| `node scripts/geometry-audit.mjs` (live, before the fix) | **FAILED with 4 problems** — the guard bites on the shipped defect |
| `node scripts/geometry-audit.mjs` (live, after the fix) | **PASS** — 5 viewports × 11 lenses, exit 0 |
| Live traffic panel, disclosures open | 36 controls, **0 slabs**; the three offenders are 32px round a 16px line |
| Live air panel, disclosures open | 4 controls, **0 slabs** |
| `npm run release` | exit 0 — `jakarta-atlas-20261026-1792977256-b87cfd4` |

The live measurements are in `docs/panel-control-2026-10-26/panel-controls-live.json`;
the pixels are `traffic-panel-open-1440.png`, `traffic-channels-after-1440.png`
and `air-panel-open-1440.png`.

The "before" row is the proof that matters: the widened, disclosure-opening
sweep **fails on the shipped build**, and the four lines it prints are the
defect, named.

---

## Remaining

1. **The falsifier still exits 1.** Two dead rules remain, and the cause was
   measured and is in the instrument, not in this repo: the probe counts a
   control as an action only if it is an input or a *loud* control, and the
   dashboard and research pages have none, so their recorded first action is
   `null` at every width and no limit can be applied to them. The repair
   belongs in the shared instrument — the fixture must mount its own in-flow
   loud control below the spacer — and the vendored files stay
   byte-identical to the recorded hashes. Nothing here was weakened to make it
   pass.

2. **`/api/atlas/hydrology` is slower than the receipt said.** Measured from
   here just now: 3.56 s, then 1.62 s, then 2.08 s, with
   `cf-cache-status: HIT` and `max-age=14400`. The cache is working and the
   panel says it is loading; the specific figures in the 26 October follow-up
   (0.74 s / 0.36 s) did not reproduce from here.

3. **The geometry audit is not in the release path.** The *control* rule is:
   `scripts/audit-rendered.mjs` runs against the deployed bytes on every
   release and now requires that no panel control is bigger than its own text.
   The broader sweep — every lens, every viewport, overlap and overflow and
   touch targets — is the instrument that found all four defects, and it runs
   by hand. Putting it in `scripts/deploy-live.sh` would put the whole sweep
   in force at the only moment it matters, at the cost of roughly twenty-five
   minutes a release. That is the owner's call, not this pass's.

4. **The traffic lens is in the geometry sweep but not in the release-path
   sweep.** The rendered audit visits the waterways lens, whose panel holds 61
   controls — more than the traffic lens's 33 — so the rule is in force at
   release time on the biggest panel in the product. The traffic lens's own 33
   are swept by hand.

5. **Owner-account items, unchanged:** the Perplexity connector (absent from
   the catalogue), the GitHub Actions spending limit (manual push path in use)
   and the Cloudflare rate-limit namespace (one dashboard step, then uncomment
   `[[ratelimits]]` in `wrangler.toml`).

6. **Open by design:** field validation and calibrated flood forecasting
   (`docs/ADMIN-READINESS.md`).

---

## The law that comes out of it

**A rule is not in force until the measurement that enforces it reaches the
case the rule is about. A sweep that names a selection of lenses is not a
sweep of the product; a threshold that says "more than 160 characters" is not
"the panel has finished"; and a disclosure that hides a control from the
audit hides it from the rule.**
