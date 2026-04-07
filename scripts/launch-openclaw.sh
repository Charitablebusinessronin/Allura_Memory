#!/bin/bash
# OpenClaw Gateway Launcher
cd "/home/ronin704/Projects/allura memory" || exit 1
export PORT=3200
echo "🦾 Starting OpenClaw Gateway on port $PORT"
echo "📡 Health: http://localhost:$PORT/health"
echo "🔧 Tools: http://localhost:$PORT/tools"
echo ""
bun run mcp:http