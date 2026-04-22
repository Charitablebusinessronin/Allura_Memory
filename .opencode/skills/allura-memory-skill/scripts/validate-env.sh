#!/usr/bin/env bash
set -euo pipefail

echo "[allura-memory-skill] validating memory environment (native MCP_DOCKER)"

# Neo4j validation
neo4j_missing=0

for var in "NEO4J_URL" "NEO4J_PASSWORD" "NEO4J_DATABASE"; do
  if [[ -z "${!var:-}" ]]; then
    echo "missing: $var"
    neo4j_missing=1
  else
    echo "ok: $var"
  fi
done

# One of NEO4J_USERNAME or NEO4J_USER must be set
if [[ -z "${NEO4J_USERNAME:-}" && -z "${NEO4J_USER:-}" ]]; then
  echo "missing: NEO4J_USERNAME or NEO4J_USER"
  neo4j_missing=1
else
  echo "ok: NEO4J_USERNAME or NEO4J_USER"
fi

# PostgreSQL validation
postgres_missing=0

for var in "POSTGRES_HOST" "POSTGRES_PORT" "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD"; do
  if [[ -z "${!var:-}" ]]; then
    echo "missing: $var"
    postgres_missing=1
  else
    echo "ok: $var"
  fi
done

if [[ $neo4j_missing -ne 0 || $postgres_missing -ne 0 ]]; then
  echo "environment validation failed"
  exit 1
fi

echo "environment validation passed"
