# Development Readiness Checklist

Use this before asking Brooks, Woz, Ralph, or Team RAM to start development.

## Five Green Lights

1. Brain is running.
   - Check: `bun run brain:status`
2. MCP is reachable.
   - Check: `curl http://localhost:5888/health`
3. Scout context is loaded.
   - Read: `.opencode/context/index.md`
4. Skills are chosen.
   - Required for memory work: `allura-memory-skill`
   - Required for Docker/MCP work: `mcp-docker`
5. Validation is named before build.
   - Minimum namespace check: `bun test src/lib/validation/group-id.test.ts`
   - Memory search filter check: `bun test src/lib/graph-adapter/neo4j-adapter.test.ts`

## Simple Rule

If any green light is missing, stop and fix the runway before writing feature code.
