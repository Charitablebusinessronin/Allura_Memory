# Allura Memory → ChatGPT Custom GPT Integration Plan

> **Status: DEFERRED** — OpenCode already ships Codex; ChatGPT custom GPT adds no incremental value. Revisit if a non-OpenCode runtime requires this path.
> **Deferred:** 2026-04-12

> **Research Date:** 2026-04-12  
> **Architect:** Brooks (Frederick P. Brooks Jr. persona)  
> **Status:** Research Phase → Planning Phase

---

## Executive Summary

**The Goal:** Enable ChatGPT custom GPTs to query Allura Memory (PostgreSQL + Neo4j dual-store) via Actions, allowing natural language access to your knowledge graph.

**The Challenge:** ChatGPT Actions require a public REST API with OpenAPI schema. Allura Memory currently exposes MCP (Model Context Protocol) via STDIO and HTTP gateway, but not in the format GPT Actions expect.

**The Solution:** Create an HTTP bridge layer that translates between GPT Actions (REST/OpenAPI) and Allura Memory's canonical interface.

---

## Architecture Analysis

### Current Allura Memory Interface

From `src/mcp/canonical-tools.ts` and `src/mcp/canonical-http-gateway.ts`:

| Operation | Purpose | Data Store |
|-----------|---------|------------|
| `memory_add` | Add memory with auto-scoring + promotion | PostgreSQL → Neo4j |
| `memory_search` | Federated search across both stores | PostgreSQL + Neo4j |
| `memory_get` | Retrieve single memory by ID | Both |
| `memory_list` | List all memories for user | Both |
| `memory_delete` | Soft-delete memory | Both |

**Current HTTP Gateway:** `canonical-http-gateway.ts` runs on port 3201 (configurable via `ALLURA_MCP_HTTP_PORT`).

### GPT Actions Requirements

Per OpenAI documentation:

1. **Public HTTPS endpoint** - Must be accessible from OpenAI's servers
2. **OpenAPI 3.0 schema** - JSON or YAML specification
3. **Authentication** - API Key (Basic/Bearer/Custom) or OAuth
4. **CORS enabled** - For browser-based testing

---

## Integration Options

### Option 1: Extend Existing HTTP Gateway (Recommended)

**Approach:** Modify `canonical-http-gateway.ts` to expose REST endpoints compatible with GPT Actions.

**Pros:**
- Minimal new code
- Reuses existing connection pooling
- Maintains single source of truth

**Cons:**
- Requires public exposure (security considerations)
- Need to add OpenAPI schema endpoint

**Implementation:**
```typescript
// Add to canonical-http-gateway.ts

// 1. REST endpoints for GPT Actions
GET  /api/v1/memory/search?q={query}&group_id={id}
POST /api/v1/memory/search        // Body: { query, group_id, user_id }
POST /api/v1/memory/add           // Body: { group_id, user_id, content, metadata }
GET  /api/v1/memory/:id           // Get by ID
GET  /api/v1/memory/list          // List for user
DELETE /api/v1/memory/:id         // Soft delete

// 2. OpenAPI schema endpoint
GET  /openapi.json                // Full OpenAPI 3.0 spec
```

---

### Option 2: Separate GPT Bridge Service

**Approach:** Create a new lightweight service (`src/gpt-bridge/`) that translates GPT Actions → Allura Memory.

**Pros:**
- Clean separation of concerns
- Can deploy independently
- Easier to secure (separate auth layer)

**Cons:**
- More infrastructure
- Another service to maintain

**Implementation:**
```
src/gpt-bridge/
├── server.ts          // Express/Fastify HTTP server
├── openapi.yaml       // OpenAPI 3.0 specification
├── auth.ts            // API key validation
├── routes/
│   ├── search.ts      // /search endpoint
│   ├── add.ts         // /add endpoint
│   └── ...
└── client/
    └── memory-client.ts  // Calls canonical-http-gateway
```

---

### Option 3: MCP-to-HTTP Gateway (External Tool)

**Approach:** Use existing MCP gateway tools like `mcp-bridge-server` or `mcp-gateway`.

**Research Findings:**
- `mako10k/mcp-bridge-server`: HTTP gateway for MCP servers
- `acehoss/mcp-gateway`: Bridges STDIO to HTTP+SSE
- Kong AI Gateway: Enterprise option with auth/rate limiting

**Pros:**
- Off-the-shelf solution
- Built-in auth, rate limiting, observability

**Cons:**
- Additional dependency
- May not map perfectly to GPT Actions format
- Learning curve

---

## Recommended Architecture (Option 1 + Security Layer)

```
┌─────────────────────────────────────────────────────────────────┐
│                        ChatGPT Custom GPT                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Actions Configuration                                   │   │
│  │  - OpenAPI Schema: https://api.allura.dev/openapi.json  │   │
│  │  - Auth: API Key (Bearer token)                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                    Allura GPT Bridge (New)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Express/Fastify Server                                  │   │
│  │  - CORS enabled                                          │   │
│  │  - Bearer token auth                                     │   │
│  │  - Rate limiting                                         │   │
│  │  - Request validation (Zod)                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  OpenAPI 3.0 Schema Generator                            │   │
│  │  GET /openapi.json                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  REST Routes → Canonical Tool Calls                       │   │
│  │  POST /api/v1/search → memory_search()                   │   │
│  │  POST /api/v1/add    → memory_add()                      │   │
│  │  GET  /api/v1/:id    → memory_get()                      │   │
│  │  ...                                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ localhost:3201
┌─────────────────────────────────────────────────────────────────┐
│              Existing Allura Memory HTTP Gateway                 │
│                    (canonical-http-gateway.ts)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│      PostgreSQL         │      │        Neo4j            │
│   (Episodic Memory)     │      │   (Semantic Memory)     │
└─────────────────────────┘      └─────────────────────────┘
```

---

## OpenAPI Schema Design

```yaml
openapi: 3.0.0
info:
  title: Allura Memory API
  version: 1.0.0
  description: Query your Allura Memory knowledge graph from ChatGPT

servers:
  - url: https://api.allura.dev/v1
    description: Production

security:
  - bearerAuth: []

paths:
  /search:
    post:
      operationId: searchMemories
      summary: Search memories across PostgreSQL and Neo4j
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [query, group_id]
              properties:
                query:
                  type: string
                  description: Natural language search query
                group_id:
                  type: string
                  pattern: '^allura-[a-z0-9-]+$'
                  description: Tenant namespace
                user_id:
                  type: string
                limit:
                  type: number
                  default: 10
      responses:
        200:
          description: Search results
          content:
            application/json:
              schema:
                type: object
                properties:
                  results:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        content:
                          type: string
                        score:
                          type: number
                        source:
                          type: string
                          enum: [postgres, neo4j]

  /add:
    post:
      operationId: addMemory
      summary: Add a new memory
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [group_id, user_id, content]
              properties:
                group_id:
                  type: string
                  pattern: '^allura-[a-z0-9-]+$'
                user_id:
                  type: string
                content:
                  type: string
                metadata:
                  type: object
                  properties:
                    source:
                      type: string
                      enum: [conversation, manual]
                    agent_id:
                      type: string
      responses:
        201:
          description: Memory created

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## Security Considerations

### Authentication Options

| Option | Use Case | Implementation |
|--------|----------|----------------|
| **API Key (Bearer)** | Server-to-server | `Authorization: Bearer <token>` |
| **API Key (Custom)** | Legacy compatibility | `X-Allura-Key: <token>` |
| **OAuth 2.0** | User-specific access | Full OAuth flow |

**Recommendation:** Start with Bearer token (simplest for GPT Actions).

### Token Management

```typescript
// src/gpt-bridge/auth.ts
import { createHash, timingSafeEqual } from 'crypto';

const VALID_TOKENS = new Set([
  process.env.GPT_BRIDGE_API_KEY,
  // Add more keys for rotation
].filter(Boolean));

export function validateToken(authHeader: string): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  
  // Constant-time comparison to prevent timing attacks
  for (const valid of VALID_TOKENS) {
    if (timingSafeEqual(
      Buffer.from(token),
      Buffer.from(valid || '')
    )) return true;
  }
  return false;
}
```

### Rate Limiting

```typescript
// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 60; // 60 requests per minute
  
  const current = rateLimits.get(apiKey);
  if (!current || now > current.resetAt) {
    rateLimits.set(apiKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (current.count >= maxRequests) return false;
  current.count++;
  return true;
}
```

---

## Deployment Options

### Option A: Local Tunnel (Development)

Use `ngrok` or `cloudflared` to expose local HTTP gateway:

```bash
# Terminal 1: Start Allura HTTP gateway
bun run src/mcp/canonical-http-gateway.ts

# Terminal 2: Create tunnel
ngrok http 3201
# or
cloudflared tunnel --url http://localhost:3201
```

**GPT Actions URL:** `https://abc123.ngrok.io`

### Option B: VPS/Cloud Deployment

Deploy to:
- **Railway** (easiest, free tier available)
- **Fly.io** (good for Docker)
- **Render** (simple HTTP services)
- **AWS/GCP/Azure** (enterprise)

### Option C: Docker Compose (Self-Hosted)

Add to existing `docker-compose.yml`:

```yaml
services:
  gpt-bridge:
    build:
      context: .
      dockerfile: Dockerfile.gpt-bridge
    ports:
      - "3000:3000"
    environment:
      - ALLURA_MCP_HTTP_URL=http://canonical-gateway:3201
      - GPT_BRIDGE_API_KEY=${GPT_BRIDGE_API_KEY}
      - NODE_ENV=production
    depends_on:
      - canonical-gateway
```

---

## Implementation Plan

### Phase 1: MVP (1-2 days)

1. **Create GPT Bridge service** (`src/gpt-bridge/`)
   - Express server with CORS
   - Bearer token auth
   - `/search` endpoint only
   - OpenAPI schema endpoint

2. **Test locally with ngrok**
   - Configure GPT Actions
   - Test search functionality

3. **Document setup process**

### Phase 2: Full API (2-3 days)

1. Add remaining endpoints (`/add`, `/get`, `/list`, `/delete`)
2. Add rate limiting
3. Add request validation (Zod)
4. Add error handling

### Phase 3: Production (1 week)

1. Deploy to cloud provider
2. Add monitoring/logging
3. Add API key rotation
4. Security audit
5. Documentation

---

## GPT Instructions Template

When creating the custom GPT, use these instructions:

```markdown
You are Allura Memory, an AI assistant with access to a persistent knowledge graph.

## Capabilities
- Search memories across PostgreSQL (episodic) and Neo4j (semantic) stores
- Add new memories to the knowledge graph
- Retrieve specific memories by ID

## When to Use Actions
- When the user asks about past conversations or stored knowledge
- When the user wants to save important information
- When the user asks "remember when..." or "what do we know about..."

## Action Usage
1. Always include `group_id` (format: allura-*)
2. Include `user_id` when available
3. For searches, use natural language queries

## Response Format
Present search results in a clear, organized manner:
- Highlight the most relevant memories
- Indicate the source (episodic vs semantic)
- Show confidence scores when available
```

---

## Next Steps

**Immediate (Today):**
1. Choose deployment option (recommend: ngrok for testing)
2. Create `src/gpt-bridge/` directory structure
3. Implement `/search` endpoint MVP

**This Week:**
1. Test end-to-end with ChatGPT
2. Add remaining endpoints
3. Deploy to staging

**Next Week:**
1. Production deployment
2. Documentation
3. Team onboarding

---

## Brooksian Reflection

**Conceptual Integrity:** The bridge pattern preserves Allura's canonical 5-operation interface while adapting to GPT Actions' REST requirements. No changes to core memory system.

**Essential vs Accidental Complexity:**
- **Essential:** HTTP translation layer, authentication, OpenAPI schema
- **Accidental:** Deployment infrastructure, monitoring (deferrable)

**Surgical Team:**
- Brooks (Architecture) → This plan
- Hephaestus (Implementation) → Build the bridge
- Atlas (Integration) → Deploy and test

**No Silver Bullet:** This doesn't make AI memory "smarter" — it just makes it accessible. The hard problem (knowledge graph design) is already solved in Allura.

---

*Document created by Brooks persona following Allura Memory architecture principles.*
