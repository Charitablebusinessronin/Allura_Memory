#!/bin/bash
# Entry point for curator-pipeline verifier

set -euo pipefail

mkdir -p /logs

echo "Running curator-pipeline verifier..."
python3 /tests/test.py 2>&1 | tee /logs/test.log
