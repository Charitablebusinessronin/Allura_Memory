#!/bin/bash
# Allura Dashboard Launcher
cd "/home/ronin704/Projects/allura memory" || exit 1
export PAPERCLIP_PORT=3100
echo "🖥️ Starting Allura Dashboard on port $PAPERCLIP_PORT"
echo "📍 URL: http://localhost:$PAPERCLIP_PORT/dashboard"
echo ""
bun run dev