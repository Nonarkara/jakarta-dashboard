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
