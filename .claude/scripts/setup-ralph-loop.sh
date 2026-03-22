#!/bin/bash
# Setup Ralph Loop - Initialize the state file for a new loop

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
  echo "Usage: setup-ralph-loop.sh \"PROMPT\" [--max-iterations N] [--completion-promise TEXT]"
  exit 1
fi

# Create .claude directory if needed
mkdir -p .claude

# Create state file with frontmatter
RALPH_STATE_FILE=".claude/ralph-loop.local.md"

cat > "$RALPH_STATE_FILE" <<EOF
---
iteration: 1
max_iterations: $MAX_ITERATIONS
completion_promise: "$COMPLETION_PROMISE"
created: $(date -Iseconds)
---
$PROMPT
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