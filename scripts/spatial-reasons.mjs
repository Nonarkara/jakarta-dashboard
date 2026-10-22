#!/usr/bin/env node
/**
 * A REASON must have something under it.
 *
 * The spatial instrument's baseline carries a written reason for every
 * decision it records — a hole in the layout that the project has decided to
 * keep, and the words that say why it is there rather than the grid having
 * put it there. A reason that justifies nothing is worse than no reason: it
 * excuses the NEXT decision that happens to look like the one it described,
 * and nobody re-reads it.
 *
 * The owner's instrument checks this rule itself, but only on a sweep that
 * was not narrowed: it treats "--routes ..." as a deliberate narrowing and
 * switches the stale-reason rule off, because a run over a few routes cannot
 * tell a decision that died from one that lives on another page. This gate
 * has to name every route it sweeps, so the instrument's own check never
 * fires here.
 *
 * So the rule is enforced in the project's own file, against the
 * measurements of a COMPLETE sweep. The completeness rule is the same one
 * the instrument uses: a reason can only be called stale when every
 * route-width the baseline records was measured. A partial sweep never
 * produces a false failure.
 *
 * Deleting a stale reason is still a thing a person does by hand. This
 * module only reports it.
 */

export function decisionKey(finding) {
  return `${finding.kind}|${finding.sel}`;
}

/** The decisions the sweep actually measured. Overflow is excluded: it is a
 *  property of the page, not a decision the project has to justify. */
export function measuredDecisions(measurements) {
  const keys = new Set();
  for (const m of measurements || []) {
    for (const f of m.findings || []) {
      if (!f || f.kind === "overflow") continue;
      keys.add(decisionKey(f));
    }
  }
  return keys;
}

/**
 * Did the sweep measure every route-width the baseline records?
 *
 * A reason can be alive at 721px and absent at 360px. A sweep that did not
 * look at every recorded width cannot tell the two apart, so it must not
 * call a reason stale — that would be the instrument inventing a defect.
 */
export function sweepIsComplete(baseline, measurements) {
  const routes = Object.keys((baseline && baseline.routes) || {});
  if (!routes.length) return { complete: false, why: ["the baseline records no routes"] };
  const widths = (baseline && baseline.measuredWidths) || [];
  if (!widths.length) return { complete: false, why: ["the baseline records no widths"] };
  const seen = new Set((measurements || []).map((m) => `${m.route}@${m.w}`));
  const missing = [];
  for (const r of routes) {
    for (const w of widths) {
      if (!seen.has(`${r}@${w}`)) missing.push(`${r} @${w}px`);
    }
  }
  if (missing.length) {
    const shown = missing.slice(0, 3).join(", ");
    return {
      complete: false,
      why: [`${missing.length} recorded route-width(s) were not measured (${shown}${missing.length > 3 ? ", …" : ""})`],
    };
  }
  return { complete: true, why: [] };
}

/**
 * The reasons in the baseline that no measured decision justifies.
 *
 * judged=false means "this sweep cannot tell" — not "there is nothing
 * wrong". The difference is the whole point of the rule.
 */
export function staleReasons(baseline, measurements) {
  const complete = sweepIsComplete(baseline, measurements);
  if (!complete.complete) return { judged: false, stale: [], why: complete.why };
  const keys = measuredDecisions(measurements);
  const reasons = (baseline && baseline.reasons) || {};
  const stale = Object.keys(reasons).filter((k) => !keys.has(k));
  return { judged: true, stale, why: [] };
}

/** The words the gate says when a reason has nothing under it. */
export function staleReasonMessage(stale) {
  const lines = [
    `stale reason — the baseline justifies ${stale.length} decision(s) that no measured decision is that shape any more:`,
  ];
  for (const k of stale) lines.push(`  · ${k}`);
  lines.push(
    "A reason that blesses nothing will bless the next thing that looks like it, without anybody re-reading it.",
    "Delete each one from the reasons block of design/spatial-baseline.json, by hand.",
  );
  return lines.join("\n");
}
