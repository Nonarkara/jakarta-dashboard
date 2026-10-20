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
