#!/bin/bash
# OpenClaw Gateway Launcher
cd "/home/ronin704/Projects/allura memory" || exit 1
export ALLURA_MCP_HTTP_PORT="${ALLURA_MCP_HTTP_PORT:-${OPENCLAW_PORT:-3201}}"
echo "🦾 Starting canonical MCP HTTP gateway on port $ALLURA_MCP_HTTP_PORT"
echo "📡 Health: http://localhost:$ALLURA_MCP_HTTP_PORT/health"
echo "🔧 Tools: http://localhost:$ALLURA_MCP_HTTP_PORT/tools"
echo ""
bun run mcp:http
