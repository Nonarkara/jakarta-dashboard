#!/bin/bash
# The production gate, runnable locally.
# Used by .github/workflows/gate.yml and by local release candidates.
# Usage: bash scripts/gate-local.sh
# Exits 0 on full green; non-zero on any failure.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Jakarta Dashboard Gate Local ==="
expected_node="$(cat .nvmrc)"
actual_node="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$actual_node" != "$expected_node" ]]; then
  echo "FAIL: Node $expected_node is required by .nvmrc. Found $(node -v)." >&2
  exit 1
fi
echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo ""

# 1. Secret scan (tracked tree)
echo "--- 1/8 Secret scan ---"
PATTERNS='AIza[0-9A-Za-z_-]{30,}|nvapi-[0-9A-Za-z_-]{20,}|sk-ant-[0-9A-Za-z_-]{20,}|sk-proj-[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|cfoat_[0-9A-Za-z]{20,}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}'
if git grep -IlE "$PATTERNS" -- . ':!*.png' ':!*.jpg' ':!*.pdf' ':!*.woff2'; then
  echo "FAIL: live-key pattern found in tracked files." >&2
  exit 1
else
  scan_status=$?
  if [[ "$scan_status" != 1 ]]; then
    echo "FAIL: tracked tree scan failed (git grep exit $scan_status)." >&2
    exit "$scan_status"
  fi
fi
echo "PASS: no live keys in tracked tree"
echo ""

# 2. Install with --ignore-scripts (cheaper, matches CI cache behavior)
echo "--- 2/8 npm ci --ignore-scripts ---"
npm ci --ignore-scripts
echo ""

# 3. Typecheck
echo "--- 3/8 typecheck ---"
npm run typecheck
echo ""

# 4. Verify (local contract checks)
echo "--- 4/8 verify ---"
npm run verify
echo ""

# 5. Test suite (includes anti-slop mutation harness)
echo "--- 5/8 test ---"
npm test
echo ""

# 6. Spatial gate (measurements + falsifier)
echo "--- 6/8 spatial gate + falsifier ---"
npm run audit:spatial
npm run audit:spatial:falsify
echo ""

# 7. Chrome census (the receipt against the page)
#
# The spatial instrument can only name the bands it knows: fixed, sticky, or a
# <header> at the top. A band that is not a <header> can hide from it — and a
# re-baseline would then record that blindness as an improvement. The census
# measures the same chrome a second way and makes the receipt answer for the
# page.
echo "--- 7/8 chrome census ---"
npm run audit:chrome
echo ""

# 8. The census's own falsifier: a gate that has never failed protects
# nothing. This plants the band that shipped and requires the census to
# catch it.
echo "--- 8/8 chrome census falsifier ---"
npm run audit:chrome:falsify
echo ""

echo "=== GATE LOCAL: ALL GREEN ==="