#!/usr/bin/env bash
# FR-5: Backup Script — Allura Memory System
# Usage: bash scripts/backup.sh [OUTPUT_DIR]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUTPUT_DIR="${1:-${ROOT_DIR}/backups/drill-${TIMESTAMP}}"
CONTAINER_PG="${POSTGRES_CONTAINER:-knowledge-postgres}"
CONTAINER_N4J="${NEO4J_CONTAINER:-knowledge-neo4j}"
PG_USER="${POSTGRES_USER:-ronin4life}"
PG_DB="${POSTGRES_DB:-memory}"
N4J_DB="${NEO4J_DB:-neo4j}"

mkdir -p "${OUTPUT_DIR}"

echo "=== Allura Memory Backup Drill ==="
echo "  Output: ${OUTPUT_DIR}"
echo "  Time:   ${TIMESTAMP}"
echo ""

# ── 1. PostgreSQL Backup ─────────────────────────────────────────────────
echo "Backing up PostgreSQL..."
START_PG=$(date +%s)
docker exec "${CONTAINER_PG}" pg_dump -U "${PG_USER}" --format=custom "${PG_DB}" > "${OUTPUT_DIR}/postgres.dump"
END_PG=$(date +%s)
PG_SIZE=$(stat --printf="%s" "${OUTPUT_DIR}/postgres.dump" 2>/dev/null || stat -f%z "${OUTPUT_DIR}/postgres.dump")
echo "  ✓ PostgreSQL: $((${PG_SIZE}/1024/1024)) MB ($((${END_PG}-${START_PG}))s)"

# ── 2. Neo4j Backup ─────────────────────────────────────────────────────
echo "Backing up Neo4j..."
START_N4J=$(date +%s)
# Use cypher-shell to export all data as cypher statements (online, no downtime)
docker exec "${CONTAINER_N4J}" cypher-shell -u neo4j -p "${NEO4J_PASSWORD}" -d "${N4J_DB}" \
  "CALL apoc.export.cypher.all('${OUTPUT_DIR}/neo4j-export.cypher', {format: 'cypher-shell', useOptimizations: {type: 'UNWIND_BATCH', unwindBatchSize: 20}})" \
  2>/dev/null || {
    # Fallback: dump node/relationship counts and data via cypher-shell
    echo "  APOC export unavailable, using cypher-shell dump..."
    docker exec "${CONTAINER_N4J}" cypher-shell -u neo4j -p "${NEO4J_PASSWORD}" -d "${N4J_DB}" \
      "MATCH (n) RETURN n" > "${OUTPUT_DIR}/neo4j-nodes.json" 2>/dev/null || true
    docker exec "${CONTAINER_N4J}" cypher-shell -u neo4j -p "${NEO4J_PASSWORD}" -d "${N4J_DB}" \
      "MATCH ()-[r]->() RETURN r" > "${OUTPUT_DIR}/neo4j-rels.json" 2>/dev/null || true
  }

# Also dump counts for verification
docker exec "${CONTAINER_N4J}" cypher-shell -u neo4j -p "${NEO4J_PASSWORD}" -d "${N4J_DB}" \
  "MATCH (n) RETURN labels(n)[0] AS label, COUNT(n) AS count ORDER BY count DESC" \
  > "${OUTPUT_DIR}/neo4j-counts.txt" 2>/dev/null

# Try neo4j-admin dump if available (offline)
echo "  Attempting offline neo4j-admin dump..."
docker exec "${CONTAINER_N4J}" neo4j-admin database dump "${N4J_DB}" --to-path="${OUTPUT_DIR}/" --overwrite-destination=true 2>/dev/null \
  && docker cp "${CONTAINER_N4J}:${OUTPUT_DIR}/${N4J_DB}.dump" "${OUTPUT_DIR}/neo4j.dump" 2>/dev/null \
  && echo "  ✓ Neo4j offline dump captured" \
  || echo "  ⚠ Neo4j offline dump unavailable (cypher export preferred)"

END_N4J=$(date +%s)
N4J_SIZE=$(du -sb "${OUTPUT_DIR}"/neo4j* 2>/dev/null | tail -1 | cut -f1 || echo "0")
echo "  Neo4j backup: $((${N4J_SIZE}/1024/1024)) MB ($((${END_N4J}-${START_N4J}))s)"

# ── 3. Config Backup ────────────────────────────────────────────────────
echo "Backing up config..."
cp "${ROOT_DIR}/docker-compose.yml" "${OUTPUT_DIR}/"
cp "${ROOT_DIR}/.env" "${OUTPUT_DIR}/env.base"
cp "${ROOT_DIR}/.env.local" "${OUTPUT_DIR}/env.local" 2>/dev/null || true
echo "  ✓ Config files copied"

# ── 4. Pre-backup PG Counts (for verification) ───────────────────────────
echo "Capturing pre-backup counts for verification..."
docker exec "${CONTAINER_PG}" psql -U "${PG_USER}" -d "${PG_DB}" -c "
SELECT 'allura_memories' AS t, COUNT(*) AS total, COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted FROM allura_memories
UNION ALL SELECT 'events', COUNT(*), NULL, NULL FROM events
UNION ALL SELECT 'canonical_proposals', COUNT(*), NULL, NULL FROM canonical_proposals;
" > "${OUTPUT_DIR}/pg-counts.txt" 2>/dev/null
echo "  ✓ Pre-backup counts captured"

TOTAL_END=$(date +%s)
echo ""
echo "=== Backup Complete ==="
echo "  Directory: ${OUTPUT_DIR}"
echo "  Files:"
ls -lah "${OUTPUT_DIR}/"