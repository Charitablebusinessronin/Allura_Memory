#!/bin/bash
# Entry point for group-id-isolation verifier

set -euo pipefail

mkdir -p /logs

echo "Running group-id-isolation verifier..."
python3 /tests/test.py 2>&1 | tee /logs/test.log
