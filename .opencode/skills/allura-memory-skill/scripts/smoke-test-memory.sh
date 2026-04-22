#!/usr/bin/env bash
set -euo pipefail

echo "[allura-memory-skill] smoke test checklist"
echo "1. Verify allura-brain_* tools are available"
echo "2. Search memory with group_id=allura-roninmemory"
echo "3. Confirm recent results are returned or empty state is explained"
echo "4. If lower-level diagnostics are needed, use MCP_DOCKER for governed inspection"
echo "5. Confirm no write path is attempted without evidence and policy support"
echo "smoke test script is advisory and intended for deterministic operator guidance"
