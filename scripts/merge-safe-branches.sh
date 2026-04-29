#!/usr/bin/env bash
# Merge 11 safe claude/* branches into main with strict guardrails.
# Usage: bash scripts/merge-safe-branches.sh
#
# After EACH merge:
#   1. npx vite build must succeed
#   2. Server must boot on port 5000 and respond 200 on /
# If either fails, the merge is auto-reverted and marked SKIPPED.
#
# At the end, a markdown report is printed and written to
# .local/.merge-safe-branches-report.md

set -u
cd "$(dirname "$0")/.."

REPORT_FILE=".local/.merge-safe-branches-report.md"
LOG_DIR="/tmp/merge-logs"
mkdir -p "$LOG_DIR" .local

# Branch list — order matters (zero-conflict first, then low-conflict, gallant-herschel last)
BRANCHES=(
  "claude/container-runtime-design"
  "claude/perf-2-vendor-chunks"
  "claude/perf-3-query-stale-time"
  "claude/perf-5-optimize-deps"
  "claude/yjs-multiuser-test"
  "claude/perf-1-lazy-panels"
  "claude/perf-4-db-batch-commits"
  "claude/panel-coverage-extension"
  "claude/critical-path-api-tests"
  "claude/goofy-heyrovsky"
  "claude/gallant-herschel"
)

declare -A RESULT
declare -A REASON
declare -A COMMIT_HASH

# --- Sanity ---
echo "==> Cleaning any leftover lock"
rm -f .git/index.lock || true

echo "==> Current branch"
CURRENT=$(git rev-parse --abbrev-ref HEAD)
echo "    $CURRENT"
if [[ "$CURRENT" != "main" ]]; then
  echo "    Switching to main..."
  git checkout main || { echo "FATAL: cannot checkout main"; exit 1; }
fi

echo "==> Working tree must be clean"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "    UNCOMMITTED CHANGES — refusing to proceed"
  git status --short
  exit 1
fi

echo "==> Fetching origin"
git fetch origin --prune 2>&1 | tail -5

echo "==> Tagging baseline"
git tag -f pre-merge-batch-1 HEAD
BASELINE=$(git rev-parse HEAD)
echo "    baseline = $BASELINE"

# --- Validation function ---
validate() {
  local label="$1"
  local build_log="$LOG_DIR/${label}-build.log"
  local server_log="$LOG_DIR/${label}-server.log"

  echo "    [validate] vite build..."
  if ! npx vite build > "$build_log" 2>&1; then
    echo "    [validate] BUILD FAILED — see $build_log"
    tail -20 "$build_log"
    return 1
  fi
  echo "    [validate] build OK"

  echo "    [validate] booting server..."
  PORT=5001 NODE_ENV=development node --import tsx/esm server/index.ts > "$server_log" 2>&1 &
  local pid=$!
  local ok=0
  for i in $(seq 1 20); do
    sleep 1
    if curl -sf -o /dev/null http://localhost:5001/; then
      ok=1
      break
    fi
  done
  kill $pid 2>/dev/null || true
  wait $pid 2>/dev/null || true

  if [[ $ok -eq 0 ]]; then
    echo "    [validate] SERVER FAILED to respond 200 on / — see $server_log"
    tail -30 "$server_log"
    return 1
  fi
  echo "    [validate] server OK"
  return 0
}

# --- Validate baseline first ---
echo ""
echo "==> Validating baseline before any merges"
if ! validate "baseline"; then
  echo "FATAL: baseline does not pass validation. Aborting."
  exit 1
fi
echo "==> Baseline OK"

# --- Merge loop ---
for branch in "${BRANCHES[@]}"; do
  echo ""
  echo "================================================================"
  echo "==> Processing $branch"
  echo "================================================================"

  if ! git rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
    RESULT[$branch]="SKIPPED"
    REASON[$branch]="origin/$branch does not exist"
    echo "    SKIPPED: branch not found on origin"
    continue
  fi

  PRE_MERGE=$(git rev-parse HEAD)

  # Attempt the merge
  if git merge --no-ff "origin/$branch" -m "Merge $branch into main (batch-1)" 2>&1 | tee "$LOG_DIR/${branch//\//_}-merge.log"; then
    MERGE_RESULT=$?
  else
    MERGE_RESULT=$?
  fi

  # Check if merge succeeded
  if ! git diff --quiet --check 2>/dev/null && [[ -n "$(git ls-files -u)" ]]; then
    echo "    Merge produced conflicts — aborting"
    git merge --abort 2>/dev/null || git reset --hard "$PRE_MERGE"
    RESULT[$branch]="SKIPPED"
    REASON[$branch]="merge conflict"
    continue
  fi

  POST_MERGE=$(git rev-parse HEAD)
  if [[ "$POST_MERGE" == "$PRE_MERGE" ]]; then
    RESULT[$branch]="SKIPPED"
    REASON[$branch]="already merged (no-op)"
    echo "    Already merged — nothing to do"
    continue
  fi

  # Validate
  label="${branch//\//_}"
  if validate "$label"; then
    RESULT[$branch]="MERGED"
    COMMIT_HASH[$branch]="$POST_MERGE"
    REASON[$branch]=""
    echo "    MERGED at $POST_MERGE"
  else
    echo "    Validation FAILED — reverting merge $POST_MERGE"
    git reset --hard "$PRE_MERGE"
    RESULT[$branch]="SKIPPED"
    REASON[$branch]="build or boot failure after merge"
  fi
done

# --- Final report ---
echo ""
echo "================================================================"
echo "==> Final report"
echo "================================================================"

{
  echo "# Merge Safe Branches — Report"
  echo ""
  echo "Baseline: \`$BASELINE\`"
  echo "Final HEAD: \`$(git rev-parse HEAD)\`"
  echo ""
  echo "| Branch | Result | Commit / Reason |"
  echo "|--------|--------|------------------|"
  for branch in "${BRANCHES[@]}"; do
    r="${RESULT[$branch]:-UNKNOWN}"
    if [[ "$r" == "MERGED" ]]; then
      echo "| \`$branch\` | MERGED | \`${COMMIT_HASH[$branch]:0:12}\` |"
    else
      echo "| \`$branch\` | $r | ${REASON[$branch]} |"
    fi
  done
  echo ""
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} | tee "$REPORT_FILE"

echo ""
echo "Report written to $REPORT_FILE"

# --- Final validation ---
echo ""
echo "==> Final end-to-end validation"
if validate "final"; then
  echo "==> ALL GREEN — main is healthy"
  exit 0
else
  echo "==> WARNING: final validation failed despite per-merge checks. Check $LOG_DIR/final-*.log"
  exit 2
fi
