# Jakarta design law

Adopted from the two owner-supplied documents on 18 October 2026. Apply the installed anti-slop-design skill. The global copy is `/Users/nonarkara/Projects/DESIGN-ANTI-SLOP.md`; this committed copy travels with Jakarta.

## Anti-slop design rules (hard rules)

These are known AI design-slop patterns. Never re-create them. Check every page before shipping; fix any hit. They sit on top of Palette and any map-first rule.

1. **Boxes fit their content.** No text box, card, button or panel much wider or taller than its text. Padding follows type size (~0.5–1.5× line height). No fixed/min heights that leave empty space under short text.
2. **Balanced composition.** Deliberate grid; visual weight balanced. No heavy side with an empty side, no orphan block. Squint-test at desktop, tablet and phone.
3. **Readable line length (A4/A5).** Body ~45–75 characters (ideally 60–70); CSS `max-width: 65ch`. Thai/Chinese keep the same physical measure (~30–45 Chinese chars). Wide screens get columns or margins, never full-width paragraphs.
4. **No AI-slop fonts.** Banned as primary: Inter, Poppins, Montserrat, Roboto, Open Sans, Lato, DM Sans, Space Grotesk, Geist, Plus Jakarta Sans, Manrope, Nunito, system-ui-as-design-font. Prefer Bauhaus/Bayer Universal lookalikes: **Jost** first, Josefin Sans or League Spartan for display, Prompt or Kanit for Thai; matching geometric sans for Chinese. At most two families per product.
5. **No lazy ornaments.** No decorative boxes, borders, cards, dividers, blobs, gradients, glows or icon tiles only to fill or "balance". Every container groups things that belong together; if removing it loses no meaning, remove it. No emoji-as-icons, decorative stock icons, or generic gradient heroes.
6. **Clear hierarchy: something must win.** One obvious first look (hero number, map, headline), then second and third. Real contrast in size (≥1.5–2× type step), weight, colour and space. No equal-weight card grids. Squint-test must show a focal point.
7. **More slop to kill.** Centre-everything / symmetric card grids by default; fake depth (stacked shadows, glassmorphism, same radius everywhere); vague slogan heroes; filler copy ("Unlock the power…", "Seamless", "Revolutionize") and fake stats; too many colours (one meaningful accent); thick chrome that shrinks content; icons/badges on every line; dense same-size grey text.

**Pre-ship:** screenshot at 1440 / 1024 / 390; list hits against 1–7; fix; re-screenshot; different agent/person reviews — never self-review.

## Jakarta implementation

The map is the hero. It is the product; everything else is secondary to it, and a layout that lets chrome or an evidence panel outrank the map has failed even when every other rule passes. Concretely, on 19 October 2026 the owner directed: shrink the top bar, and treat any box that is larger than its text — especially one carrying space above and below the text — as a defect rather than as breathing room.

The reason is hierarchy, not taste. A box padded well past its content announces equal importance whether it holds a headline or a footnote, so the eye is given no order to follow and reads the page as a stack of equal slabs. Space earns its place by separating *different* things, never by inflating a thing that is already said.

A last child's trailing margin must not stack with its container's padding: the card then measures taller than its contents for no reason. Zero the trailing margin inside watch cards and popovers.

The map remains dominant. Universa Civic is the owner-selected CTAN implementation of the Bayer lineage; Source Sans 3 carries long evidence and values. Two authored font families; platform fallbacks are compatibility only. Scientific layers retain meaningful classes and source colours. Research shares those tokens and offers a 65ch prose measure. Counts are computed, time-labelled model data stays distinct from observations, and outages stay visible. Compact bars remain compact; do not reintroduce a 44px chrome row merely to enlarge a button frame.

`npm run audit:design` checks font faces, reading measure, unboxed metric layout, pipeline widths, preserved interactive elements and release wiring. It cannot judge composition or beauty. Save responsive screenshots, name findings for all seven rules, fix/re-capture and obtain an independent review.

## 20 October 2026 — reachability, hittability, and bars that mean something

Three audits in one week failed the same way: an assertion ran, passed, and
described nothing a person could observe. All three are now guarded, and each
guard has been shown to fail on the defect it forbids.

**The index hid its own page.** The research page carried eight sections and
its contents nav linked five. The three it dropped included the
height-provenance section — the only graphic on that page that renders without
a network call. `test-anti-slop-design.mjs` had asserted each section `id`
existed, so it stayed green through the whole regression. The guard now walks
the sections and the nav and requires them to correspond in both directions,
and requires every entry to carry both languages.

**The research page was unreachable from the map.** It existed, and it was the
one page nobody could get to from the atlas: its only link sat inside the
collapsed Controls disclosure. It now has a door in the atlas's own page-tools
row, beside the evidence drawer — an absolutely-positioned row that adds no
height, so the map keeps every pixel. The first attempt placed that row at
`z-index:40`, under the city-watch overlay at 42: it rendered perfectly and
swallowed every click. It now sits at 44. `audit:design` executes the real
drawer block and inspects the tree it builds, so deleting the link, moving it
inside the drawer, or letting it drift to a second name all fail the gate.

**A chart can be a picture of a chart.** The first rendered audit asked only
whether each bar row contained a filled element — which passed for every row
forever. It now compares the drawn width against the stated share, and reads
the share from `data-share` rather than from the printed text.

**Charts must be drawn from files this site ships.** Of the sixty sources the
catalogue assesses, eleven name an open licence (`CC BY 4.0`, `CC BY-NC 4.0`,
`ODbL`, `Apache-2.0`); forty-nine do not. Every graphic on the research page is
therefore computed in the browser from this site's own JSON, and the page says
so in both languages. "License-free" here means drawn here, not scraped from a
publisher who never granted the right.

`npm run audit:rendered` reads the deployed page rather than its source, at
1440 / 1024 / 390, on `/atlas` and `/research`, and runs inside `npm run
release`. It fails loudly — never silently skips — if it cannot run at all.

## 21 October 2026 — the spatial law, and what it found

The owner named the failure: **spatial hallucination** is when an interface
invents a reason for things to occupy space, instead of arranging them around
how people read, choose and act. The test is one question asked of every
region of every page — *"why is this here, why this size, and why this far
from that?"* — and if the answer is *"the grid put it there"*, the layout has
failed.

The previous pass (1.6) fixed collisions and wraps it could see. It could not
see the ones the eye skips, because nobody had swept the widths. This pass
installed the spatial-law instrument byte-identically, built the site the way
the Worker serves it, and swept 43 widths — every declared breakpoint, the
width just below it and the width just above it — across four routes.

**What the sweep found that the previous pass had missed**

1. **The charts the owner pointed at.** The research bar chart's label column
   was `minmax(0,1fr)`, so a short name stretched and invented a ~390px gulf
   before its own bar. A flexing label column invents space: size it to its
   content (`max-content`) and the bars share a left edge again.
2. **A control stranded by its own row.** In the 420px data drawer the
   environment controls were four flat flex children. "Refresh data" ended up
   alone on the last row. Controls are not tags: the two actions are now one
   cluster that travels together, and cannot be orphaned.
3. **A panel answering the wrong question.** The drawer panel reserved 230px
   for an absolutely-positioned summary, because its rules asked the
   *viewport's* width. At 1440px the panel is 402px wide, the status line was
   squeezed into a 19px ribbon 370px tall, and its own heading stood beside
   it with 688px of emptiness beneath. The panel's own width is the question,
   so the panel is now a **container query**.
4. **A frame that vanished.** When the pressure model did not answer, the
   research field's frame was removed — and the reading column stood alone
   beside half a screen of nothing. The frame now keeps its place and says
   why it is empty. A layout that is different depending on whether a remote
   service answered is not a layout; it is a coin toss.
5. **Doors under a door.** The opened data drawer was an absolute panel at the
   row's right edge, so it covered the research door and the city-watch door —
   the two actions the reader wanted next. It now hangs below the row.
6. **A page that reported itself loaded before it was.** The atlas client was
   appended by script after a dynamic import, and a script appended that way
   does not delay the load event: the browser said "loaded" while the atlas was
   still an inert shell, and every check that reads the page on load — this
   gate, the rendered audit — was reading a skeleton. The client is
   load-blocking now.
7. **A page that painted one layout and settled into another.** The atlas
   assembled its own chrome with JavaScript: the workbench class, the row of
   page-level doors, and the evidence popup were all created a third of a
   second *after* the first paint. The reader got a page that then grew and
   shrank under them, and the gate measured whichever state it caught — the
   same build, swept twice, reported the City watch as a hole in one run and
   the doors row in the next. A gate whose verdict flips on a coin is a gate
   nobody can read. The class is now in the markup, the sections that move
   into the drawer are hidden where they stand until they move, and the
   assembly itself runs in a classic script at the end of the body — before
   the first paint. **A page has one layout, and the gate must measure the
   layout a reader gets.**

**The blind spot, recorded because the law is about honesty.** The instrument
found none of the rail findings to be defects, and it never saw the drawer's
interior at all: a collapsed `<details>` keeps its contents in the layout
(Chrome's `content-visibility`) even though nothing paints them, so a measure
of the closed page read a 94px-wide ghost of a 420px panel. Two consequences,
both now in place: a closed drawer is not laid out at all, and the gate
measures the atlas a second time with the drawer **open** — a layout reviewed
only in the state it happens to open in is half a review.

**The receipt.** `design/spatial-baseline.json` holds the numbers and a
written reason for every decision that produced them. Two holes are blessed
and both are the same one: the lens rail and the row of doors float over the
map, so the space beneath them is the map. A stranger can check that by
opening the atlas. Nothing is left unaccounted for, and the falsifier injects
one real defect per mode and requires the gate to catch all six.


## 21 October 2026 (second pass) — the release gate failed on the release

The spatial pass shipped its code and the release script ran the tests, and the
tests died on the first one. The cause was not the spatial work: the Worker had
gained a dependency (`./rate-limit.js`), and three contract tests compile the
Worker into a `data:` URL module in order to import it.

A `data:` URL has no base URL. A relative import left inside it cannot be
resolved, so Node throws `ERR_UNSUPPORTED_RESOLVE_REQUEST` — which names a Node
internal and says nothing about the dependency that was actually missing. The
release had found a real defect in the *build*, and reported it in the one
vocabulary that hides it.

**The fix is not a patch; it is an owner.** `scripts/worker-bundle.mjs` now
resolves the Worker's whole relative import graph itself:

- a TypeScript module is transpiled and inlined as a `data:` URL;
- a plain JavaScript module with no relative imports keeps its file URL, so its
  bare import (`fast-xml-parser`) still resolves from `node_modules`;
- a dependency that does not exist is refused **by name**, at bundle time;
- a module that would have to be inlined but carries a bare specifier is
  refused **by name**, at bundle time.

Adding a dependency to the Worker is now a one-line change with no test to
remember. Forgetting one is a message that names the file.

**The refusal is the guard, and the guard is mutation-tested.** Three mutants
must fail it: a missing dependency ignored, a bare specifier ignored, a nested
relative import dropped. Three of three die. The bundler is written without a
bare specifier of its own, so it can be loaded as a `data:` URL and mutated in
place — the test attacks the bundler, not a copy of it.


## 21 October 2026 (third pass) — a verdict that was never read

An independent anti-slop review of the five shipped screens was run on 19
October, from screenshots taken at 09:19. It returned **DO NOT SHIP**: one
blocking defect and one navigation defect.

Both were fixed the same morning, in `f44db2b` at 09:37 — the evidence panel
that cut a line of text in half gained a bottom fade and 26px of padding, and
the lens strip that ran off the right edge gained a scroll shadow. Four more
findings went with them: the lede narrowed from 80 characters to 58, the top
three type ranks split from 27/24/24px to 48/32/21px, and the latent `90ch`
became `55ch`.

**And then the report was never opened again.**

The fixes landed; the verdict was never answered. The ship decision was taken
with the review still unread, and no finding was ever dispositioned in
writing. A fix without a disposition is not a closed review — it is a set of
commits that happens to contain the right changes.

So this pass read it, and answered every finding against the **deployed**
build, with a number where a number decides it:

- The blocking clip: gone. The rain lens panel is 240×692 and scrolls
  (690 against 1075), with `mask-image` over the last 26px and 26px of
  padding — the last line now fades into the scroll edge instead of being
  cut.
- The strip: the affordance is there — a four-layer scroll shadow, `local,
  local, scroll, scroll`, so the right edge is shaded and the cut tab is
  visibly dimmed.
- The lede: **58 characters per line**, inside the band.
- The hierarchy: hero 48px, h1 32px, h2 21px — steps of 1.50× and 1.52×.
- The 390 evidence door: present and hit-testable, which the review could not
  verify.

One finding is a judgement, and a judgement needs a reason rather than a
patch: the two rules that bracket the four counts span 1120px around 490px of
content. It is not a hole. The rules are the section's rules; the four counts
are a tight group 32px apart; the space to their right is the column's
margin; and the 48px number directly above already establishes that column's
right edge at 1280. The full reasoning is in
`docs/REVIEW-DISPOSITION-2026-10-19.md`.

**The law that comes out of it: a verdict must be read, not just its fixes
applied.** A review is closed by answering every finding, on the shipped
bytes, with a number where a number decides it and a reason where a judgement
decides it.


## 23 October 2026 (fourth pass) — the band that cropped its own controls

The shipability audit asked a question the spatial gate had never been asked:
**what does the gate not measure?**

The gate measures the atlas inside the instrument's iframe harness, and inside
an iframe the atlas hides its own header (`body.atlas-embedded .atlas-header
{ display: none }`) and clips its own root (`html.atlas-embedded-root { overflow:
hidden }`). So the gate has never once measured the atlas's header band, and
never once measured the atlas in the state `/atlas` actually serves — a
top-level page with a scrollable root.

It did not have to be asked twice. On the **deployed** build, at 768, 1024 and
1440px:

- the language select — the page's **first control** — sat at **y = −1.5px**,
  cut by the top edge of the document;
- the Controls summary hung 0.5px into the lens strip below it.

Both because the header row is 28px with 2px of padding — a 24px content box —
and both controls were still carrying the old 30px frame, the last two in the
app not yet brought down to the house size of 24px that every other control
had been given. A band that is shorter than what it holds does not push the
control away; it crops it, and a control cropped at the top of the page is
cropped by the top of the page.

The fix is in two parts, and both parts are the law:

- the two controls are 24px now — the size of their labels;
- the row is `minmax(var(--atlas-header-row), auto)` — the band **grows** to
  fit its contents rather than cropping them. The header is 29px now, one
  pixel more than before, because the title's brand mark needed it.

And the guard is a rendered one, because a source scan cannot see a crop:
`scripts/audit-rendered.mjs` now reads the band and every control in it, and
fails when a control does not fit. The guard proves itself on the page it
reads — the page is put back the way it shipped (a fixed 28px row, a 40px
control) and the same check has to report the crop **deeper**. A check whose
answer never changes is blind, and the audit fails saying so.

The falsifier's copy learned the same lesson. The instrument's "the page
scrolls sideways" rule cannot fire on a page whose root clips its own
overflow — the copy was measured embedded, where a 4000px block left
`documentElement.scrollWidth` at 390 — so the rule was structurally dead
there. The copy now measures the atlas the way `/atlas` serves it (a
top-level page, a scrollable root), and the rule bites again: the same block
leaves `scrollWidth` at 4000 and the page scrolls sideways, as it must.

**The law that comes out of it: a gate that measures one state of a page has
not measured the page; and a band that crops its own contents is not a
layout, it is a window onto one.**


## 25 October 2026 (fifth pass) — the lens that could not be reached

The water-recovery pass shipped a good fix and a receipt that said the water
lens was verified. The receipt's own link is the evidence against it.

`https://jakarta.nonarkara.org/atlas?lens=waterways` is the URL the receipt
publishes and the atlas's own share link for the water lens. Measured on the
live release `jakarta-atlas-20261025-1792913608-001fbbc`, at 1440, 1024 and
390: `#atlas-lens-evidence.open === false`. The lens title ("Alur air
terpetakan, bukti air masuk"), its description, the count of 3,885 mapped
features, the legend of their kinds, the gauge inventory, the polder budget and
the retry chip were all inside that closed `<details>`. The reader got the
hydrography map and a rail whose first tab read "Lihat bukti" among fourteen
lens buttons.

**A rule that is not written down is not a rule.** Four lenses opened their
evidence on a desktop screen — rain, haze, air, flood monitoring — and the
water lens did not, because the water branch was added after the rule and the
rule was never written down. The water lens's product is a *number*: the
count, its breakdown, the budget. A number lives in the panel. Folded shut,
the lens showed a picture and no number at all.

Inside the panel the legend was an orphan. It was appended after the coastal
tide and land-cover sections — six elements below the count it explained, where
it belonged to neither — and, because the recovery pass made the count arrive
on its own, it was an empty `<p>` holding 26px of margin for the whole load: a
row of nothing. An empty paragraph has no box, so a check that measured the
box height called it zero; the space was in the margins. Measure the space it
occupies, not the height of a box that was never there.

And the audit could not see any of it, which is why the receipt said the lens
was verified. `scripts/geometry-audit.mjs` force-opened the panel before it
measured, and `scripts/audit-rendered.mjs` audited `/atlas`, which opens on
the city lens. Both certified a state no reader was ever given.

So:

- the water lens opens its own evidence on a desktop screen, **when the lens is
  chosen and before the fetch** — the panel opens and fills in front of the
  reader instead of appearing fifteen seconds later;
- the legend is the count's own breakdown: directly under it, labelled, and
  never a line of nothing;
- the geometry audit now asserts the deep link *arrived* with its evidence
  open, before it touches anything, and the rendered audit visits
  `/atlas?lens=waterways` and measures the state a reader gets.

**The law that comes out of it: a deep link must deliver the lens it names; a
guard that opens the disclosure before it measures has measured a state nobody
was given; and an orphan is not fixed by moving it closer to its subject —
it is fixed by naming what it belongs to.**


## 26 October 2026 (sixth pass) — the control nobody measured

The panel's control floor was 44px, and every house style since had been a
carve-out from it: the direct-child row (32px), the action row (32px), the
retry chip (32px), the observation link (0), the ranking row (24px). A control
nobody remembered to carve out was therefore a **44px slab round a 16px line**
— 2.75x its own text, against a law that says a box is its label plus padding.

Three such controls existed, all in the traffic lens: the toll panel's "Muat
kamera terpilih" and the YouTube panel's two "Coba siaran kanal saat ini". Each
is a 44px box with a 16px line floating in it and a stray hairline down its
right edge.

**Nothing had ever said so, for two reasons that are the same reason.**

1. The traffic lens was in no audit sweep. The geometry audit swept six
   lenses, then nine; the traffic lens, with 33 controls in its panel, was in
   neither.
2. Even in a sweep it would have missed them. A control inside a collapsed
   `<details>` is not on screen, so `checkVisibility` says no, so the rule
   never ran on it. The audit measured the panel's **arrival** state — and
   these three controls only exist after the reader opens a section.

And the panel was measured while still filling: the audit waited for the body
to cross **160 characters**, so the traffic panel was measured at its first
paragraph, before the toll catalogue arrived.

So the floor is now the house style — 32px with 4px of its own padding, and a
dense list row may still go tighter — and the gates reached the case:

- the geometry audit sweeps every lens that carries a panel (traffic and flood
  monitoring join the nine);
- it waits for the panel to **stop changing**, not to cross a threshold;
- it measures the controls **with every disclosure open**, and leaves the
  layout rules on the arrival state, because a fully expanded panel is not the
  state the reader arrives in;
- `scripts/audit-rendered.mjs`, which the release already runs against the
  deployed bytes, opens the disclosures and requires that no panel control is
  bigger than its own text — with a bite test that puts a control back on the
  44px floor and requires the check to report it.

**The law that comes out of it: a rule is not in force until the measurement
that enforces it reaches the case the rule is about. A sweep that names a
selection of lenses is not a sweep of the product; a threshold that says "more
than 160 characters" is not "the panel has finished"; and a disclosure that
hides a control from the audit hides it from the rule.**


## Version history

This committed copy travels with Jakarta and mirrors the global
`/Users/nonarkara/Projects/DESIGN-ANTI-SLOP.md`. Every audit bumps it one
version.

| Version | Date | What the audit found that the previous pass had missed |
|---|---|---|
| 1.4 | 2026-10-20 | Three checks measured existence instead of the thing that matters: section id presence over index linkage, rendered box over clickable centre, bar existence over drawn width vs stated share. |
| 1.5 | 2026-10-20 | Research index answers to every section in both directions and both languages; page-tools door above the watch overlay at z-index 44, hit-tested at its own centre; charts compare drawn width to `data-share` instead of asserting a bar exists. 8/8 mutants killed. Research assets cache-busted. |
| 1.6 | 2026-10-21 | Spatial Hallucination audit: City watch integrated into atlas-page-tools flex row, eliminating unhittable overlap and magic pixel offsets; audit-rendered explicitly hit-tests City watch; lens-hours converted to 2-column tabular grid to eliminate accidental wrapping; lens-row formatted with flexible wrap and compact padding; research pipeline orphan slot eliminated. |
| 1.7 | 2026-10-21 | The Spatial Law adopted end to end: the vendored instrument, a Worker-faithful route server the gate measures the build through, `design/spatial-baseline.json` as the receipt, and a falsifier that catches all six modes. Fixed what the previous pass missed — the research charts' bars stranded from their labels by a flexing label column; the data drawer reserving 230px for an absolutely-positioned summary, which squeezed its status line into a 19px ribbon; “Refresh data” orphaned on a row of its own in the 420px drawer; the research field's frame vanishing when the model did not answer, leaving the reading column alone beside half a screen of nothing; the opened drawer covering the research and city-watch doors; and the atlas client not being load-blocking, so the browser reported the page loaded before the atlas existed. Two holes are blessed with written reasons; none is left unaccounted for. |
| 1.8 | 2026-10-21 | The release gate failed on the release, and the error named the wrong thing. Adding `./rate-limit.js` to the Worker broke three contract tests at once: each compiles the Worker into a `data:` URL module, a `data:` URL has no base to resolve a relative import against, and the whole chain died with `ERR_UNSUPPORTED_RESOLVE_REQUEST` — a Node internal — with the missing dependency nowhere in the message. `scripts/worker-bundle.mjs` now owns the import graph: it resolves every relative import into a module URL, keeps a plain JavaScript module on its file URL so its bare imports still resolve from `node_modules`, refuses a dependency that does not exist **by name**, and refuses a module it would have to inline but cannot resolve. Three mutants — a missing dependency ignored, a bare specifier ignored, a nested relative import dropped — are killed by `scripts/test-worker-bundle.mjs`. A build step must not emit a reference it cannot resolve, and it must name the cause. |
| 1.9 | 2026-10-21 | A verdict must be read, not just its fixes applied. An independent review of the five shipped screens returned **DO NOT SHIP** on 19 October: a lens evidence panel that cut a line of evidence in half, and a lens strip that ran off the right edge with no affordance. Both were fixed within the hour in `f44db2b`, along with the 80-character lede, the 27/24/24px hierarchy tie and the latent `90ch`. **The report itself was never read back** — so the ship decision was taken with the verdict unread and no finding ever dispositioned. This pass read it and answered all ten findings against the deployed build: the clip is a fade into the scroll edge, the strip carries a four-layer scroll shadow, the lede is 58 characters, the top three ranks are 48/32/21px, and the 390 evidence door is hit-testable. The one judgement — the rules bracketing 490px of content in 1120px — is answered in writing, not patched, in `docs/REVIEW-DISPOSITION-2026-10-19.md`. A fix without a disposition is not a closed review. |
| 1.10 | 2026-10-23 | The atlas existed in two states, and the gate could not see the band that cropped its own controls. The workbench class, the row of page-level doors and the evidence popup were all assembled by JavaScript a third of a second after the first paint: the reader got a page that then grew and shrank under them, and the spatial gate measured whichever state it caught — the same build, swept twice, reported the City watch as a hole in one run and the doors row in the next, so the receipt was a coin toss. The class is in the markup now, the sections that move into the drawer are hidden where they stand until they move, and `public/atlas-layout.js` assembles the page in a classic script before the first paint. The gate found a defect it could not previously see: at 339px the atlas title hid 15px of its own content behind the language select, and the phone title is now the plainest name that fits. The instrument's own stale-reason check is switched off whenever a sweep is narrowed by route, and this gate must name its routes — so `scripts/spatial-reasons.mjs` checks the rule itself against a complete sweep, and four mutants of it are killed. Then the audit asked what the gate does **not** measure: it measures the atlas inside an iframe, where the atlas hides its own header and clips its own root, so the header band was never measured at all — and on the deployed build the language select, the page's first control, sat 1.5px **above** the top of the document, cropped by the edge of the page. The band now grows to fit its contents (`minmax(…, auto)`) and its two controls are the size of their labels; `scripts/audit-rendered.mjs` reads the band and fails when a control does not fit, and proves itself by putting the page back the way it shipped and requiring the same check to report the crop deeper. **A page has one layout; a reason must have something under it; a gate that measures a coin toss protects nothing; and a band that crops its own contents is a window onto one.** |
| 1.11 | 2026-10-25 | The water lens could not be reached. `/atlas?lens=waterways` — the URL the water-recovery receipt publishes, and the atlas's own share link for that lens — landed on a map with the count (3,885 mapped features), the legend of their kinds, the gauge inventory, the polder budget and the retry chip all sealed inside a closed `<details>`: measured on the live release `jakarta-atlas-20261025-1792913608-001fbbc`, `#atlas-lens-evidence.open === false` at 1440, 1024 and 390. Four lenses opened their evidence on a desktop screen and the water lens did not, because the water branch was added after the rule and **a rule that is not written down is not a rule**. Inside the panel the legend was an orphan — appended after the coastal and land-cover sections, six elements below the count it explained — and, since the recovery pass made the count arrive on its own, an empty `<p>` holding 26px of margin for the whole load. An empty paragraph has no box, so a check on box height called it zero: the space was in the margins, and the space is what the reader pays for. The audit could not see it — the geometry audit force-opened the panel before measuring, and the rendered audit visited `/atlas`, which opens on the city lens — so the receipt said the lens was verified while certifying a state no reader was given. The lens now opens its own evidence on a desktop screen when it is chosen and before the fetch; the legend is the count's own breakdown, directly under it, labelled, and never a line of nothing; the geometry audit asserts the deep link *arrived* open before it touches anything; and the rendered audit visits the deep link, measures the state a reader gets, and proves each of its three checks by putting the page back into the defect. `scripts/test-lens-evidence.mjs` with `scripts/mutate-lens-evidence.mjs`, 4/4 killed, one of them the shipped orphan reproduced exactly. **A deep link must deliver the lens it names; a guard that opens the disclosure before it measures has measured a state nobody was given; and an orphan is not fixed by moving it closer to its subject — it is fixed by naming what it belongs to.** |
| 1.12 | 2026-10-26 | The control nobody measured. The panel's control floor was 44px (`public/style.css`), and every house style since had been a carve-out from it — the direct-child row (32px), the action row (32px), the retry chip (32px), the observation link (0), the ranking row (24px) — so a control nobody remembered to carve out was a **44px slab round a 16px line**, 2.75x its own text, against a law that says a box is its label plus padding. Four such controls existed, and no audit had ever said so, for two reasons that are the same reason. The traffic lens was in no audit sweep: the geometry audit listed six lenses and then nine, and the lens with 33 controls in its panel was in neither. And even in a sweep it would have missed them — a control inside a collapsed `<details>` is not on screen, so `checkVisibility` says no and the rule never ran on it; the audit measured the panel's arrival state, and those controls only exist after the reader opens a section. The panel was also measured while still filling: the audit waited for the body to cross 160 characters, so the traffic panel was measured at its first paragraph, before the toll catalogue arrived. The floor is now the house style — 32px with 4px of its own padding, a dense list row tighter still. The gates reach the case: every lens that carries a panel is swept; the panel is waited on until it stops changing; the controls are measured with every disclosure open while the layout rules stay on the arrival state; and the release-path rendered audit requires that no panel control is bigger than its own text, with a bite test that puts a control back on the 44px floor and requires the check to report it. `scripts/test-lens-evidence.mjs` with `scripts/mutate-lens-evidence.mjs`: 7/7 killed. **A rule is not in force until the measurement that enforces it reaches the case the rule is about; a sweep that names a selection of lenses is not a sweep of the product; a threshold that says "more than 160 characters" is not "the panel has finished"; and a disclosure that hides a control from the audit hides it from the rule.** |
