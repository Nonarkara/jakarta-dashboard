# Wind transport must integrate partial hours, and missing hours must keep their slot

**Recorded** 19 October 2026 · **State** verified · **Surface** `public/air-timeline.js`

## The defect

`windTrajectoryPoint()` integrated a whole hour of travel for every model hour it
touched:

```js
const step = windTransportPoint(point, hour.windFromDeg, hour.windMs, 3600);
```

At 1 real second per scenario hour, an animation stopped at 4500 s (1 h 15 m)
had travelled a full hour on hour 0 **and a full hour on hour 1** — 30 minutes
more than the elapsed time. The marker walked further than the clock allowed,
and the overshoot grew with every partial hour.

## The fix

```js
Math.min(3600, elapsedS - moved * 3600)
```

Why this is safe, and not merely clamped: `totalHours` is fractional
(`elapsedS / 3600`), and the loop breaks on `moved >= totalHours`. So whenever
the body runs, `moved < elapsedS / 3600`, which means `elapsedS - moved*3600 > 0`.
The timestep is therefore always in `(0, 3600]`. **A negative timestep is
unreachable** — that was the thing worth checking before trusting the clamp.

A second, separate defect: the scenario window used to start at the first row
that had any wind, so a model whose midnight row was missing silently began at
a later hour. Now `currentTransportRow()` anchors to the exact current UTC hour
and returns `null` when it is absent, and `transportWindow()` fills gaps with
`{windMs: null, windFromDeg: null}` — a missing hour **consumes scenario time and
pauses the marker** rather than borrowing a neighbour's wind.

## Guards

`scripts/test-air-timeline.mjs` covers partial seconds (0/1/900/1800/3599/3600),
the partial second hour, an unknown first hour not borrowing future wind, and
gap handling in the window.

Mutation-verified: reintroducing `3600` and re-anchoring the window by +1 h both
fail the suite.

## The wider lesson

An hour you do not have is not an hour of calm and not the hour next door. It is
an hour you must show as missing. This is the same rule as
[[temporal-admission-must-anchor-to-the-exact-hour]] — one applied to the
trajectory, one to which field is drawn at all.