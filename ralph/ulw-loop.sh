#!/bin/bash
# =============================================================================
# ULW-Loop: Ultra-Learning Workflow — Self-Referential Autonomous Loop
# =============================================================================
# A self-referential loop that doesn't stop until 100% done.
# Each iteration: read plan → dispatch Team RAM agent → execute → validate → commit → update plan → repeat
#
# Usage:
#   ./ralph/ulw-loop.sh              # Unlimited iterations until plan complete
#   ./ralph/ulw-loop.sh 20           # Max 20 iterations
#   ./ralph/ulw-loop.sh plan         # Plan mode only (no implementation)
#   ./ralph/ulw-loop.sh plan 5       # Plan mode, max 5 iterations
#
# Architecture:
#   Ralph CLI → OpenCode → Team RAM Agent → Code Changes → Validate → Commit
#   └── Loop reads own output (git history + plan state) → self-corrects
# =============================================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────

RALPH_DIR="ralph"
PLAN_FILE="$RALPH_DIR/IMPLEMENTATION_PLAN.md"
LOG_FILE="$RALPH_DIR/ulw-history.json"
CONTEXT_FILE="$RALPH_DIR/ulw-context.md"

# ── Parse Arguments ────────────────────────────────────────────────────────────

MODE="build"
MAX_ITERATIONS=999

if [[ $# -ge 1 ]]; then
  if [[ "$1" == "plan" ]]; then
    MODE="plan"
    shift
  elif [[ "$1" =~ ^[0-9]+$ ]]; then
    MAX_ITERATIONS=$1
    shift
  fi
fi

if [[ $# -ge 1 ]] && [[ "$1" =~ ^[0-9]+$ ]]; then
  MAX_ITERATIONS=$1
fi

# ── Initialization ──────────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ULW-Loop: Ultra-Learning Workflow                          ║"
echo "║  Mode: $MODE"
echo "║  Max Iterations: $MAX_ITERATIONS"
echo "╚══════════════════════════════════════════════════════════════╝"

# Initialize history file if it doesn't exist
if [[ ! -f "$LOG_FILE" ]]; then
  echo '{"iterations":[]}' > "$LOG_FILE"
fi

# Initialize context file if it doesn't exist
if [[ ! -f "$CONTEXT_FILE" ]]; then
  touch "$CONTEXT_FILE"
fi

# ── Completion Check ────────────────────────────────────────────────────────────

check_plan_complete() {
  if [[ ! -f "$PLAN_FILE" ]]; then
    echo "ERROR: Plan file not found at $PLAN_FILE" >&2
    return 1
  fi

  # Check for explicit completion marker
  if grep -q "Status: 100% Complete" "$PLAN_FILE" 2>/dev/null; then
    echo "ULW: Plan is 100% complete. Exiting loop."
    return 0
  fi

  # Check if all tasks are marked done
  local total_tasks
  local done_tasks
  total_tasks=$(grep -cE '^\s*-\s+\[' "$PLAN_FILE" 2>/dev/null || echo 0)
  done_tasks=$(grep -cE '^\s*-\s+\[x\]' "$PLAN_FILE" 2>/dev/null || echo 0)

  if [[ $total_tasks -gt 0 ]] && [[ $done_tasks -eq $total_tasks ]]; then
    echo "ULW: All $total_tasks tasks complete. Exiting loop."
    return 0
  fi

  echo "ULW: Progress: $done_tasks/$total_tasks tasks complete."
  return 1
}

# ── Log Iteration ───────────────────────────────────────────────────────────────

log_iteration() {
  local iteration=$1
  local status=$2
  local duration=$3

  # Append to history JSON (simple approach)
  local entry="{\"iteration\":$iteration,\"mode\":\"$MODE\",\"status\":\"$status\",\"duration\":\"$duration\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

  # Use python/jq if available, otherwise simple append
  if command -v jq &>/dev/null; then
    jq --argjson entry "$entry" '.iterations += [$entry]' "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
  else
    # Simple append (not perfect JSON but functional)
    sed -i "s/]}$/]},{\"iteration\":$iteration,\"mode\":\"$MODE\",\"status\":\"$status\",\"duration\":\"$duration\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}]}/" "$LOG_FILE" 2>/dev/null || true
  fi
}

# ── Main Loop ───────────────────────────────────────────────────────────────────

ITERATION=0

while [[ $ITERATION -lt $MAX_ITERATIONS ]]; do
  ITERATION=$((ITERATION + 1))
  START_TIME=$(date +%s)

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "ULW Iteration $ITERATION / $MAX_ITERATIONS (Mode: $MODE)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Check for mid-loop context injection
  if [[ -s "$CONTEXT_FILE" ]]; then
    echo "ULW: Injecting context from $CONTEXT_FILE"
    CONTEXT_ARG="--add-context $(cat "$CONTEXT_FILE")"
    # Clear context after one use
    > "$CONTEXT_FILE"
  else
    CONTEXT_ARG=""
  fi

  # Check if plan is already complete
  if check_plan_complete; then
    log_iteration "$ITERATION" "plan_complete" "0s"
    echo ""
    echo "✅ ULW: All tasks complete. Loop exiting."
    exit 0
  fi

  # ── Execute Iteration ──────────────────────────────────────────────────────

  if [[ "$MODE" == "plan" ]]; then
    # Plan mode: only update plan, no implementation
    ralph "/ralph plan" --max-iterations 1 2>/dev/null || \
    claude-code "/ralph plan" --max-iterations 1 2>/dev/null || \
    echo "ULW: No agent CLI available. Running directly." && \
    echo "Run: claude-code '/ralph plan' manually."
  else
    # Build mode: dispatch to agent
    ralph "Execute the next most important task from $PLAN_FILE. Read ralph/PROMPT_ulw.md for instructions. Work through one task completely. Validate with 'bun run typecheck && bun test'. Commit and update plan. Output <promise>TASK_COMPLETE</promise> when done." --max-iterations 1 2>/dev/null || \
    claude-code "Execute the next most important task from $PLAN_FILE. Read ralph/PROMPT_ulw.md for instructions. Work through one task completely. Validate with 'bun run typecheck && bun test'. Commit and update plan. Output <promise>TASK_COMPLETE</promise> when done." --max-iterations 1 2>/dev/null || \
    echo "ULW: No agent CLI available. Running directly." && \
    echo "Run: claude-code with the ULW prompt manually."
  fi

  # ── Post-Iteration ─────────────────────────────────────────────────────────

  END_TIME=$(date +%s)
  DURATION=$(( END_TIME - START_TIME ))
  DURATION_STR="${DURATION}s"

  log_iteration "$ITERATION" "completed" "$DURATION_STR"

  echo "ULW: Iteration $ITERATION completed in $DURATION_STR"

  # Brief pause to avoid API rate limits
  sleep 2

done

echo ""
echo "⚠️  ULW: Reached max iterations ($MAX_ITERATIONS). Plan may not be 100% complete."
echo "Run './ralph/ulw-loop.sh' again to continue, or './ralph/ulw-loop.sh $((MAX_ITERATIONS + 50))' for more."
exit 1