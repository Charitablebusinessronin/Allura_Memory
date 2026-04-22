#!/usr/bin/env bash
set -euo pipefail

echo "[allura-memory-skill] validating memory environment"

required_vars=(
  POSTGRES_HOST
  POSTGRES_PORT
  POSTGRES_DB
  POSTGRES_USER
  NEO4J_URI
  NEO4J_USER
)

missing=0

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "missing: $var"
    missing=1
  else
    echo "ok: $var"
  fi
done

if [[ $missing -ne 0 ]]; then
  echo "environment validation failed"
  exit 1
fi

echo "environment validation passed"
