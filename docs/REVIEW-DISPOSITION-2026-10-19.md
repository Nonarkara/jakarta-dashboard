# Independent review — disposition

**The review:** an independent anti-slop review of the five shipped screens,
run on 19 October 2026 from screenshots taken at 09:19. **Its verdict was
DO NOT SHIP** — one blocking defect and one navigation defect.

**The gap this document closes:** the four findings that mattered were fixed
in commit `f44db2b` the same morning, at 09:37. **The report itself was never
read back.** The fixes landed; the verdict was never answered in writing; the
ship decision was made without the review in hand. A fix without a disposition
is not a closed review.

**Closed:** 21 October 2026, against the deployed build
`jakarta-atlas-20261021-1792598910-24f8889`, measured on the live site with
the shared Chrome on CDP 9656. Every number below is read from the rendered
page, not from the source.

## The findings, answered

The **Now** column uses a fixed vocabulary, so a finding cannot be quietly
left open: **Fixed** — the defect was corrected; **Judged** — it is not a
defect, and the reason is written below; **Moot** — the thing it measured no
longer exists; **Verified** — the review could not check it, and it has now
been checked and holds; **Noted** — accepted as it is, no change wanted.

| # | Finding | Verdict then | Now | Evidence on the live build |
|---|---|---|---|---|
| 1 | **BLOCKING** — the lens evidence panel cut a line of evidence in half: the last visible ink row was the top ~5px of an 11px glyph, then map. No border, no fade, no scrollbar. | DO NOT SHIP | **Fixed** | The rain lens panel is 240×692, `clientHeight` 690 against `scrollHeight` 1075 — it scrolls. `mask-image: linear-gradient(rgb(0,0,0) calc(100% - 26px), rgba(0,0,0,0) 100%)` with `padding-bottom: 26px`. The last line now *fades into the scroll edge* instead of being cut. |
| 2 | **SHOULD-FIX** — the lens strip ran off the right edge with no affordance; at 1024 the last tab was cut mid-word as "Rad", with four lenses entirely hidden. | DO NOT SHIP | **Fixed** | `.atlas-lenses` carries a four-layer scroll shadow — `background-attachment: local, local, scroll, scroll`, `background-size: 26px 100%, 26px 100%, 14px 100%, 14px 100%` — so the right edge is shaded and the cut tab is visibly dimmed. `scrollWidth` 1679 against `clientWidth` 1024: there is more to scroll, and the page now says so. |
| 3 | **SHOULD-FIX** — the research lede rendered 80 characters against a 45–75 law, because `65ch` is the advance of "0" in Source Sans 3 and narrower than the text's mean advance. The CSS satisfied the letter of the rule and failed its character test. | — | **Fixed** | The lede is `max-width: 55ch` → 410px rendered, 7.074px per character → **58 characters per line**. Inside the band. |
| 4 | **SHOULD-FIX** — h1, h2 and the hero number all resolved to `--display: 32px`, so the top three ranks measured 27/24/24px against a rule asking for a 1.5× step. | — | **Fixed** | Hero **48px**, h1 **32px**, h2 **21px**. Steps of **1.50×** and **1.52×**. |
| 5 | **ACCEPTABLE / WATCH** — two rules bracketed 46% of their own length: 1120px of rule around 512px of content, a 608px empty tail, with the hero number sitting at x 957–1178 above it. | watch | **Judged, not a hole** — see below | Measured on the live build: the rules span 1120px (x 160→1280); the four counts run 160→650; the hero number runs 956→1280 at 48px. |
| 6 | **UNVERIFIED** — at 390 the lens evidence panel was absent, so mobile composition could not be compared with desktop. | — | **Verified** | The door is present at 390 (67×24 at y 24) and **hit-testable**: the element under its own centre is the door. The panel is a `<details>` that opens on demand; that it is closed is the design, not an absence. |
| 7 | **ACCEPTABLE / WATCH** — the Radar card's bottom padding (27px) was 14px more than its top (13px). | watch | **Moot** | The "missing pixels are not an all-clear" card the review measured no longer exists in the build. Nothing to correct. |
| 8 | **ACCEPTABLE / WATCH** — `style.css:500` `.atlas-data p { max-width: 90ch }` contradicted the 45–75 law. Latent, not visible in the five shots. | watch | **Fixed** | `.atlas-data p { max-width: 55ch }`, with the reason in the source. |
| 9 | **ACCEPTABLE / WATCH** — at 390 the language `<select>`'s top border sat at y=1, leaving ~1px of breathing room above the chrome. Reported as padding only, explicitly **not** a request to enlarge the bar. | watch | **Noted, unchanged** | The compact chrome is the owner's ruling. |
| 10 | **ACCEPTABLE / WATCH** — the atlas panel's caption prose ran ~74 characters, the top of the band. | watch | **Noted, unchanged** | 74 characters is inside the 45–75 band. |

### Finding 5, in writing

The band is not a hole, and the reason is checkable:

- The two rules are the **section's** rules. They span the 1120px column
  because a section rule that stopped mid-column would be a different
  object. The band's bottom rule closes the section; the top rule closes the
  hero above it.
- The four counts are a **tight group** — 32px between them, 113/111/98/72px
  wide, ending at x=650. A group whose members sit 32px apart is a group;
  the space to their right is not a gap *inside* a group, it is the column's
  margin.
- The column's right edge is already established: the hero number above runs
  956→**1280**, exactly the column's right edge, at 48px. The band does not
  run past the page — it runs to the same edge the number does.
- The page has one measure and one exception: the body reads at 65ch on the
  left, and a single 48px number is the right-hand anchor. The counts sit at
  the page's measure, like everything else.

A reader is not asked to supply an intention here. **A hole may exist; a hole
may not exist without somebody having written down why it is there.**

## The rule this produces

**A verdict must be read, not just its fixes applied.** An independent review
said DO NOT SHIP, its four blocking and should-fix findings were fixed within
the hour, and its report was never opened again — so the ship decision was
taken with the verdict still unread, and no finding was ever answered in
writing. A fix without a disposition is not a closed review.

Close a review by answering **every** finding, on the shipped bytes, with a
number where a number decides it, and a written reason where a judgement
decides it. The receipt is the file you are reading.
