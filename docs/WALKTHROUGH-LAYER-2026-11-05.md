# The walkthrough layer

**Date:** 5 November 2026
**What it is:** the descent from the city to the place, in the place context of the atlas.
**Where it came from:** `docs/ROKEHAN-EVALUATION-2026-11-05.md` — a location scout that renders any
real place at human scale from open data, and the one ingredient of it we did not have.

---

## The problem it answers

The agency's walkthrough (`docs/DAILY-MONITORING-PILOT-2026-10-26.md`) has four tasks. One of them is
the hard one:

> **Open the map, choose the "waterways & incoming water" lens. Find a high-water gauge. When was
> its number last updated, and who publishes it?**

To do that today you must find a gauge among sixteen city-scale lenses, work out which pin is a gauge
rather than a flood reference, then read the panel. **The atlas is a model of a city; the walkthrough
asks about a place.** There was no descent.

There was a second gap, and our own text named it. The polder-budget note says:

> *"No measured water speed, discharge, **terrain**, tide or pump capacity is available to this
> scenario."*

The map is flat. A gauge reads 3.2 m against its own datum; the map is a plane at zero; the reader
cannot see that the street in front of them sits in a dip.

## What it does now

### 1. Stand here — the descent

The place context already existed: click the map, and it opens a panel of the dated public references
within 5 km, each with its publisher, its source date and its retrieval date. It is the right home for
a walkthrough — it is already the product's way of answering "what is here?".

It now has one more action, **"Berdiri di sini" / "Stand here"**: the camera goes to the spot at eye
level (zoom 18.5, pitch 68°) and the panel says plainly that there is no walking route here — the
distances above are straight lines.

### 2. The water-level stations — the walkthrough's task 2

The 25 AWLR stations (Jakarta Satu, *"Pemprov DKI Jakarta"*, retrieved 11 October 2026) join the
references the place context already loads: waterways, pumps, health facilities, schools. So the
walkthrough's gauge is one click away, with its river, its address, its publisher's link, its source
date and its retrieval date — the same fields every other reference already carries.

And the honesty that matters: **this dataset carries no live reading.** Each station publishes its
SIAGA 1–4 alert bands in cm, as published; the level in the scenario is an assumption the reader sets.
The panel says so in both languages, before the reader goes looking for a number that is not there.

### 3. The ground — the ingredient we did not have

The ground height at the place, read from **Terrain Tiles** (terrarium encoding; SRTM, NED and ETOPO
derived), fetched on demand and reported with its source and its resolution:

> Ketinggian tanah di sini 7 m di atas permukaan laut · Terrain Tiles (elevation-tiles-prod) · SRTM,
> NED and ETOPO derived · ~19 m/pixel · diambil 2026-11-05 · model raster, bukan survei

It is about 19 m of ground per pixel over Jakarta. It is a raster model, not a survey, and the panel
says so.

**The line it does not cross.** A water level and a ground height are not the same datum, and the
project's own words are that heights cannot be transferred between station datums. The panel says so
explicitly, and the two numbers are never subtracted. Two heights in two frames is not a calculation;
it is a mistake with a number in it.

## How it is built

| piece | where | why there |
|---|---|---|
| the elevation maths | `public/ground-elevation.js` | pure functions — tile maths, terrarium decoding, sampling — so they can be tested without a network |
| the fetch and decode | same module | one tile, on demand, decoded in the browser from the bytes |
| the edge | `src/index.ts` → `/api/ground-elevation` | the bucket sends **no CORS header**, so a browser cannot read it: the Worker fetches the tile, caches it, and hands the bytes on. The public site still talks only to itself |
| the place context | `public/place-context.js` | the descent, the stations, the ground |
| the provenance | `public/data/jakarta-v1/source-catalog.json` + `.csv` | a new source is a row in the ledger like every other source: publisher, licence, tier, limitations, and what it may not be used for |

The CSP was **not** widened. The elevation comes through our own edge, so `connect-src` stays as it was.

## The tests

- `scripts/test-ground-elevation.mjs` — the tile maths, the terrarium decoding, the sampling, the
  resolution, and the case that matters most: **an unavailable tile is unknown, never zero.** Zero is
  a real height in Jakarta — it is the low city — and a failure must never fake it.
- `scripts/test-place-context.mjs` — the real reference joins, the partial-failure and abort paths,
  now including the stations.
- `scripts/test-source-catalog.mjs` — JSON/CSV parity and the asset hashes, now including the
  elevation source.

## What it does not do

- It does not route. There is no walking network here, and the panel says the distances are straight
  lines.
- It does not predict or model flood. It says what the ground is and what the station publishes.
- It does not combine a level with a height. That subtraction is refused, in the panel and in the code.

## The audit that came out of looking at a location scout

Comparing our masthead with the scout's found a defect no gate could see, on the live site, on the
day: the seven-zone world clock took 610px of the masthead and pushed the last two navigation links
out of the bar — one of them cut mid-word ("At") — at every width from 1001px to 1599px. The spatial
gate passed. The chrome census passed. The MSH evidence said *"no sideways scroll, nothing past the
edge"*. All three were right, and all three were blind: they measured how **tall** a chrome band is
and never asked whether the band's **content fits inside it**.

So the census grew that axis (`docs/CHROME-CENSUS.md`), and it caught the defect on its first run —
in the very widths where the navigation was being cut.
