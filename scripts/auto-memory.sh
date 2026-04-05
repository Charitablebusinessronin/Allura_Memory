#!/bin/bash
# Auto-run at session start
# Place in .bashrc or run manually: source scripts/auto-memory.sh

echo "🧠 Running memory system bootstrap..."

# Check if containers are running
if ! docker ps | grep -q "knowledge-postgres"; then
  echo "❌ PostgreSQL not running. Start with: docker compose up -d"
  return 1
fi

if ! docker ps | grep -q "knowledge-neo4j"; then
  echo "❌ Neo4j not running. Start with: docker compose up -d"
  return 1
fi

# Get credentials from environment or container
# Prefer environment variables from .env.local
: "${POSTGRES_USER:=ronin4life}"
: "${POSTGRES_PASSWORD:=$(docker exec knowledge-postgres printenv POSTGRES_PASSWORD 2>/dev/null)}"
: "${POSTGRES_DB:=memory}"
: "${POSTGRES_HOST:=host.docker.internal}"
: "${POSTGRES_PORT:=5432}"

: "${NEO4J_USER:=neo4j}"
: "${NEO4J_PASSWORD:=$(docker exec knowledge-neo4j printenv NEO4J_AUTH 2>/dev/null | cut -d'/' -f2)}"
: "${NEO4J_URI:=bolt://host.docker.internal:7687}"

# Validate credentials are available
if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "❌ POSTGRES_PASSWORD not set. Add to .env.local or set environment variable"
  return 1
fi

if [ -z "$NEO4J_PASSWORD" ]; then
  echo "❌ NEO4J_PASSWORD not set. Add to .env.local or set environment variable"
  return 1
fi

echo "✅ Memory system credentials loaded"
echo "   Postgres: $POSTGRES_USER@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo "   Neo4j: $NEO4J_USER@$NEO4J_URI"

# Optional: Run quick health check
echo "🔍 Running health check..."
docker exec knowledge-postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && echo "   ✅ PostgreSQL ready" || echo "   ⚠️ PostgreSQL check failed"
curl -s -u "$NEO4J_USER:$NEO4J_PASSWORD" "http://host.docker.internal:7474/db/data/" >/dev/null 2>&1 && echo "   ✅ Neo4j ready" || echo "   ⚠️ Neo4j REST check failed (cypher-shell still works)"

echo ""
echo "💡 Quick memory queries:"
echo "   Postgres: docker exec knowledge-postgres psql -U \$POSTGRES_USER -d memory -c \"SELECT COUNT(*) FROM events;\""
echo "   Neo4j: docker exec knowledge-neo4j cypher-shell -u \$NEO4J_USER -p '\$NEO4J_PASSWORD' \"MATCH (n) RETURN count(n);\""
echo ""
echo "🚀 Ready to use MCP_DOCKER tools:"
echo "   MCP_DOCKER_query_database '{\"query\": \"Get recent events\"}'"
echo "   MCP_DOCKER_read_neo4j_cypher '{\"query\": \"MATCH (n) RETURN count(n)\"}'"
