#!/bin/bash
# Ralph Loop Setup - Initialize the state file for a new loop
# Part of OpenAgentsControl integration for roninmemory

set -euo pipefail

# Parse arguments
PROMPT=""
MAX_ITERATIONS=0
COMPLETION_PROMISE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --completion-promise)
      COMPLETION_PROMISE="$2"
      shift 2
      ;;
    *)
      if [[ -z "$PROMPT" ]]; then
        PROMPT="$1"
      else
        PROMPT="$PROMPT $1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "Error: No prompt provided"
  echo "Usage: ralph-loop.sh \"PROMPT\" [--max-iterations N] [--completion-promise TEXT]"
  exit 1
fi

# Create state directory if needed
mkdir -p .opencode/state

# Create state file with JSON format (OpenAgentsControl compatible)
RALPH_STATE_FILE=".opencode/state/ralph-loop.json"

cat > "$RALPH_STATE_FILE" <<EOF
{
  "iteration": 1,
  "max_iterations": $MAX_ITERATIONS,
  "completion_promise": "$COMPLETION_PROMISE",
  "prompt": "$PROMPT",
  "created_at": "$(date -Iseconds)"
}
EOF

echo "✅ Ralph loop initialized"
echo "   Iteration: 1"
if [[ $MAX_ITERATIONS -gt 0 ]]; then
  echo "   Max iterations: $MAX_ITERATIONS"
fi
if [[ -n "$COMPLETION_PROMISE" ]]; then
  echo "   Completion promise: $COMPLETION_PROMISE"
fi
echo ""
echo "Working on task..."
