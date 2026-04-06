#!/bin/bash
# Entry point for agent-routing verifier

set -euo pipefail

mkdir -p /logs

echo "Running agent-routing verifier..."
python3 /tests/test.py 2>&1 | tee /logs/test.log
