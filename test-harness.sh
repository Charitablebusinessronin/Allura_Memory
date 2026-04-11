#!/usr/bin/env bash

#############################################################################
# Allura Memory System - Smoke Test Script
# Validates that the memory system is operational
#############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

section() {
    echo ""
    echo "========================================="
    echo "$1"
    echo "========================================="
}

#############################################################################
# Test 1: Database Containers Running
#############################################################################
section "Test 1: Database Containers"

if docker ps | grep -q "knowledge-postgres"; then
    pass "PostgreSQL container running"
else
    fail "PostgreSQL container NOT running"
fi

if docker ps | grep -q "knowledge-neo4j"; then
    pass "Neo4j container running"
else
    fail "Neo4j container NOT running"
fi

#############################################################################
# Test 2: PostgreSQL Connectivity
#############################################################################
section "Test 2: PostgreSQL Connectivity"

if docker exec knowledge-postgres psql -U ronin4life -d memory -c "SELECT 1;" &>/dev/null; then
    pass "PostgreSQL accepts connections"
else
    fail "PostgreSQL connection failed"
fi

if docker exec knowledge-postgres psql -U ronin4life -d memory -c "SELECT COUNT(*) FROM events;" &>/dev/null; then
    pass "Events table exists"
else
    fail "Events table missing"
fi

#############################################################################
# Test 3: Neo4j Connectivity
#############################################################################
section "Test 3: Neo4j Connectivity"

if docker exec knowledge-neo4j cypher-shell -u neo4j -p "Kamina2025*" "RETURN 1;" &>/dev/null; then
    pass "Neo4j accepts connections"
else
    fail "Neo4j connection failed"
fi

#############################################################################
# Test 4: MCP Server Files
#############################################################################
section "Test 4: MCP Server Files"

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
# Test 5: Agent Definitions
#############################################################################
section "Test 5: Agent Definitions"

if [ -f ".opencode/agent/core/brooks-architect.md" ]; then
    pass "Brooks architect agent exists"
else
    fail "Brooks architect agent MISSING"
fi

if [ -f ".opencode/agent/subagents/core/scout-recon.md" ]; then
    pass "Scout recon agent exists"
else
    fail "Scout recon agent MISSING"
fi

#############################################################################
# Test 6: OpenCode CLI
#############################################################################
section "Test 6: OpenCode CLI"

if command -v opencode &>/dev/null; then
    pass "OpenCode CLI is available"
    OPENCODE_VERSION=$(opencode --version 2>&1 || echo "unknown")
    echo "  Version: $OPENCODE_VERSION"
else
    fail "OpenCode CLI NOT available"
fi

#############################################################################
# Test 7: Harness Contract
#############################################################################
section "Test 7: Harness Contract"

if [ -f ".opencode/contracts/harness-v1.md" ]; then
    pass "Harness contract exists"
else
    fail "Harness contract MISSING"
fi

#############################################################################
# Test 8: AI Guidelines
#############################################################################
section "Test 8: AI Guidelines"

if [ -f ".opencode/AI-GUIDELINES.md" ]; then
    pass "AI-GUIDELINES.md exists"
else
    fail "AI-GUIDELINES.md MISSING"
fi

#############################################################################
# Test 9: Environment Configuration
#############################################################################
section "Test 9: Environment Configuration"

if [ -f ".opencode/env.example" ]; then
    pass "Environment example exists"
else
    fail "Environment example MISSING"
fi

#############################################################################
# Test 10: Package Configuration
#############################################################################
section "Test 10: Package Configuration"

if [ -f ".opencode/package.json" ]; then
    pass "Package.json exists"
else
    fail "Package.json MISSING"
fi

#############################################################################
# Summary
#############################################################################
section "Summary"

echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start MCP server: bun run mcp:canonical"
    echo "  2. Test memory tools: opencode"
    echo "  3. Run memory_add({ group_id: 'test', user_id: 'test', content: 'test' })"
    exit 0
else
    echo ""
    echo -e "${RED}✗ Some smoke tests failed.${NC}"
    echo "Please fix the issues above before proceeding."
    exit 1
fi