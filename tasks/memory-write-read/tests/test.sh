#!/bin/bash
# Entry point for memory-write-read verifier
# Writes reward (0.0-1.0) to /logs/reward.txt

set -euo pipefail

mkdir -p /logs

echo "Running memory-write-read verifier..."
python3 /tests/test.py 2>&1 | tee /logs/test.log

# Exit code 0 = test.py wrote reward successfully
