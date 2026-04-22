#!/usr/bin/env bash
set -euo pipefail

echo "[allura-memory-skill] smoke test (native MCP_DOCKER)"
echo "=================================================="
echo "This script is advisory and intended for deterministic operator guidance."
echo ""

echo "Step 1: Verify environment variables"
echo "  Required: NEO4J_URL, NEO4J_USERNAME (or NEO4J_USER), NEO4J_PASSWORD, NEO4J_DATABASE"
echo "  Required: POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD"
echo ""

echo "Step 2: MCP_DOCKER server discovery"
echo "  Run: mcp__MCP_DOCKER__mcp_find('neo4j-memory')"
echo "  Run: mcp__MCP_DOCKER__mcp_find('database-server')"
echo "  Run: mcp__MCP_DOCKER__mcp_find('neo4j-cypher')"
echo ""

echo "Step 3: MCP_DOCKER server configuration"
echo "  Run: mcp__MCP_DOCKER__mcp_config_set('neo4j-memory', {url: $NEO4J_URL, username: ...})"
echo "  Run: mcp__MCP_DOCKER__mcp_config_set('database-server', {host: ...})"
echo ""

echo "Step 4: MCP_DOCKER server activation"
echo "  Run: mcp__MCP_DOCKER__mcp_add('neo4j-memory')"
echo "  Run: mcp__MCP_DOCKER__mcp_add('database-server')"
echo "  Run: mcp__MCP_DOCKER__mcp_add('neo4j-cypher') # only if needed"
echo ""

echo "Step 5: Verify tools are available"
echo "  Run: mcp__MCP_DOCKER__listTools (look for mcp__MCP_DOCKER__* tools)"
echo ""

echo "Step 6: Confirm no custom allura-brain_memory_* tools are used"
echo "  Custom memory MCP surface is deprecated."
echo ""

echo "Step 7: Search memory with group_id=allura-roninmemory"
echo "  Confirm recent results are returned or empty state is explained"
echo ""

echo "Step 8: If lower-level diagnostics are needed, use MCP_DOCKER"
echo "  Do not invoke allura-brain_memory_* tools directly."
echo ""
echo "smoke test completed."
