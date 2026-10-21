# Open items — 21 October 2026

What is still open, what was done about it, and what still needs the owner.
Nothing here is a guess: each line says how it was checked.

## 1. Perplexity connector — still absent, and provably so

**State: blocked on the owner. No key exists in this workspace, and none can
be created from it.**

Checked, not assumed:

- `mcode-tools connector tools --keyword perplexity` →
  `{"tools":[],"partial":false,"provider_failures":[]}`. An empty list with
  `partial:false` and no provider failures means the catalogue was served in
  full and the catalogue has no Perplexity tool in it.
- The unfiltered catalogue is **15 tools**: `connector__matrix__*` (image, video,
  audio) and `connector__email_workbench_credentials__*`. No Perplexity among
  them.

So the connector is not misconfigured or rate-limited; it is not connected.
Only the owner can connect it, and a key is not something an agent may invent.

**What it would be used for:** cross-checking a claim against a second
retrieval system, which is a *second opinion*, never a source of truth. The
atlas's own evidence rules are unchanged by it: an upstream summary is a
pointer, and the shipped bytes remain the record.

## 2. GitHub Actions spending limit — owner's account, owner's card

**State: blocked on the owner. Interim path in place and used.**

The Actions quota for the account is exhausted (or the account is on the
spending-limit side of it). The quota is a property of the account, so no
change in this repository can lift it.

The workflow is **kept, not deleted** — `.github/workflows/gate.yml` stays
exactly as it was, so the gate resumes by itself when the quota returns, with
no code change and no chance of a forgotten re-enable.

**Interim: the release is pushed by hand.** `scripts/deploy-live.sh` is the
gate, and it runs the same checks the workflow runs:

| Workflow step | Local equivalent |
|---|---|
| secret scan | the same regexes, run over the tracked tree before the release |
| `npm ci --ignore-scripts` | the committed `node_modules` |
| `npm run typecheck` | identical |
| `npm run verify` | identical |
| `npm test` | identical |
| `npm run audit:spatial` | **new** — the spatial gate |
| `npm run audit:spatial:falsify` | **new** — the falsifier |

The hand-pushed release is therefore not a weaker release: it is the same
gate, run by the person who is present, with the receipt written down.

## 3. Cloudflare rate limiting — one dashboard step left

**State: the code is shipped; the account-side namespace is not.**

What is done:

- `src/rate-limit.ts` implements the limit with two mechanisms behind one
  interface: Cloudflare's native Workers Rate Limiting when the account
  provides a namespace, and an in-isolate fixed window when it does not.
- The native binding is wired in `src/index.ts` and applied to `/api/*` only.
  The pages and the map assets are not rate limited: they are cheap, they are
  cached, and refusing a page to a reader would punish them for protecting
  nothing.
- The limit is 180 requests a minute per address. A reader opening the atlas
  and the research page asks for about a dozen; many readers share one address
  behind a carrier NAT, so the number is set for a person, not for a script.
- A fault in the limiter is never an outage in the publisher: if the limiter
  cannot answer, the request is served.
- `scripts/test-rate-limit.mjs` holds the rule, and **4/4 mutants are killed**
  (the limit stops limiting; the native binding is ignored; a limiter fault
  blocks the data; the counter is never incremented).

What is left, and why: the rate-limit **namespace** cannot be created from
here. The Cloudflare API refuses this account's OAuth token on the namespace
endpoint — `POST /accounts/{id}/workers/services/{script}/rate_limits/namespaces`
answers `405 Method not allowed for this authentication scheme`, and the
rulesets API answers `403`. The `wrangler` CLI at 4.149.0 has no namespace
command.

**The one step, for the owner:** Cloudflare dashboard → Workers & Pages →
Account Settings → Rate Limiting → create a namespace, then uncomment the
`[[ratelimits]]` block in `wrangler.toml` and put the namespace's id in it.
Nothing else changes: the Worker already prefers the native binding the moment
it exists, and the local guard already proves the native path is taken when
it is present.

Until then the in-isolate window is in force, and it is what it is: it counts
the requests that reach **one isolate**, so a client spread across many
connections is under-counted. It stops a single hot path, not a distributed
one. That limit is stated here rather than implied.

## 4. Dependabot — closed

| PR | Change | Decision |
|---|---|---|
| #7 | `@cloudflare/workers-types` 5.20261013.1 → 5.20261016.1 | **merged.** Type definitions only; the local gate re-ran clean against it. |
| #1 | `actions/setup-node` 4 → 7 | **merged.** v7.1.0 published 8 October 2026. The workflow's Node major is unchanged (26) and the comment that pins it still holds. |
| #2 | `actions/checkout` 4 → 7 | **merged.** v7.0.1 published 20 July 2026. |
| #3 | `typescript` 5.9.3 → 7.0.2 | **closed, with the reason.** TypeScript 7 removes the JavaScript compiler API that `scripts/coastal-test-module.mjs` uses to check the coastal forecast module. The bump is worth taking when that script is rewritten, not before. |

The two action bumps are the only changes in this set that CI could not
exercise, because CI is off. They are version references in one workflow file
and nothing else; the first CI run when the quota returns is their test, and
a red gate there is the gate doing its job.
