# The chrome census

**A gate that cannot see a thing protects nothing.**

The spatial instrument measures chrome — the furniture at the top of the screen —
as the height of the bands it knows how to name: a fixed band, a sticky band
pinned at the top, or an in-flow page bar (a `<header>` outside `<main>`) standing
at the top of the document. That list is the instrument's own definition, and the
instrument is the owner's: it is vendored byte-identically and pinned by hash in
`scripts/spatial/INSTRUMENT-SHA256.txt`, so this project cannot widen it.

Which means the instrument has a blind spot, and the blind spot is a plain `<div>`.

## What shipped

On 28 October 2026 a thin bar was added above the city masthead: a live clock and
a "feed pulse" that counted DOM elements with text and called the result
"live feeds". It was a `<div>`, not a `<header>`, and it stood in front of the
masthead — so it pushed the masthead off `top:0`, and the masthead stopped being a
band the instrument could count. The bar itself was never a band.

The instrument's reading fell from 23px of top chrome to 0px. The receipt was
re-baselined to 0px. The gate went green.

But 0 is smaller than 23, and a smaller number reads as an improvement. It was
not an improvement. It was a blind spot, recorded as a fact.

Three more things rode along in that bar, and all of them were visible in the
pixels:

| In the bar | Why it was wrong |
|---|---|
| a second clock | the footer already had one — the page carried two clocks for one time |
| an inline `<script>` | it could not be translated (hard-coded Indonesian on a bilingual page) or tested |
| `aria-live="polite"` on a per-second clock | a screen reader was asked to announce the time once a second |
| "N umpan langsung" | it counted DOM elements with text — a feed showing an error message counted as live |

## What the census does

The census measures the chrome a **second way**, independently, and makes the two
measurements answer for each other:

- the **receipt** — what `design/spatial-baseline.json` says the chrome is;
- the **census** — what is actually painted above the page's content.

If they disagree, the receipt is wrong — and the receipt is what every later
reader is shown. A page that grew a band nobody wrote a reason for is a hole; a
receipt that does not describe the page is a worse one, because it looks like an
answer.

The census asks the page, not the stylesheet. It looks at the geometry of every
element that is painted, and takes the furniture to be the region from the top
edge of the viewport down to the lowest edge of anything standing there — in the
flow or pinned to the top. Content inside `<main>` is content: the spatial
instrument does not count it as chrome either, so the census does not either.

The census compares:

- the **height** of that region, against the receipt's `chrome.top`; and
- the **number of top blocks** in it, against the receipt's `topSel` — the bands
  the instrument actually recorded, rather than the `stacked` count, which can
  include a bottom band or be a phantom.

## The falsifier

A gate that has never failed protects nothing. So the census can be asked to
prove it still fails:

```
npm run audit:chrome:falsify
```

It builds the site, plants the exact shape that shipped — a plain `<div>` band
above the masthead — and requires the census to catch it. If the census passes
that build, it is not measuring what it claims to measure, and it says so rather
than going green.

## Running it

```
npm run audit:chrome            # the census, against the receipt
npm run audit:chrome:falsify    # prove the census can still fail
```

The census runs in `scripts/deploy-live.sh` **before the stamp**, so what it
measures is what ships, and after `npm run audit:spatial`, so the receipt it
checks is the one the sweep just recorded.

## What it does not do

It does not widen the instrument. The instrument stays the owner's, vendored and
hash-pinned; the census is a second opinion on the receipt, not a replacement
for the sweep. And it cannot say *why* a page has the furniture it has — that is
what `design/spatial-baseline.json`'s `reasons` are for, one written decision per
hole, each one a thing a stranger can check.
