# Rokehan — what we can take, and what we must not

**Date:** 5 November 2026
**Subject:** https://tools.oyasumi-gamedev.com/rokehan/ — "どこでもロケハン" (*dokodemo rokehan*,
"location scout" anywhere), by MIYADAIKU.
**Question asked:** can we use it in our system to make the walkthrough quicker and better?

---

## What it is

A browser tool that renders **any real place in the world as a 3D line-art plate** from OpenStreetMap
geometry and elevation — a location scout for game and illustration backgrounds. You search a place
(or paste a coordinate), pick a viewpoint, and it builds the block around you:

- **"Stand here" / "Move camera here"** — pin the camera at eye level at a point you choose.
- **"Make this the near area"** — rebuild the near area in detail around the camera.
- A **lens** control (32 mm), a **size** control (100 m), **surroundings** (4 km), and a **time of day**.
- It reads out what it built: *"16 buildings (0 guessed heights) · 37 roads · 50 trees · elevation 15 m
  (GSI 5 m) · map data 210 KB"* — and it exports PNG and GLB.
- Shibuya Crossing took **7.0 s** to build.

The thing to take from it is not the picture. It is the **descent**: city → block → eye level, at a place
you name, with the ground's real shape under it.

## The licence: the tool itself is out

Their terms say the programme, its screens, its text and its data may not be copied, reposted,
redistributed, or extracted and used in another piece of software or web service, and that their
support does not cover infringement of a third party's rights. The header repeats it: *無断の複製・
再配布・改変して配ることを禁じます*.

So: **no vendoring their code, no iframe of their tool on a public government-facing site, no
republishing their data or their output.** An embed would put an ungoverned, untranslated,
off-doctrine third-party tool on the public site of a Jakarta city watch, with our readers' addresses
leaking to another operator and none of it covered by our gates. That is not a trade we can make on
the owner's behalf.

Their terms also say the exception explicitly: third-party materials under their own licences — OSM
map data under ODbL, for instance — are governed by *those* licences, and if you want the map data in
bulk you should go to OpenStreetMap itself.

**That is the answer: use what it is built from, not the thing itself.**

## What it is built from — and the one we do not have

| ingredient | endpoint | licence | do we have it? |
|---|---|---|---|
| OSM geometry (buildings, roads, trees) | Overpass API | ODbL | **yes** — baked into our PMTiles from Overture/OSM, with attribution in the ledger |
| place search | Nominatim | ODbL | partly — our own area and place index |
| vector basemap | OpenFreeMap / OpenMapTiles | open | **yes** — our own tiles |
| **elevation / terrain** | `s3.amazonaws.com/elevation-tiles-prod/terrarium/` | open (Terrain Tiles; SRTM/NED/ETOPO derived) | **no** — our atlas is **flat** |

That last row is the whole finding. Everything else Rokehan does, our atlas already does at a larger
scale. What it does that we cannot is **put the ground at the right height**.

And it matters here more than it does for a manga background. Our own polder-budget note says it
plainly: *"No measured water speed, discharge, terrain, tide or pump capacity is available to this
scenario."* A gauge reads 3.2 m above its own datum; the map is a flat plane at zero; the reader
cannot see that the street they are looking at sits in a dip. **Terrain is the missing quantity in a
city where the question is water.**

We checked, and the tiles are there over Jakarta — 200 OK, real PNG bytes, at z12, z13 and z14.

## The capability: a walkthrough layer

The agency's walkthrough is four tasks. Task 2 is the hard one:

> **Open the map, choose the "waterways & incoming water" lens. Find a high-water gauge. When was its
> number last updated, and who publishes it?**

To do that today you must find a gauge among sixteen city-scale lenses, then work out which pin is a
gauge rather than a flood reference, then read the panel. The atlas is a model of the **city**; the
walkthrough asks about a **place**.

So the walkthrough layer is the descent Rokehan demonstrates, built on our own data and our own
gates:

1. **Pick the thing you are checking.** A gauge, a flood reference, a kelurahan — from the walkthrough's
   own list, not from a hunt across sixteen lenses.
2. **Stand there.** The camera goes to the point at human scale, pitched, the way "Stand here" does.
3. **Know the ground.** The real elevation at that point, from the open DEM, with its source and its
   resolution stated — because our map is flat and the reader has no other way to know.
4. **See the evidence.** The gauge's reading, its publisher, its age and its official threshold, in
   view, at the place — the four things the walkthrough asks for, in one descent.

**The line we will not cross:** a water level and a ground height are not the same datum, and our own
text already says heights cannot be transferred between station datums. The walkthrough layer will
show both, side by side, each with its own source and its own datum named — and will not subtract
one from the other to produce a number we cannot stand behind.

## What Rokehan is not for us

- It is a **background-plate generator**. Its output is an illustration; ours is an instrument. The
  lesson is the descent and the open data, not the line art.
- Its city data is a **4 km square of "Tokyo (central)"** baked for that one place. Ours is a
  rectangle over Jakarta with 3.38 million features. Its approach is right for a single scene; ours is
  right for a city that has to be true everywhere.
- **Seven time zones in the masthead is not a small thing.** Measured on the live build at 1440: the
  world clock takes 610px, the navigation column is left 576px for 721px of links, and the last two
  links are pushed out of the bar — one of them cut mid-word ("At"). The receipt says the masthead is
  38px of chrome and one band, and that is true; nothing in the receipt says the band's *content*
  fits. See the audit below.

## The audit that came out of looking at it

The act of comparing our masthead with Rokehan's found a defect no gate could see, on the live site,
today:

> **The navigation is clipped.** At 1440 the nav column is 576px wide and holds 721px of links. It
> scrolls — `overflow-x: auto` — so the content is reachable, but the reader sees a broken word and
> no sign that there is more. At 1200 and 1280 the clip is worse.

The spatial gate passed. The chrome census passed. The MSH evidence says *"no sideways scroll,
nothing past the edge"* — all three are correct, and all three are blind: they measure the **height**
of a chrome band and whether it is the right height. None of them asks whether the band's **content
fits inside it**.

That is the same failure this project has already paid for twice — a receipt that described the page
perfectly except for the one thing that had changed. A gate that measures a band's height and never
asks whether its content fits is a gate that will let a masthead eat its own navigation.

**So the walkthrough layer comes with a second rule:** the census grows an axis — *no chrome band may
clip its content* — and the world clock yields to the navigation wherever the bar cannot hold both.

## What we did with it

The walkthrough layer is built: **"Berdiri di sini"** (the camera stands on the spot at eye level),
the 25 AWLR water-level stations among the place context's references (so the walkthrough's gauge is
one click away, with its publisher and its SIAGA bands — and, said plainly, *no live reading*), and the
**ground height** at the place, read from Terrain Tiles through our own edge, reported with its source
and its ~19 m resolution, and never subtracted from a gauge level.

Full receipt: `docs/WALKTHROUGH-LAYER-2026-11-05.md`.

## Sources

- The tool: https://tools.oyasumi-gamedev.com/rokehan/
- Their terms: https://oyasumi-gamedev.com/tools/terms/
- Their data endpoints, read from the page's own code: Overpass API, Nominatim, OpenFreeMap,
  Terrain Tiles (`elevation-tiles-prod`), GSI Japan elevation tiles.
- Elevation availability over Jakarta, measured: `200 OK` for the terrarium tiles at z12/z13/z14.
- The live masthead, measured at 390, 1024, 1200, 1280, 1440, 1520, 1600, 1728 and 1920 px.
