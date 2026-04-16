# Docker Compose File Guide

This repo contains multiple docker-compose files. Here is their status:

| File | Status | Purpose |
|------|--------|---------|
| `docker-compose.yml` (root) | ✅ **PRIMARY** | Local development & production. Use this. |
| `docker-compose.enterprise.yml` | 🔧 Overlay | Enterprise/multi-tenant add-on. Use with `--file` flag on top of primary. |
| `docker/docker-compose.yml` | ⚠️ DEPRECATED | Legacy sandbox. Do not use for new work. |
| `archive/sovereign-memory-mvp/docker-compose.yml` | 📦 Archived | Historical MVP reference only. |

## Quickstart

```bash
# Full stack (recommended)
docker compose up

# Enterprise overlay
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `web` | 3100 | Allura Next.js web app |
| `mcp` | — | MCP memory server |
| `postgres` | 5432 | Primary relational DB |
| `neo4j` | 7474 / 7687 | Graph memory layer |
| `ruvector` | 5433 | Vector DB (RuVector) |
| `dozzle` | 8088 | Log viewer UI |
