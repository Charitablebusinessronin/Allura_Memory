#!/bin/sh
# Allura Brain MCP entrypoint
# Strips dotenvx banner lines (◇ ...) from stdout to ensure clean JSON-RPC
exec bun run src/mcp/memory-server-canonical.ts 2>/dev/null | sed '/^◇/d'