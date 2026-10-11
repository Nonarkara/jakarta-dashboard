#!/bin/bash
# Verify locally, stamp and deploy, then verify the exact deployed build.
# A release deploys only committed work: an uncommitted tree means the bytes on
# the edge cannot be traced back to a commit.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "release refused: uncommitted changes. Commit, then deploy." >&2
  git diff --stat >&2
  exit 1
fi
npm run typecheck
npm run verify
npm test
npm run deploy
ATLAS_URL="${ATLAS_URL:-https://jakarta.nonarkara.org}"
EXPECTED_BUILD="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; console.log(readFileSync("public/app.js", "utf8").match(/const ATLAS_BUILD_TAG = "([^"]+)"/)[1])')"
export EXPECTED_BUILD
# Allow a bounded edge propagation interval; a mismatch fails the release.
sleep 12
ATLAS_BASE="$ATLAS_URL" npm run smoke
ATLAS_URL="$ATLAS_URL" npm run smoke:api

npm run smoke:dashboard
