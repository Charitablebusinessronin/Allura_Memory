#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups/neo4j"
CONTAINER_NAME="${NEO4J_CONTAINER:-knowledge-neo4j}"
NEO4J_DB="${NEO4J_DB:-neo4j}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUTPUT_FILE="${BACKUP_DIR}/neo4j-${NEO4J_DB}-${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "================================================================================"
echo "DEPRECATION WARNING: scripts/backup-neo4j.sh is deprecated."
echo "Use the new TypeScript backup system instead:"
echo "  bun run scripts/backup.ts --type neo4j"
echo "This script will be removed in a future release."
echo "================================================================================"
echo ""
echo "WARNING: backup file may contain sensitive data; avoid committing production dumps."

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker command not found" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: docker daemon is not reachable" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -Fx "${CONTAINER_NAME}" >/dev/null 2>&1; then
  echo "ERROR: container '${CONTAINER_NAME}' is not running" >&2
  exit 1
fi

echo "Creating Neo4j backup in container"
echo "Stopping Neo4j for consistent offline dump"
docker exec "${CONTAINER_NAME}" neo4j stop

docker exec "${CONTAINER_NAME}" neo4j-admin database dump "${NEO4J_DB}" --to-path=/tmp --overwrite-destination=true

echo "Starting Neo4j after dump"
docker exec "${CONTAINER_NAME}" neo4j start

CONTAINER_FILE="/tmp/${NEO4J_DB}.dump"
docker cp "${CONTAINER_NAME}:${CONTAINER_FILE}" "${OUTPUT_FILE}"
docker exec "${CONTAINER_NAME}" rm -f "${CONTAINER_FILE}"
chmod 600 "${OUTPUT_FILE}"

echo "Backup complete: ${OUTPUT_FILE}"
