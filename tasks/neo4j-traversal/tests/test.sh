#!/bin/bash
# Entry point for neo4j-traversal verifier

set -euo pipefail

mkdir -p /logs

echo "Running neo4j-traversal verifier..."
python3 /tests/test.py 2>&1 | tee /logs/test.log
