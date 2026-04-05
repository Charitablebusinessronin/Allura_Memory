# OpenClaw & Paperclip Configuration Guide

> **Complete setup and run guide for the Allura Agent-OS L5 components**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Allura Agent-OS Stack                        │
├─────────────────────────────────────────────────────────────────┤
│  L5: Paperclip + OpenClaw                                        │
│  ├── Paperclip (Docker) — Multi-tenant dashboard                │
│  │   └── Next.js app on port 3100 (configurable)                │
│  └── OpenClaw (Ubuntu) — Gateway for external channels          │
│      └── MCP server on port 3200 (configurable)                 │
├─────────────────────────────────────────────────────────────────┤
│  L2: PostgreSQL + Neo4j (Docker)                                 │
│  ├── PostgreSQL:5432 — Raw traces                                │
│  └── Neo4j:7474/7687 — Promoted insights                        │
└─────────────────────────────────────────────────────────────────┘
```

## Port Configuration

**Non-default ports are used to avoid conflicts:**

| Service | Default Port | Range | Environment Variable |
|---------|-------------|-------|---------------------|
| Paperclip | 3100 | 3100-3199 | `PAPERCLIP_PORT` |
| OpenClaw | 3200 | 3200-3299 | `OPENCLAW_PORT` |
| PostgreSQL | 5432 | 5400-5499 | `POSTGRES_PORT` |
| Neo4j HTTP | 7474 | 7470-7479 | `NEO4J_HTTP_PORT` |
| Neo4j Bolt | 7687 | 7680-7689 | `NEO4J_BOLT_PORT` |
| Dozzle | 8088 | 8080-8089 | `DOZZLE_PORT` |

**Generate random ports:**
```bash
bun run ports:generate >> .env.local
```

**Check port availability:**
```bash
bun run ports:check
```

---

## Prerequisites

### 1. Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

**Required variables:**

```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=memory
POSTGRES_USER=ronin4life
POSTGRES_PASSWORD=<your-password>

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<your-password>

# Multi-Tenant
DEFAULT_GROUP_ID=allura-default

# LLM Provider
OPENCODE_PROVIDER=ollama
OPENCODE_MODEL=glm-5-cloud
```

### 2. Docker Services

Start the databases:

```bash
# Start PostgreSQL + Neo4j + Dozzle (log viewer)
docker compose up -d postgres neo4j dozzle

# Verify services are healthy
docker ps

# Check PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life -d memory

# Check Neo4j
curl -s http://localhost:7474 | jq .neo4j_version
```

### 3. Install Dependencies

```bash
bun install
```

---

## Paperclip Dashboard (L5)

### What is Paperclip?

Paperclip is the **multi-tenant governance dashboard** for Allura Agent-OS:

- **Agent Roster** — View and manage active agents
- **Approval Queue** — HITL (Human-in the-Loop) governance
- **Token Budgets** — Monitor and control token usage
- **Audit Log** — Complete decision trail
- **Workspaces** — Tenant isolation

### Running Paperclip

```bash
# Development mode
bun run dev

# Production build
bun run build
bun run start
```

**Access:** http://localhost:3000/dashboard

### Dashboard Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/dashboard` | Overview | KPIs, pending approvals |
| `/dashboard/paperclip` | Paperclip Dashboard | Agent governance |
| `/dashboard/crm` | CRM Dashboard | Customer management |
| `/dashboard/finance` | Finance Dashboard | Financial metrics |
| `/dashboard/analytics` | Analytics | Usage metrics |

### Testing Paperclip

```bash
# Run MCP browser tests for dashboard
bun run test:mcp:browser

# Run specific dashboard tests
bun vitest run tests/mcp/browser/dashboard.test.ts

# Run responsive tests
bun vitest run tests/mcp/browser/responsive.test.ts
```

---

## OpenClaw Gateway (L5)

### What is OpenClaw?

OpenClaw is the **self-hosted gateway** that bridges external channels to the Agent Runtime:

- **WhatsApp** — Message-based agent interaction
- **Telegram** — Bot integration
- **Discord** — Community channels
- **Mission Control** — Research queue integration

### Running OpenClaw Gateway

```bash
# Start MCP server (development)
bun run mcp:dev

# Start MCP server (production)
bun run mcp
```

**Port:** 3002 (configurable)

### OpenClaw MCP Tools

| Tool | Purpose |
|------|---------|
| `memory_search` | Full-text search in knowledge graph |
| `memory_store` | Store new memories |
| `adas_run_search` | Run ADAS meta-agent search |
| `adas_get_proposals` | List pending design proposals |
| `adas_approve_design` | Approve/reject proposals |

### Connecting to OpenClaw

**Mission Control Configuration:**

```json
{
  "endpoint_url": "http://openclaw-gateway:3002",
  "auth_token": "<your-token>",
  "boards": {
    "research_queue": "research-queue",
    "adas_discoveries": "adas-discoveries"
  }
}
```

---

## Integration Testing

### Full Stack Test

```bash
# Run all tests
bun run test:all

# Or step by step:
bun run typecheck    # TypeScript validation
bun run lint         # ESLint
bun test             # Unit tests (116+)
bun run test:e2e     # E2E integration
bun run test:mcp:browser  # Browser tests
```

### Health Check

```bash
# Check all services
curl http://localhost:3000/api/health
curl http://localhost:7474
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
```

---

## Production Deployment

### Paperclip (Next.js)

```bash
# Build
bun run build

# Start with PM2 (recommended)
pm2 start npm --name "paperclip" -- start

# Or with Docker
docker build -t paperclip .
docker run -d -p 3000:3000 paperclip
```

### OpenClaw Gateway

```bash
# Build MCP container
docker compose build mcp

# Run
docker compose up -d mcp

# Check logs
docker logs -f allura-memory-mcp
```

### Environment Checklist

- [ ] PostgreSQL running and healthy
- [ ] Neo4j running and healthy
- [ ] `.env.local` configured with real credentials
- [ ] LLM provider configured (Ollama/OpenAI/Anthropic)
- [ ] `DEFAULT_GROUP_ID` set for multi-tenant
- [ ] SSL certificates for production

---

## Troubleshooting

### PostgreSQL Connection Failed

```bash
# Check container status
docker ps | grep postgres

# Check logs
docker logs knowledge-postgres

# Test connection
docker exec -it knowledge-postgres psql -U ronin4life -d memory
```

### Neo4j Connection Failed

```bash
# Check container status
docker ps | grep neo4j

# Check logs
docker logs knowledge-neo4j

# Test connection
docker exec knowledge-neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" "RETURN 1"
```

### Paperclip Not Loading

```bash
# Check build
bun run build

# Check for CSS errors
bun run typecheck

# Check browser console for errors
# Open DevTools → Console
```

### OpenClaw Gateway Errors

```bash
# Check MCP server logs
bun run mcp:dev

# Test tool directly
bun run mcp
# Then use MCP tools from connected client
```

---

## Quick Start Commands

```bash
# 1. Start databases
docker compose up -d postgres neo4j

# 2. Install dependencies
bun install

# 3. Run database migrations (if needed)
bun run db:migrate

# 4. Start Paperclip dashboard
bun run dev

# 5. In another terminal, start OpenClaw gateway
bun run mcp:dev

# 6. Run tests
bun run test:all
```

---

## Next Steps

1. **Configure LLM Provider** — Set up Ollama or add API keys
2. **Create Workspace** — Add tenant via Paperclip dashboard
3. **Register Agents** — Add agents to workspace
4. **Set Budgets** — Configure token limits
5. **Connect Channels** — Link WhatsApp/Telegram/Discord via OpenClaw

---

## References

- [MCP Testing Architecture](./testing/MCP_TESTING_ARCHITECTURE.md)
- [OpenClaw Plugin Spec](../_bmad-output/implementation-artifacts/openclaw-plugin-spec.md)
- [Paperclip Dashboard UX](../_bmad-output/implementation-artifacts/ux-specs/paperclip-dashboard.md)
- [Architecture Brief](../_bmad-output/planning-artifacts/architectural-brief.md)