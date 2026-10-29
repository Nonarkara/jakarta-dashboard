# MSH audit — the phone's first screen

**Date:** 30 October 2026
**Subject:** the city dashboard at 390 × 844, the width the law names and the width the
daily-monitoring pilot names ("a person opens this every morning on a phone").
**Method:** measured in a real browser against the deployed build, not read off the source.
Every number below is a measurement; every fix below was verified by measuring again.

---

## The budget, as it stood

The screen is 844px tall. Here is every pixel of it, measured from the live DOM.

| band | px | % of the screen | what it is |
|---|---:|---:|---|
| `header.masthead` | 23 | 2.7% | the chrome the instrument counts |
| **hole** | **16** | **1.9%** | nothing — the status strip's inherited margin |
| `details.source-status` rule + padding | 9 | 1.1% | a second horizontal rule and its padding |
| the status line | 24 | 2.8% | the source status |
| `div.map-heading` | 18 | 2.1% | "Jakarta, blok demi blok · Atlas siap" |
| `iframe#city-map` | 660 | 78.2% | the atlas |
| **hole below the map** | **91** | **10.8%** | nothing — white paper |
| `footer` | 2 | 0.2% | nothing — an empty band |

**109px of holes — 12.9% of the screen — where the city should have been.** The
map was 660px of an 844px screen.

### Where each hole came from

1. **16px above the status strip, and a doubled rule.** The page's stylesheet gives
   every in-page disclosure the same treatment: `margin-top:16px; border-top:1px solid;
   padding-top:8px`, so a disclosure reads as a section. The status strip is not an
   in-page disclosure — it is the first thing under the masthead — and it inherited
   all three. The reader saw the masthead's rule, then 16px of nothing, then a second
   rule, then the status.

2. **91px below the map.** The frame was given a fixed height worked out by hand
   (`calc(100svh - 184px)`) inside a grid row that was taller. The difference was
   white paper at the foot of the phone — the band at the bottom of the screenshot.

3. **2px of empty footer.** The footer's only child visible below the console width
   was the clock, and the clock now lives in the masthead. All four of the footer's
   children are hidden on a phone, so the footer was a band that existed for no
   reason at all.

## The fixes, and what they measured

| | before | after |
|---|---:|---:|
| hole above the strip | 16px | **0px** |
| the strip's own height | 34px | **25px** |
| hole below the map | 91px | **2px** (the panel's own rule) |
| the map on the phone | 660px | **776px** |
| empty footer | 2px | **0px** |
| the page against the viewport | 844 = 844 | 844 = 844 (one screen, no scroll) |

The map gained **116px — 13.7% more city** — and the page still stands on exactly one
screen. The map now takes the room the page has left rather than a number worked out
by hand: a number can disagree with the page it sits in, and this one did.

---

## What is still there, and what nobody is measuring

**The screen is 78% an iframe, and no gate looks inside one.**

`grep -c iframe` on the three instruments that measure layout:

```
scripts/spatial/spatial-probe.js    0
scripts/msh-evidence.mjs             0
scripts/chrome-census.mjs            0
```

All three read the top document. On a phone the top document *is* the dashboard, and
its content is an atlas in a frame. So the layout the reader actually sees on the
phone — the lens row, the two overlay rows drawn over the map, the map's own height —
is invisible to every gate in the project.

The spatial gate measures `/atlas` and `/atlas-open`, but `/atlas-open` is the
**standalone** atlas with a disclosure opened. The *embedded* variant — the header
collapsed to zero, the lens row in flow, the page tools floating over the map — is a
different layout and is measured nowhere.

### The lens row

Inside the frame, `nav.atlas-lenses` is a horizontal scroller:

| | |
|---|---|
| content width | **1679px** in a **390px** window |
| hidden | **77%** |
| doors | 16 |
| fully visible | **3** |
| sliced mid-word | **1** — "Kerentanan floods", cut at the right edge |
| entirely off-screen | **12** |

A deliberate scroller is fine; a *silent* one is not. The reader is shown three doors
and half a fourth, with nothing saying there are thirteen more. This is the one SH
on this screen that is still standing — and the one no instrument is in a position to
report, because it lives inside a frame.

---

## What this audit recommends, and does not do

- The three holes are fixed and measured. That was this project's own regression and
  it is closed.
- The lens row and the embedded frame are **not** fixed here. The lens row is the
  atlas's own navigation, and the frame is the atlas's own layout; changing either is
  a product decision, not an audit finding to close quietly.
- The blind spot is named rather than papered over: the law has no way to see a frame.
  Whether the embedded atlas gets its own measured route — the way `/atlas-open`
  exists for the standalone drawer — is a decision for the owner of the law.

See `docs/CHROME-CENSUS.md` for the receipt that keeps a re-baseline from recording a
blind spot as an improvement.
