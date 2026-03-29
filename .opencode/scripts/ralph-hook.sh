#!/bin/bash
# Ralph Wiggum Stop Hook
# Prevents session exit when a ralph-loop is active
# Feeds Claude's output back as input to continue the loop
# OpenAgentsControl-compatible version

set -euo pipefail

# State file location (OpenAgentsControl standard)
RALPH_STATE_FILE=".opencode/state/ralph-loop.json"

# Check if ralph-loop is active
if [[ ! -f "$RALPH_STATE_FILE" ]]; then
  # No active loop - allow exit
  exit 0
fi

# Parse JSON state file
ITERATION=$(jq -r '.iteration // empty' "$RALPH_STATE_FILE" 2>/dev/null || echo "")
MAX_ITERATIONS=$(jq -r '.max_iterations // 0' "$RALPH_STATE_FILE" 2>/dev/null || echo "0")
COMPLETION_PROMISE=$(jq -r '.completion_promise // empty' "$RALPH_STATE_FILE" 2>/dev/null || echo "")
PROMPT=$(jq -r '.prompt // empty' "$RALPH_STATE_FILE" 2>/dev/null || echo "")

# Validate numeric fields
if [[ -z "$ITERATION" ]] || [[ ! "$ITERATION" =~ ^[0-9]+$ ]]; then
  echo "⚠️  Ralph loop: State file corrupted - iteration field invalid" >&2
  rm "$RALPH_STATE_FILE"
  exit 0
fi

if [[ ! "$MAX_ITERATIONS" =~ ^[0-9]+$ ]]; then
  echo "⚠️  Ralph loop: State file corrupted - max_iterations field invalid" >&2
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# Check if max iterations reached
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "🛑 Ralph loop: Max iterations ($MAX_ITERATIONS) reached."
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# Check for completion promise
if [[ -n "$COMPLETION_PROMISE" ]]; then
  # This would be checked against the last assistant message
  # For now, we rely on the agent to signal completion
  :
fi

# Increment iteration
NEXT_ITERATION=$((ITERATION + 1))

# Update state file
jq --argjson next "$NEXT_ITERATION" '.iteration = $next' "$RALPH_STATE_FILE" > "${RALPH_STATE_FILE}.tmp" && \
  mv "${RALPH_STATE_FILE}.tmp" "$RALPH_STATE_FILE"

# Build system message
if [[ -n "$COMPLETION_PROMISE" ]]; then
  SYSTEM_MSG="🔄 Ralph iteration $NEXT_ITERATION | To stop: output <promise>$COMPLETION_PROMISE</promise>"
else
  SYSTEM_MSG="🔄 Ralph iteration $NEXT_ITERATION | No completion promise set - loop runs infinitely"
fi

# Output to continue loop
echo "$SYSTEM_MSG"
echo ""
echo "Previous prompt: $PROMPT"

exit 0
