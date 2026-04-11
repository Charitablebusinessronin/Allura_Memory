#!/bin/bash
# Allura-Ralph Loop — Epic 1 completion with Allura-specific rules
# Usage: ./ralph/allura-ralph.sh [max_iterations] [agent]
# Default: 50 iterations, claude-code agent

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MAX_ITERATIONS="${1:-50}"
AGENT="${2:-opencode}"
MODEL="${3:-}"

# Check if ralph CLI is installed
if ! command -v ralph &> /dev/null; then
    echo "Error: ralph CLI not found."
    echo "Install: npm install -g @th0rgal/ralph-wiggum"
    exit 1
fi

# Check if features.json exists
if [ ! -f "$SCRIPT_DIR/features.json" ]; then
    echo "Error: ralph/features.json not found."
    echo "Create it from ralph/prd.json first."
    exit 1
fi

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              Allura-Ralph Loop — Epic 1 Completion               ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Project: $PROJECT_DIR"
echo "Agent: $AGENT"
echo "Model: $MODEL"
echo "Max iterations: $MAX_ITERATIONS"
echo "Features file: ralph/features.json"
echo ""
echo "Allura Rules (NON-NEGOTIABLE):"
echo "  • bun only — never npm, npx, or node directly"
echo "  • Postgres is append-only — INSERT only, never UPDATE/DELETE"
echo "  • group_id required — every DB operation must include group_id"
echo "  • Kernel routing — trace writes through RuVixKernel.syscall('trace')"
echo "  • Neo4j versioning — use SUPERSEDES, never edit existing nodes"
echo "  • HITL required — never autonomously promote to Neo4j"
echo "  • MCP_DOCKER tools only — never docker exec for DB operations"
echo ""
echo "Starting loop... (Ctrl+C to stop)"
echo "Monitor from another terminal: ralph --status"
echo ""

# Run Ralph with Allura-specific prompt
ralph "Read ralph/features.json and ralph/CLAUDE.md. Work through each feature one at a time in priority order. After verifying a feature works end-to-end, update its 'passes' field to true. Do NOT modify the description or steps — only change the passes boolean. Output <promise>COMPLETE</promise> when all features pass." \
  --agent "$AGENT" \
  --model "$MODEL" \
  --tasks \
  --max-iterations "$MAX_ITERATIONS" \
  --prompt-file "$SCRIPT_DIR/CLAUDE.md"

echo ""
echo "Loop complete. Check ralph/features.json for final status."