#!/bin/bash
# Ralph loop — Epic 1 completion
# Usage: ./ralph/ralph.sh [max_iterations]
# Default: 15 iterations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MAX_ITERATIONS="${1:-15}"

echo "Ralph starting — Epic 1 completion"
echo "Project: $PROJECT_DIR"
echo "Max iterations: $MAX_ITERATIONS"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "==============================================================="
  echo "  Iteration $i of $MAX_ITERATIONS"
  echo "==============================================================="

  OUTPUT=$(claude --dangerously-skip-permissions --print \
    --add-dir "$PROJECT_DIR" \
    < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true

  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Epic 1 complete! Finished at iteration $i."
    exit 0
  fi

  echo "Iteration $i done. Continuing..."
  sleep 2
done

echo ""
echo "Reached max iterations ($MAX_ITERATIONS). Check ralph/progress.txt for status."
exit 1
