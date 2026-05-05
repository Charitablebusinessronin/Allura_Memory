#!/bin/bash
# Allura Dashboard Launcher
cd "/home/ronin704/Projects/allura memory" || exit 1
export ALLURA_DASHBOARD_PORT=3100
echo "🖥️ Starting Allura Dashboard on port $ALLURA_DASHBOARD_PORT"
echo "📍 URL: http://localhost:$ALLURA_DASHBOARD_PORT/dashboard"
echo ""
bun run dev