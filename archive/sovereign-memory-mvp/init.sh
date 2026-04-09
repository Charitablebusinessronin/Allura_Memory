#!/bin/bash
# Sovereign Memory MVP - Initialization Script
# Run after: docker compose up -d

set -e

echo "🚀 Initializing Sovereign Memory MVP..."

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U sovereign -d memory; do
  sleep 2
done
echo "✅ PostgreSQL ready"

# Wait for Neo4j
echo "⏳ Waiting for Neo4j..."
until docker compose exec -T neo4j cypher-shell -u neo4j -p sovereign-secret "RETURN 1"; do
  sleep 2
done
echo "✅ Neo4j ready"

# Initialize PostgreSQL schemas
echo "📊 Initializing PostgreSQL schemas..."
docker compose exec -T postgres psql -U sovereign -d memory -f /docker-entrypoint-initdb.d/00-traces.sql
docker compose exec -T postgres psql -U sovereign -d memory -f /docker-entrypoint-initdb.d/01-sync-tables.sql
docker compose exec -T postgres psql -U sovereign -d memory -f /docker-entrypoint-initdb.d/02_group_id_enforcement.sql
echo "✅ PostgreSQL schemas initialized"

# Initialize Neo4j constraints
echo "🔗 Initializing Neo4j constraints..."
docker compose exec -T neo4j cypher-shell -u neo4j -p sovereign-secret "
  CREATE CONSTRAINT group_id IF NOT EXISTS FOR (n:Insight) REQUIRE n.group_id IS NOT NULL;
  CREATE CONSTRAINT insight_id IF NOT EXISTS FOR (n:Insight) REQUIRE n.id IS UNIQUE;
  CREATE CONSTRAINT deprecated IF NOT EXISTS FOR (n:Insight) REQUIRE n.deprecated IS BOOLEAN;
"
echo "✅ Neo4j constraints initialized"

# Health check
echo "🏥 Running health checks..."
curl -sf http://localhost:3000/health || echo "⚠️  MCP server not responding (may still be starting)"

echo ""
echo "✅ Sovereign Memory MVP initialized!"
echo ""
echo "📍 Endpoints:"
echo "   MCP Server:    http://localhost:3000"
echo "   Paperclip:     http://localhost:3001"
echo "   PostgreSQL:    localhost:5432"
echo "   Neo4j Browser: http://localhost:7474"
echo "   Neo4j Bolt:    bolt://localhost:7687"
echo ""
echo "🔐 Credentials:"
echo "   PostgreSQL:    sovereign / sovereign-secret"
echo "   Neo4j:         neo4j / sovereign-secret"
echo ""
echo "📚 Next steps:"
echo "   1. Open Paperclip: http://localhost:3001"
echo "   2. Configure MCP client to connect to localhost:3000"
echo "   3. Add traces via MCP: add_trace({ group_id: 'allura-test', event_type: 'test', payload: {} })"
echo ""