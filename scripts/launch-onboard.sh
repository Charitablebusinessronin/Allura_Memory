#!/bin/bash
# Allura Onboard Launcher
cd "/home/ronin704/Projects/allura memory" || exit 1
echo "🦾 Running OpenClaw Onboarding..."
echo ""
bun run openclaw:onboard
echo ""
echo "Press Enter to close..."
read