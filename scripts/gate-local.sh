#!/bin/bash
# The production gate, runnable locally.
# Mirrors .github/workflows/gate.yml step-for-step so a red tree cannot
# sit on main unseen. CI edits must make CI cheaper, never heavier.
# Usage: bash scripts/gate-local.sh
# Exits 0 on full green; non-zero on any failure.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Jakarta Dashboard Gate Local ==="
echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo ""

# 1. Secret scan (tracked tree) — matches gate.yml exactly
echo "--- 1/6 Secret scan ---"
PATTERNS='AIza[0-9A-Za-z_-]{30,}|nvapi-[0-9A-Za-z_-]{20,}|sk-ant-[0-9A-Za-z_-]{20,}|sk-proj-[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|cfoat_[0-9A-Za-z]{20,}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}'
if git grep -IlE "$PATTERNS" -- . ':!*.png' ':!*.jpg' ':!*.pdf' ':!*.woff2'; then
  echo "FAIL: live-key pattern found in tracked files." >&2
  exit 1
fi
echo "PASS: no live keys in tracked tree"
echo ""

# 2. Install with --ignore-scripts (cheaper, matches CI cache behavior)
echo "--- 2/6 npm ci --ignore-scripts ---"
npm ci --ignore-scripts
echo ""

# 3. Typecheck
echo "--- 3/6 typecheck ---"
npm run typecheck
echo ""

# 4. Verify (local contract checks)
echo "--- 4/6 verify ---"
npm run verify
echo ""

# 5. Test suite (includes anti-slop mutation harness)
echo "--- 5/6 test ---"
npm test
echo ""

# 6. Spatial gate (measurements + falsifier)
echo "--- 6/6 spatial gate + falsifier ---"
npm run audit:spatial
npm run audit:spatial:falsify
echo ""

echo "=== GATE LOCAL: ALL GREEN ==="