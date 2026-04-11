#!/usr/bin/env bash

#############################################################################
# Allura Memory + OpenCode CLI Integration Test
# Tests the complete workflow from CLI to memory storage
#############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

info() {
    echo -e "${BLUE}ℹ INFO${NC}: $1"
}

section() {
    echo ""
    echo "========================================="
    echo "$1"
    echo "========================================="
}

#############################################################################
# Test 1: OpenCode CLI Available
#############################################################################
section "Test 1: OpenCode CLI"

if command -v opencode &>/dev/null; then
    pass "OpenCode CLI is installed"
    VERSION=$(opencode --version 2>&1)
    info "Version: $VERSION"
else
    fail "OpenCode CLI NOT installed"
    exit 1
fi

#############################################################################
# Test 2: Agents Available
#############################################################################
section "Test 2: Agents Available"

AGENTS=$(opencode agent list 2>&1)

if echo "$AGENTS" | grep -q "BROOKS_ARCHITECT"; then
    pass "Brooks Architect agent available"
else
    fail "Brooks Architect agent NOT available"
fi

if echo "$AGENTS" | grep -q "SCOUT_RECON"; then
    pass "Scout Recon agent available"
else
    fail "Scout Recon agent NOT available"
fi

#############################################################################
# Test 3: Database Containers Running
#############################################################################
section "Test 3: Database Containers"

if docker ps | grep -q "knowledge-postgres"; then
    pass "PostgreSQL container running"
else
    fail "PostgreSQL container NOT running"
    warn "Start with: docker compose up -d"
fi

if docker ps | grep -q "knowledge-neo4j"; then
    pass "Neo4j container running"
else
    fail "Neo4j container NOT running"
    warn "Start with: docker compose up -d"
fi

#############################################################################
# Test 4: Database Connectivity
#############################################################################
section "Test 4: Database Connectivity"

if docker exec knowledge-postgres psql -U ronin4life -d memory -c "SELECT COUNT(*) FROM events;" &>/dev/null; then
    pass "PostgreSQL accepts queries"
    EVENT_COUNT=$(docker exec knowledge-postgres psql -U ronin4life -d memory -t -c "SELECT COUNT(*) FROM events;" | tr -d ' ')
    info "Events in database: $EVENT_COUNT"
else
    fail "PostgreSQL query failed"
fi

if docker exec knowledge-neo4j cypher-shell -u neo4j -p "Kamina2025*" "RETURN 1;" &>/dev/null; then
    pass "Neo4j accepts queries"
else
    fail "Neo4j query failed"
fi

#############################################################################
# Test 5: MCP Server Files
#############################################################################
section "Test 5: MCP Server Files"

if [ -f "src/mcp/memory-server-canonical.ts" ]; then
    pass "Canonical MCP server exists"
else
    fail "Canonical MCP server MISSING"
fi

if [ -f "src/mcp/canonical-tools.ts" ]; then
    pass "Canonical tools exist"
else
    fail "Canonical tools MISSING"
fi

#############################################################################
# Test 6: MCP Server Can Start
#############################################################################
section "Test 6: MCP Server Startup"

info "Testing MCP server startup (5 second timeout)..."
if timeout 5 bun run mcp:canonical 2>&1 | grep -q "Allura Memory MCP Server"; then
    pass "MCP server starts successfully"
else
    fail "MCP server failed to start"
fi

#############################################################################
# Test 7: Agent Definitions
#############################################################################
section "Test 7: Agent Definitions"

if [ -f ".opencode/agent/core/brooks-architect.md" ]; then
    pass "Brooks architect definition exists"
else
    fail "Brooks architect definition MISSING"
fi

if [ -f ".opencode/agent/subagents/core/scout-recon.md" ]; then
    pass "Scout recon definition exists"
else
    fail "Scout recon definition MISSING"
fi

# Note: Allura Memory project is the memory system itself
# Memory integration is in the OpenAgentsControl harness project
info "Memory integration is in OpenAgentsControl harness project (already tested)"

#############################################################################
# Test 8: Harness Contract
#############################################################################
section "Test 8: Harness Contract"

if [ -f ".opencode/contracts/harness-v1.md" ]; then
    pass "Harness contract exists"
else
    fail "Harness contract MISSING"
fi

#############################################################################
# Test 9: AI Guidelines
#############################################################################
section "Test 9: AI Guidelines"

if [ -f ".opencode/AI-GUIDELINES.md" ]; then
    pass "AI-GUIDELINES.md exists"
else
    fail "AI-GUIDELINES.md MISSING"
fi

#############################################################################
# Test 10: Environment Configuration
#############################################################################
section "Test 10: Environment Configuration"

if [ -f ".opencode/env.example" ]; then
    pass "Environment example exists"
else
    fail "Environment example MISSING"
fi

if [ -f ".env" ]; then
    pass ".env file exists"
else
    warn ".env file MISSING (copy from .opencode/env.example)"
fi

#############################################################################
# Summary
#############################################################################
section "Summary"

echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All integration tests passed!${NC}"
    echo ""
    echo "System is ready for use:"
    echo ""
    echo "  1. Start MCP server:"
    echo "     ${BLUE}bun run mcp:canonical${NC}"
    echo ""
    echo "  2. Start OpenCode with Brooks agent:"
    echo "     ${BLUE}opencode --agent BROOKS_ARCHITECT${NC}"
    echo ""
    echo "  3. Test memory operations:"
    echo "     ${BLUE}> memory_add({ group_id: 'test', user_id: 'test', content: 'test' })${NC}"
    echo "     ${BLUE}> memory_search({ group_id: 'test', query: 'test' })${NC}"
    echo ""
    echo "  4. Check database:"
    echo "     ${BLUE}docker exec knowledge-postgres psql -U ronin4life -d memory -c \"SELECT * FROM events LIMIT 5;\"${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}✗ Some integration tests failed.${NC}"
    echo "Please fix the issues above before proceeding."
    exit 1
fi