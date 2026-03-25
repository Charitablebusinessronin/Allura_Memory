# Mission Control + OpenClaw + Ronin Memory Integration

> [!NOTE]
> **AI-Assisted Planning**
> This plan was drafted with AI assistance. Review before execution.

---

## Overview

Deploy Mission Control (OpenClaw orchestration dashboard) and integrate it with Ronin Memory's ADAS system, enabling automated research agents with human governance.

**Part Two of Ronin Memory:** Moving from governance framework to functional Meta Agent Search environment.

---

## Current State

### ✅ Part One Complete
- Notion Integration: Curator promotes insights to Master Knowledge Base
- OpenClaw Adapter: 8 tools ready (memory_search, memory_store, etc.)
- ADAS Code: Search loop, evaluation harness, promotion workflows exist
- Database: PostgreSQL + Neo4j + Notion all connected

### ❌ Part Two Gaps
- Mission Control not deployed
- OpenClaw Gateway not running (no MCP server)
- ADAS Sandbox not built
- No research agent defined

---

## Work Items

### Phase 1: Deploy Mission Control

**W1.1: Clone and Configure Mission Control**

| Field | Value |
|-------|-------|
| **File** | External repo |
| **What** | Clone abhi1693/openclaw-mission-control, configure .env |
| **Steps** | 1. `git clone https://github.com/abhi1693/openclaw-mission-control.git` <br> 2. `cp .env.example .env` <br> 3. Set LOCAL_AUTH_TOKEN (50+ chars) <br> 4. Set BASE_URL=http://localhost:8000 |
| **QA** | `docker compose ps` shows all services healthy |

**W1.2: Start Mission Control Services**

| Field | Value |
|-------|-------|
| **File** | compose.yml |
| **What** | Start backend (Python) + frontend (Next.js) |
| **Command** | `docker compose -f compose.yml up -d --build` |
| **Verify** | http://localhost:3000 (UI) <br> http://localhost:8000/healthz (API) |
| **QA** | Both endpoints return 200 OK |

**W1.3: Create Organization and Board**

| Field | Value |
|-------|-------|
| **File** | Mission Control UI |
| **What** | Initial setup in dashboard |
| **Steps** | 1. Login with LOCAL_AUTH_TOKEN <br> 2. Create organization "Ronin Memory" <br> 3. Create board "Research Queue" <br> 4. Create board "ADAS Discoveries" |
| **QA** | Boards visible in Mission Control UI |

**Phase 1 Acceptance Criteria:**
- [ ] Mission Control UI accessible at localhost:3000
- [ ] Backend API responding at localhost:8000
- [ ] Organization and boards created
- [ ] Can create manual task in UI

---

### Phase 2: Build OpenClaw Gateway

**W2.1: Create MCP Server Wrapper**

| Field | Value |
|-------|-------|
| **File** | `src/mcp/openclaw-gateway.ts` (NEW) |
| **What** | Expose Ronin Memory tools via MCP protocol |
| **Template** | See templates/mcp-server.ts |

**Implementation:**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openclawTools } from "../integrations/openclaw/adapter.js";

const server = new Server({
  name: "ronin-memory-gateway",
  version: "1.0.0",
}, {
  tools: {
    // Existing 8 tools
    memory_search: { /* schema */ },
    memory_store: { /* schema */ },
    // ... (see full implementation)
    
    // ADAS-specific tools
    adas_run_search: {
      description: "Run ADAS meta-agent search",
      inputSchema: { /* domain, objective */ },
    },
    adas_get_proposals: {
      description: "List pending design proposals",
      inputSchema: {},
    },
    adas_approve_design: {
      description: "Approve or reject a design",
      inputSchema: { /* designId, decision, rationale */ },
    },
  },
});

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "memory_search":
      return openclawTools.memory_search(args);
    case "adas_run_search":
      return runAdasSearch(args);
    // ... etc
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**W2.2: Implement ADAS Tool Handlers**

| Field | Value |
|-------|-------|
| **File** | `src/mcp/adas-handlers.ts` (NEW) |
| **What** | Bridge ADAS code to MCP responses |

**Functions to implement:**
```typescript
export async function runAdasSearch(args: {
  domain: string;
  objective?: string;
  maxIterations?: number;
}): Promise<ToolResponse> {
  const searchLoop = createMetaAgentSearch({
    domain,
    objective,
    maxIterations: maxIterations || 10,
  });
  
  const result = await searchLoop.run();
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        bestDesign: result.bestDesign,
        metrics: result.metrics,
        iterations: result.iterations,
        proposalsCreated: result.proposals.length,
      }),
    }],
  };
}

export async function getProposals(): Promise<ToolResponse> {
  const proposals = await getPendingProposalsFromNeo4j();
  return {
    content: [{
      type: "text",
      text: JSON.stringify(proposals),
    }],
  };
}

export async function approveDesign(args: {
  designId: string;
  decision: "approve" | "reject";
  rationale: string;
  approvedBy: string;
}): Promise<ToolResponse> {
  await updateDesignStatus(args.designId, args.decision, args.rationale);
  await syncToNotionIfApproved(args);
  
  return {
    content: [{
      type: "text",
      text: `Design ${args.designId} ${args.decision}d`,
    }],
  };
}
```

**W2.3: Add Gateway to docker-compose.yml**

| Field | Value |
|-------|-------|
| **File** | `docker-compose.yml` (edit) |
| **What** | Add OpenClaw Gateway service |

```yaml
services:
  openclaw-gateway:
    build:
      context: .
      dockerfile: docker/openclaw-gateway/Dockerfile
    image: openclaw-gateway:latest
    environment:
      - NOTION_API_KEY=${NOTION_API_KEY}
      - NOTION_INSIGHTS_DB_ID=${NOTION_INSIGHTS_DB_ID}
      - NEO4J_URI=${NEO4J_URI}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    networks:
      - knowledge-network
    depends_on:
      - knowledge-postgres
      - knowledge-neo4j
    ports:
      - "3001:3001"
```

**W2.4: Create Gateway Dockerfile**

| Field | Value |
|-------|-------|
| **File** | `docker/openclaw-gateway/Dockerfile` (NEW) |

```dockerfile
FROM oven/bun:1.1.45-slim

WORKDIR /app

# Copy source
COPY src/mcp/openclaw-gateway.ts ./
COPY src/mcp/adas-handlers.ts ./
COPY src/integrations/openclaw/ ./integrations/openclaw/
COPY src/lib/ ./lib/

# Install deps
COPY package.json bun.lockb ./
RUN bun install

# Expose MCP over SSE
EXPOSE 3001

CMD ["bun", "run", "openclaw-gateway.ts"]
```

**Phase 2 Acceptance Criteria:**
- [ ] MCP server starts without errors
- [ ] Can call `memory_search` via MCP
- [ ] Can call `adas_run_search` via MCP
- [ ] Gateway container healthy in docker-compose

---

### Phase 3: Build ADAS Sandbox

**W3.1: Build Sandbox Image**

| Field | Value |
|-------|-------|
| **File** | `docker/adas-sandbox/Dockerfile` (exists) |
| **What** | Build hardened execution environment |
| **Command** | `docker build -t adas-sandbox:latest docker/adas-sandbox/` |
| **Verify** | `docker images | grep adas-sandbox` |

**W3.2: Integrate with Search Loop**

| Field | Value |
|-------|-------|
| **File** | `src/lib/adas/sandbox.ts` (edit) |
| **What** | Replace mock execution with real Docker calls |

**Changes needed:**
```typescript
// Current (mock):
if (!this.dockerAvailable) {
  return this.mockExecute(code);
}

// Target:
const result = await this.executeInSandbox({
  code,
  timeoutMs: 12000,
  memoryLimit: '256m',
  cpuLimit: '0.5',
});

// Execute in real sandbox
docker run --rm \
  --network none \
  --memory 256m \
  --cpus 0.5 \
  --pids-limit 64 \
  --read-only \
  adas-sandbox:latest \
  node -e "${code}"
```

**W3.3: Test Sandbox Security**

| Field | Value |
|-------|-------|
| **File** | CLI test |
| **What** | Verify sandbox isolation |
| **Test** | Run code that tries to: <br> 1. Access network (should fail) <br> 2. Write to filesystem (should fail) <br> 3. Fork bomb (should be limited by pids-limit) <br> 4. Run infinite loop (should timeout) |
| **QA** | All attempts blocked/limited |

**Phase 3 Acceptance Criteria:**
- [ ] Sandbox image built
- [ ] ADAS search loop uses real sandbox
- [ ] Malicious code contained (tested)
- [ ] Valid code executes and returns results

---

### Phase 4: Create Research Agent

**W4.1: Define Agent Configuration**

| Field | Value |
|-------|-------|
| **File** | `agents/ronin-researcher.yaml` (NEW) |

```yaml
name: "ronin-researcher"
description: |
  Automated research agent for Ronin Memory.
  Discovers patterns in PostgreSQL traces, identifies high-confidence insights,
  and promotes them to Notion for human approval.

schedule:
  cron: "0 */6 * * *"  # Every 6 hours
  timezone: "UTC"
  # Alternative: "every weekday at 9am UTC"
  # Alternative: "0 */4 * * *" (every 4 hours)

tools:
  # Ronin Memory tools
  - memory_search
  - memory_store
  - memory_promote
  - agent_search
  
  # ADAS tools
  - adas_run_search
  - adas_get_proposals
  - adas_approve_design
  
  # External tools
  - web_search  # Would need implementation

identity: |
  You are Ronin Researcher, an autonomous agent for the Ronin Memory system.
  
  Your responsibilities:
  1. SCAN: Query PostgreSQL traces for recent activity patterns
  2. ANALYZE: Run ADAS meta-agent search to identify high-value insights
  3. PROMOTE: Submit discoveries to Notion for human review
  4. MONITOR: Track approval status and report metrics
  
  When you discover a pattern:
  - Calculate confidence score (must be >= 0.7 to promote)
  - Generate canonical tag for categorization
  - Create summary and supporting evidence
  - Submit to Notion with "Pending Review" status
  
  You never modify approved insights directly.
  You always wait for human approval before activating.
  
  Report your findings clearly with:
  - What you discovered
  - Confidence level
  - Evidence from traces
  - Recommended action

model:
  primary: "qwen3:8b"  # Or other Ollama model
  fallback: "gpt-4o-mini"  # Cloud fallback

budget:
  maxTokensPerRun: 100000
  maxCostUsd: 5.00
  timeoutMinutes: 30
```

**W4.2: Register Agent with Mission Control**

| Field | Value |
|-------|-------|
| **File** | Mission Control UI or API |
| **What** | Add agent to orchestration platform |
| **Steps** | 1. Login to Mission Control <br> 2. Navigate to Agent Management <br> 3. Create agent from YAML <br> 4. Assign to "Research Queue" board <br> 5. Test manual trigger |

**W4.3: Configure Agent Schedule**

| Field | Value |
|-------|-------|
| **File** | Mission Control UI |
| **What** | Set up automated execution |
| **Config** | - Cron: `0 */6 * * *` <br> - Board: Research Queue <br> - Auto-promote: false (requires approval) <br> - Alert on failure: true |

**Phase 4 Acceptance Criteria:**
- [ ] Agent YAML valid and loaded
- [ ] Agent appears in Mission Control
- [ ] Manual trigger executes successfully
- [ ] Scheduled run triggers automatically
- [ ] Results appear in Notion queue

---

### Phase 5: Integration Testing

**W5.1: End-to-End Test**

| Field | Value |
|-------|-------|
| **What** | Full integration test |
| **Scenario** | 1. Mission Control triggers agent <br> 2. Agent queries PostgreSQL <br> 3. Agent runs ADAS search <br> 4. Agent promotes to Notion <br> 5. Human approves in Notion <br> 6. Curator syncs to Neo4j <br> 7. Agent reports completion |
| **Expected** | All steps complete without error |

**W5.2: Failure Mode Testing**

| Field | Value |
|-------|-------|
| **What** | Test error handling |
| **Scenarios** | - ADAS search times out <br> - Sandbox execution fails <br> - Notion API unavailable <br> - Database connection lost |
| **Expected** | Graceful degradation, logged errors, retry logic |

**Phase 5 Acceptance Criteria:**
- [ ] End-to-end test passes
- [ ] All failure modes handled gracefully
- [ ] Metrics visible in Mission Control
- [ ] Audit trail complete in PostgreSQL

---

## Final Acceptance Criteria

| # | Criteria | Verification |
|---|----------|--------------|
| **AC1** | Mission Control deployed and accessible | http://localhost:3000 loads |
| **AC2** | OpenClaw Gateway running | MCP tools callable via API |
| **AC3** | ADAS Sandbox built and secure | `docker images` shows image, security tests pass |
| **AC4** | Research agent created | Agent visible in Mission Control |
| **AC5** | Agent runs on schedule | Last run timestamp updates automatically |
| **AC6** | Results promoted to Notion | Insights appear in Master Knowledge Base |
| **AC7** | Human approval workflow works | Approving in Notion activates insight in Neo4j |
| **AC8** | Full audit trail | Every action logged to PostgreSQL |

---

## Estimated Timeline

| Phase | Hours | Cumulative |
|-------|-------|------------|
| 1: Deploy Mission Control | 2-3 | 2-3 |
| 2: Build Gateway | 4-6 | 6-9 |
| 3: Build Sandbox | 2-4 | 8-13 |
| 4: Create Research Agent | 2-3 | 10-16 |
| 5: Integration Testing | 2-3 | 12-19 |
| **Total** | **12-19 hours** | |

---

## References

- Mission Control Repo: https://github.com/abhi1693/openclaw-mission-control
- OpenClaw Adapter: `src/integrations/openclaw/adapter.ts`
- ADAS Code: `src/lib/adas/`
- Sandbox: `docker/adas-sandbox/Dockerfile`
- Notion Integration: `src/curator/`

---

## Commit Strategy

```bash
# Phase 1
git add docker-compose.yml
git commit -m "feat(deploy): add Mission Control to docker-compose"

# Phase 2
git add src/mcp/
git commit -m "feat(mcp): create OpenClaw Gateway with ADAS tools"

# Phase 3
git add docker/adas-sandbox/
git commit -m "feat(sandbox): integrate real sandbox execution"

# Phase 4
git add agents/
git commit -m "feat(agent): create ronin-researcher agent"

# Phase 5
git add tests/
git commit -m "test(integration): add end-to-end tests"
```

---

## Next Step

Run `/start-work` to begin Phase 1 (Mission Control deployment).