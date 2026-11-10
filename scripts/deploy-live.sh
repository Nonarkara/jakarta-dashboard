#!/bin/bash
# Verify locally, stamp and deploy, then verify the exact deployed build.
# A release deploys only committed work: an uncommitted tree means the bytes on
# the edge cannot be traced back to a commit.
set -euo pipefail
cd "$(dirname "$0")/.."

# Serialize deploys: two agents deploying over each other leave the edge with
# bytes that cannot be traced to one commit. mkdir is atomic on POSIX.
LOCK=.deploy-locked
if ! mkdir "$LOCK"; then
  echo "release refused: another deploy holds the lock" >&2
  echo "if no deploy is actually running (a SIGKILL left this behind): rmdir $LOCK" >&2
  exit 1
fi
# After the deploy step, any failure leaves the edge live with an unverified
# stamp; the operator must see that state, not just a bare non-zero exit.
DEPLOYED_BUILD=""
on_exit() {
  local code=$?
  if [ -f "$LOCK/inputs.json" ]; then unlink "$LOCK/inputs.json"; fi
  rmdir "$LOCK" 2>/dev/null || true
  if [ "$code" -ne 0 ] && [ -n "$DEPLOYED_BUILD" ]; then
    echo "release FAILED after the bytes went live at ${DEPLOYED_BUILD}." >&2
    echo "The stamp commit records what reached the edge; it is not a verdict." >&2
    echo "Fix the failing check, then release again — do not redeploy by hand." >&2
  fi
  exit "$code"
}
trap on_exit EXIT

check_clean() {
  # Untracked files under public/ and src/ ship with `wrangler deploy` too, so
  # they count as uncommitted: the edge must match a commit exactly.
  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain --untracked-files=all -- public src)" ]; then
    echo "release refused: uncommitted changes. Commit, then deploy." >&2
    git diff --stat >&2
    exit 1
  fi
}
check_clean
npm run typecheck
npm run verify
npm test
# Minutes passed since the first check; a parallel agent may have dirtied the
# tree meanwhile. The committed-work guarantee must hold at the deploy moment,
# not only at the gate.
check_clean
# The spatial gate: every hole in the layout is either fixed or written down
# in design/spatial-baseline.json, with a reason a stranger could check. It
# runs on the committed tree, before the stamp, so what it measures is what
# ships.
npm run audit:spatial
# The chrome census: the spatial instrument can only name the bands it knows
# (fixed, sticky, or a <header> at the top), so a band that is not a <header>
# can hide from it — and a re-baseline would then record a blind spot as an
# improvement. The census measures the same chrome a second way and makes the
# receipt answer for the page. It runs on the committed tree, before the
# stamp, so what it measures is what ships.
npm run audit:chrome
npm run stamp
node scripts/release-snapshot.mjs write "$LOCK/inputs.json"
RELEASE_GATE=1 npx wrangler deploy

# From here on the edge is live: remember the build so a later failure can say so.
DEPLOYED_BUILD="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; console.log(readFileSync("public/app.js", "utf8").match(/const ATLAS_BUILD_TAG = "([^"]+)"/)[1])')"

# The stamp rewrites the asset cache-busters, so the tree is dirty by design once
# a deploy runs. Commit exactly those four stamped files now, straight after the
# deploy and BEFORE verification, so that the commit that records what went to
# the edge exists even when a later check fails. Verification used to run first,
# so a single failing smoke aborted the run after the bytes were already live and
# left the stamp uncommitted — a dirty tree that refused the next release. The
# stamp is a fact about the deploy, not a verdict on it.
#
# Commit with a pathspec, never `git add -A`: a bare commit would sweep anything a
# parallel agent staged mid-release. RELEASE_AGENT names the runner.
STAMPED=(public/app.js public/index.html public/research.html public/dashboard.html public/dashboard.js)
if ! git diff --quiet HEAD -- "${STAMPED[@]}"; then
  git add -- "${STAMPED[@]}"
  git commit -q -m "chore: stamp build $(node --input-type=module -e 'import {readFileSync} from "node:fs"; console.log(readFileSync("public/app.js", "utf8").match(/const ATLAS_BUILD_TAG = "([^"]+)"/)[1])')" -m "Agent: ${RELEASE_AGENT:-unattributed-release}" -- "${STAMPED[@]}"
fi

node scripts/release-snapshot.mjs check "$LOCK/inputs.json"
ATLAS_URL="${ATLAS_URL:-https://jakarta.nonarkara.org}"
EXPECTED_BUILD="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; console.log(readFileSync("public/app.js", "utf8").match(/const ATLAS_BUILD_TAG = "([^"]+)"/)[1])')"
export EXPECTED_BUILD
# Require matching bytes on the canonical hostname and then the custom domain.
node scripts/verify-deployed-bytes.mjs
ATLAS_BASE="$ATLAS_URL" npm run smoke
ATLAS_URL="$ATLAS_URL" node scripts/smoke-official-networks.mjs
ATLAS_URL="$ATLAS_URL" node scripts/smoke-water-context.mjs
ATLAS_URL="$ATLAS_URL" npm run smoke:api
ATLAS_URL="$ATLAS_URL" node scripts/smoke-haze.mjs

npm run smoke:dashboard
# Read the deployed page, not its source. This is the only gate that can see a
# control which renders correctly and swallows its own clicks, or a chart whose
# bars no longer track their values.
ATLAS_URL="$ATLAS_URL" node scripts/audit-rendered.mjs

# The MSH record is measured on the DEPLOYED build — it names that build, and
# the law asks for the pixels at 390, 1024 and 1440 on every route. It cannot
# be captured before the deploy, and a record that names an older build is a
# receipt for a page that is not there: the last one went stale for two days
# and nobody noticed, because nothing said so. So it is captured here, against
# what just shipped.
#
# It is captured into a scratch directory and only moved into docs/msh when
# the capture completes: a browser that dies half way through must not leave a
# half-written record behind, and must not leave the tree dirty for the next
# release. If it cannot be captured at all, the release says so loudly and
# fails — a record that is stale is a record that is a lie, and the build it
# names is printed so nobody has to guess which one.
MSH_SCRATCH="$(mktemp -d)/msh"
if node scripts/msh-evidence.mjs "$ATLAS_URL" "$MSH_SCRATCH"; then
  rm -rf docs/msh
  mkdir -p docs/msh
  cp -R "$MSH_SCRATCH/." docs/msh/
  git add -- docs/msh
  git commit -q -m "docs: record the MSH evidence for the deployed build" -m "Agent: ${RELEASE_AGENT:-unattributed-release}" -- docs/msh
else
  echo "FAIL — the MSH record could not be captured." >&2
  echo "  It still names an older build than the one that just shipped." >&2
  echo "  Shipped build: $(node --input-type=module -e 'import {readFileSync} from "node:fs"; console.log(readFileSync("public/app.js", "utf8").match(/const ATLAS_BUILD_TAG = "([^"]+)"/)[1])')" >&2
  echo "  The record names: $(grep -m1 -o 'jakarta-atlas-[0-9a-z-]*' docs/msh/MSH-EVIDENCE.md || echo nothing)" >&2
  rm -rf "$(dirname "$MSH_SCRATCH")"
  exit 1
fi
rm -rf "$(dirname "$MSH_SCRATCH")"
node scripts/release-snapshot.mjs check "$LOCK/inputs.json"

echo "released ${EXPECTED_BUILD}; working tree:"
git status --short
