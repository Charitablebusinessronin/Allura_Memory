#!/bin/bash
# RalphLoop Validation Slice 1 — Canonical API Proof
# Usage: ./ralph/run-validation-slice-1.sh
# This is a bounded validation task, not architectural recovery

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║       RalphLoop Validation Slice 1 — Canonical API Proof        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Project: $PROJECT_DIR"
echo "Slice: Validation Slice 1"
echo "Target: Verify canonical POST /api/memory in auto and soc2 modes"
echo ""
echo "Brooksian Approach:"
echo "  • Bounded task (not whole v1 recovery)"
echo "  • Clear success criteria (UUID match, numeric IDs)"
echo "  • Small surface area (one endpoint, two modes)"
echo "  • Fast feedback (curl + DB queries)"
echo "  • Low architectural risk (validation only)"
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
echo "Starting RalphLoop... (Ctrl+C to stop)"
echo "Monitor from another terminal: ralph --status"
echo ""

# Start Next.js server in background
echo "Starting Next.js dev server..."
bun run dev &
SERVER_PID=$!
sleep 5

# Wait for server to be ready
echo "Waiting for server to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Server is ready!"
    break
  fi
  sleep 1
done

# Run Ralph with validation slice
ralph "Read ralph/validation-slice-1.json and ralph/validation-slice-1-prompt.md. Execute each feature in priority order. Update passes to true when all steps succeed. Output <promise>COMPLETE</promise> when all features pass." \
  --agent opencode \
  --tasks \
  --max-iterations 20 \
  --prompt-file "$SCRIPT_DIR/validation-slice-1-prompt.md"

echo ""
echo "Validation complete. Check ralph/validation-slice-1.json for results."

# Cleanup: Kill Next.js server
if [ ! -z "$SERVER_PID" ]; then
  echo "Stopping Next.js server..."
  kill $SERVER_PID 2>/dev/null || true
fi