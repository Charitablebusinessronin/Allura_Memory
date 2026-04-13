# Changelog

All notable changes to `@allura/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-13

### Added

- Initial release of `@allura/sdk`
- Dual-transport client: MCP Streamable HTTP and legacy JSON-RPC
- Type-safe API surface with Zod validation
- ESM + CJS dual output via tsup
- Full TypeScript type definitions (`.d.ts` + `.d.cts`)
- Connection lifecycle management (connect, disconnect, reconnect)
- Memory tools: `memory_retrieve`, `memory_write`, `memory_propose_insight`
- Knowledge graph queries via Neo4j Cypher
- PostgreSQL trace queries
- Health check and diagnostics endpoints

[0.1.0]: https://github.com/roninmemory/allura-memory/releases/tag/v0.1.0