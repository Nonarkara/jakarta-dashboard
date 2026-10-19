# Temporal admission must anchor to the exact hour, and live lenses must share one rule

**Recorded** 19 October 2026 · **State** verified · **Surface** `public/temporal-admission.js`

## The defect, and why it survived a green build

Two lens modules anchored their opening frame with a *nearest-hour* scan:

```js
data.hours.forEach((h, i) => { const d = Math.abs(Date.parse(h) - now); if (d < delta) { delta = d; best = i; } });
```

If the model did not cover the current hour, the lens drew whichever hour sat
closest and rendered it with the panel's ordinary wording. A gap became a lie.
Worse, the scan was **symmetric**: it would happily pick an hour from the
*past*, so an envelope whose hours had all rolled forward still opened on
yesterday.

This passed every check, because no check asked the question.

## The audit found four sites, not one

| Surface | Before |
|---|---|
| `synoptic.js` | nearest-hour scan (`nearestIndex`) |
| `wind-field.js` | nearest-hour scan (`currentIndex`) |
| `haze-transport.js` | nearest-hour scan, **twice** (`startIndex`, `HOURS_AVAILABLE`) |
| `haze-transport.js`, `wind-field.js` | no age check at all — any `200` was drawn |

Two of the four were found only *after* the first fix, by a source-text guard
looking for the pattern. That guard is why this file exists.

## The rule, in one place

`admitModel(payload, now)` admits an envelope only when it is `available`, its
`checkedAt` is not in the future and no older than 10 minutes, it carries cells,
**and** `hours` contains the current wall-clock hour verbatim. Otherwise it
returns a reason code, never a substitute value.

Two outcomes are deliberately distinguished:

- **Refusal** (`unavailable`, `future`, `expired`, `empty`) — nothing is drawn.
- **Gap** (`no-current-hour`) — the model is fresh and its hours are real,
  time-labelled forecast hours, so the panel **keeps drawing** and states that
  the field is not showing now. Scrubbing across real hours stays possible;
  silently substituting a neighbour does not.

Over-fixing this would have deleted the forecast scrub, which is a genuine
feature. The defect was the anchor, not the scrub.

## Two fixture traps this exposed

The failing tests were not lying; they were **load-bearing the defect**.

1. `test/fixtures/synoptic-response.json` is a frozen 16 October snapshot. It
   passed *because* the code borrowed a neighbour. It is now re-stamped onto the
   current hour window, preserving every relative offset, so the drawing path is
   exercised instead of the workaround.
2. `test-haze-transport.mjs` pinned `Date.now()` to a time **before its own
   fixture's `checkedAt`**, and a second fixture had no `checkedAt` at all. Both
   were made self-consistent. The guard was not weakened to fit.

## Guards, and the trap in guarding them

`scripts/test-temporal-admission.mjs` covers the exact-hour anchor, the gap, every
refusal reason, and asserts no lens keeps its own scan.

The first version of the per-lens guard was **source text**: "imports
`temporal-admission.js`" plus "contains no borrow scan". Nine mutants were
written to prove the guards bite. **Three survived** — because a lens can keep
the import while ceasing to *call* the rule. An import proves the module is
referenced; only driving the controller proves it is used.

So each lens now has a behavioural test: drive the real controller with a current
envelope (a control, so the assertions cannot pass against a controller that
draws nothing), then with an expired and a future envelope, asserting **zero
layers** and that the panel names the reason. Re-running the same nine mutants,
all nine now die.

## The wider lesson

A guard that reads source text answers "is this referenced?", never "is this
used?". When the thing you are protecting is a *call*, the guard must execute it.

Related: [[temporal-admission-must-anchor-to-the-exact-hour]] is the general
form of [[wind-transport-must-integrate-partial-hours-and-preserve-missing-hour-time-slots]].