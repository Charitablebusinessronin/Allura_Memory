# MCP Setup Log - 2026-03-24

## Summary
ronin-memory MCP server is containerized and works with MCP_DOCKER.

## Build Command
```bash
docker build -f Dockerfile.mcp -t ronin-memory-mcp:latest .
```

## MCP_DOCKER Usage
```bash
# Add the server
MCP_DOCKER_mcp-add ronin-memory-mcp

# Execute tools
MCP_DOCKER_mcp-exec ronin-memory-mcp search_memories '{"query": "auth"}'
```

## Why Custom vs Docker Hub
- Docker Hub MCP = pre-built common tools (GitHub, Notion, etc.)
- ronin-memory = custom server connecting to YOUR PostgreSQL/Neo4j
- Provides project-specific tools: search_memories, create_insight, promote_knowledge

## Dockerfile.mcp Structure
- Multi-stage build (builder + runner)
- Runs TypeScript with tsx
- Security: non-root user
- Health checks enabled
- Includes: src/lib/, src/integrations/, src/curator/

## Architecture
```
Agents (OhMyOpenCode, OpenClaw)
    ↓ MCP_DOCKER commands
ronin-memory-mcp (custom container)
    ↓ connects to
PostgreSQL + Neo4j + Notion
```
