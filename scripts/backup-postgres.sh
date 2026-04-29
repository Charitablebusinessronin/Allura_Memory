#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups/postgres"
CONTAINER_NAME="${POSTGRES_CONTAINER:-knowledge-postgres}"
POSTGRES_USER="${POSTGRES_USER:-ronin4life}"
POSTGRES_DB="${POSTGRES_DB:-memory}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUTPUT_FILE="${BACKUP_DIR}/postgres-${POSTGRES_DB}-${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "================================================================================"
echo "DEPRECATION WARNING: scripts/backup-postgres.sh is deprecated."
echo "Use the new TypeScript backup system instead:"
echo "  bun run scripts/backup.ts --type postgres"
echo "This script will be removed in a future release."
echo "================================================================================"
echo ""
echo "WARNING: backup file is plaintext SQL; avoid committing sensitive production data."

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

echo "Creating PostgreSQL backup at ${OUTPUT_FILE}"
docker exec "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${OUTPUT_FILE}"
chmod 600 "${OUTPUT_FILE}"
echo "Backup complete: ${OUTPUT_FILE}"
