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
  exit 1
fi
trap 'rmdir "$LOCK"' EXIT

check_clean() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
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
npm run deploy
ATLAS_URL="${ATLAS_URL:-https://jakarta.nonarkara.org}"
EXPECTED_BUILD="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; console.log(readFileSync("public/app.js", "utf8").match(/const ATLAS_BUILD_TAG = "([^"]+)"/)[1])')"
export EXPECTED_BUILD
# Require matching bytes on the canonical hostname and then the custom domain.
node scripts/verify-deployed-bytes.mjs
ATLAS_BASE="$ATLAS_URL" npm run smoke
ATLAS_URL="$ATLAS_URL" npm run smoke:api

npm run smoke:dashboard

# The stamp rewrites the asset cache-busters, so the tree is dirty by design once
# a deploy runs. Commit exactly those four stamped files, never `git add -A`, and
# commit WITH a pathspec too: a bare `git commit` would commit the whole index,
# sweeping anything a parallel agent staged mid-release. RELEASE_AGENT names the
# runner in the audit trail. This leaves a clean tree for the next release.
STAMPED=(public/app.js public/index.html public/dashboard.html public/dashboard.js)
if ! git diff --quiet HEAD -- "${STAMPED[@]}"; then
  git add -- "${STAMPED[@]}"
  git commit -q -m "chore: stamp build ${EXPECTED_BUILD}" -m "Agent: ${RELEASE_AGENT:-unattributed-release}" -- "${STAMPED[@]}"
  echo "stamped ${EXPECTED_BUILD} committed"
fi
git status --short
