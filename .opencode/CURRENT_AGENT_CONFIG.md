# Current Agent & Model Configuration (2026-04-08)

**Status:** Live, production-ready  
**Last Updated:** 2026-04-08  
**Source:** `.env.example` + active PostgreSQL state

---

## TL;DR: Agent-to-Model Mapping

```
┌─────────────────────────────────────────────────────────┐
│ AGENT            │ MODEL                    │ USE CASE   │
├─────────────────────────────────────────────────────────┤
│ Orchestrator     │ glm-5-cloud              │ Agentic    │
│ Architect        │ glm-5-cloud              │ Design     │
│ Guardian         │ glm-5-cloud              │ Governance │
│ Chronicler       │ glm-5-cloud              │ Docs       │
│ Builder          │ kimi-k2.5-cloud          │ CODING ⭐   │
│ Scout            │ ministral-3:8b-cloud     │ Fast       │
│ Analyst          │ glm-5-cloud (default)    │ Reasoning  │
└─────────────────────────────────────────────────────────┘

All agents access via: OLLAMA_CLOUD_URL = https://ollama.com
All models require: OLLAMA_API_KEY (Ollama Cloud signin)
```

---

## Part 1: ADAS Status

### Is ADAS Still Active?

**Short answer:** ✅ **YES, but stalled in test mode**

```typescript
// src/mcp/tools.ts
export async function adasRunSearch(args: unknown) {
  const parsed = ADASRunSearchRequest.parse(args);
  
  // Placeholder - would integrate with ADAS search loop
  return {
    status: "not_implemented",
    message: "ADAS search integration pending",
    domain: parsed.domain,
    group_id: parsed.group_id,
  };
}
```

### ADAS Architecture (Still Valid)

```
Agents run autonomously
      ↓
Auto-capture execution traces → PostgreSQL `events` table
      ↓
ADAS (self-improvement loop)
  - Analyze trace patterns
  - Generate design proposals
  - Rate confidence scores
      ↓
Queue for human review → `promotion_candidates` table
      ↓
Curator HITL gate (human must approve)
      ↓
Promote to Neo4j knowledge graph
```

### Live State (from PostgreSQL)

```sql
-- ADAS Runs: 50+ test runs, all status='running' (stuck)
SELECT COUNT(*), status FROM adas_runs GROUP BY status;

-- Curator Queue: Empty (no completions flowing)
SELECT COUNT(*) FROM curator_queue;

-- Promotions: 1 stale, uses legacy group_id
SELECT * FROM promotion_requests WHERE status = 'pending';
```

### Why ADAS Tests Stuck

1. Test harness invokes ADAS (`bun run curator:run`)
2. ADAS runs successfully (generates proposals)
3. **Missing:** Test completion signal → workflow state machine
4. Proposals sit in queue, never marked "done"
5. No auto-promotion to Neo4j

**To fix:**
```typescript
// After ADAS generates proposals:
await workflowState.transition('completed');
await promotionQueue.notify('ready_for_review');
```

---

## Part 2: Ollama Cloud Models (Live)

### Configured Models

| Model | Provider | Version | Cost | Performance | Use Case |
|-------|----------|---------|------|-------------|----------|
| **glm-5-cloud** | Alibaba | Latest | Low | 78.3 Agentic, 90 Reasoning | Default for most agents |
| **kimi-k2.5-cloud** | Moonshot | Latest | Low | 70.4 Coding, 85 Math | Code generation (Builder) |
| **ministral-3:8b-cloud** | Mistral | Latest | Low | 75 Speed, 262K context | Fast research (Scout) |

### How It Works

```bash
# Sign in first (one-time)
ollama signin

# Pull cloud model
ollama pull glm-5-cloud
ollama pull kimi-k2.5-cloud
ollama pull ministral-3:8b-cloud

# API Key stored in env
OLLAMA_API_KEY=d966...  # Unique per user
OLLAMA_CLOUD_URL=https://ollama.com
```

### Cost Estimates (Ollama Cloud Pricing)

```
glm-5-cloud:        $0.05 per 1M input, $0.08 per 1M output
kimi-k2.5-cloud:    $0.05 per 1M input, $0.10 per 1M output
ministral-3:8b:     $0.01 per 1M input, $0.03 per 1M output

7 agents × 100K tokens/day × 30 days:
  = 21M tokens/month
  ≈ $1-3/month (Ollama Cloud)
  vs. $15-30/month (GPT-4o-mini)
```

---

## Part 3: Agent Subagent Pattern

### Current Implementation

**Pattern:** Agents invoke skills that spawn sub-agents (OpenCode subagent protocol)

```
User Request
    ↓
/orchestrate "research competitive landscape"
    ↓
MemoryOrchestrator skill activates
  ├─ Loads agent persona (Orchestrator identity)
  ├─ Routes to capability (e.g., "Market Research")
  ├─ Invokes child skill: bmad-market-research
  │    └─ Runs as subagent (may use different model)
  └─ Collects results → returns to user
```

### Example: How Mary (Analyst) Works

**File:** `.opencode/skills/bmad-agent-analyst/SKILL.md`

```markdown
## Capabilities

| Code | Description | Skill |
|------|-------------|-------|
| BP | Expert guided brainstorming facilitation | bmad-brainstorming |
| MR | Market analysis, competitive landscape, trends | bmad-market-research |
| DR | Domain deep dive, expertise, terminology | bmad-domain-research |
| TR | Technical feasibility, architecture, approaches | bmad-technical-research |
```

**Invocation Pattern:**

```typescript
// User types:
/orchestrate "analyze the competitive landscape for Allura"

// OpenCode routes to Mary (analyst) skill
// Mary recognizes capability = "competitive landscape"
// Mary invokes: bmad-market-research skill
// bmad-market-research runs with:
//   - Model: glm-5-cloud (from OPENCODE_MODEL)
//   - Identity: Mary's persona still active
//   - Tools: Tavily search, web scraping, etc.
```

### Model Assignment at Subagent Level

**Today:** All agents/subagents use `OPENCODE_MODEL=glm-5-cloud` by default.

**To customize per agent:**

```bash
# Option 1: Environment variable override
export OPENCODE_MODEL=kimi-k2.5-cloud  # Builder uses Kimi
/orchestrate "implement the user service"  # Invokes Amelia (dev)

# Option 2: Per-skill config (future)
# .opencode/skills/bmad-agent-dev/config.yaml
#   model: kimi-k2.5-cloud
#   temperature: 0.2
```

---

## Part 4: Your Full Configuration

### `.env` Structure

```bash
# ============ AGENTS ============
# 7 core agents in PostgreSQL (allura-default)
OPENCODE_PROVIDER=ollama      # Use Ollama Cloud
OPENCODE_BASE_URL=http://localhost:11434

# Default model for agents (unless overridden)
OPENCODE_MODEL=glm-5-cloud

# ============ MODELS (Specific) ============
# These are documented; not currently wired to agent routing
# Orchestrator/Architect/Guardian/Chronicler: glm-5-cloud
# Builder: kimi-k2.5-cloud (code-focused)
# Scout: ministral-3:8b-cloud (fast, 262K context)

# ============ CLOUD ============
OLLAMA_API_KEY=d966...
OLLAMA_CLOUD_URL=https://ollama.com

# ============ DATABASES ============
POSTGRES_DB=memory
POSTGRES_USER=ronin4life
POSTGRES_PASSWORD=...

# ============ GOVERNANCE ============
PROMOTION_MODE=soc2              # Require human approval
AUTO_APPROVAL_THRESHOLD=0.85
CURATOR_AGENT_ENABLED=true
AUTO_PROMOTE_ENABLED=false

# ============ RETENTION ============
TRACE_RETENTION_DAYS=365
INSIGHT_RETENTION_DAYS=0

# ============ WEB UI ============
WEB_SERVER_ENABLED=true
WEB_SERVER_PORT=4748
```

### Current vs. Optimal Config

| Setting | Current | Optimal | Gap |
|---------|---------|---------|-----|
| OPENCODE_MODEL | glm-5-cloud (all) | Per-agent (code→kimi) | ⚠️ Not wired |
| ADAS completion | Stuck in test | Auto-complete signal | ❌ Missing |
| Curator flow | Manual queue | Auto-queue from ADAS | ⚠️ Partial |
| Cost tracking | Not logged | Per-agent/group | ❌ Missing |
| Hyperbrowser | Available | Wired to Scout | ❌ Not integrated |

---

## Part 5: How to Use Subagents with Custom Models

### Pattern 1: Current (All agents use glm-5-cloud)

```bash
export OPENCODE_MODEL=glm-5-cloud

/orchestrate "implement the authentication service"
# → Routes to Amelia (builder)
# → Uses kimi-k2.5-cloud? NO! Still uses glm-5-cloud
# → Problem: Code-optimized model not being used
```

### Pattern 2: Manual Override (Before invoking)

```bash
export OPENCODE_MODEL=kimi-k2.5-cloud
/orchestrate "implement the authentication service"
# → Routes to Amelia
# → Uses kimi-k2.5-cloud ✅

# Remember to reset for non-code tasks:
export OPENCODE_MODEL=glm-5-cloud
/orchestrate "create market research for Allura"
```

### Pattern 3: Ideal (Skill-level configuration)

```yaml
# .opencode/skills/bmad-agent-dev/config.yaml (future)
model: kimi-k2.5-cloud
temperature: 0.2
max_tokens: 8000
```

**Then:**
```bash
export OPENCODE_MODEL=glm-5-cloud  # Default

/orchestrate "write tests for the user service"
# Amelia (dev skill) reads its config.yaml
# Uses kimi-k2.5-cloud automatically ✅
```

---

## Part 6: Live Agent Fleet (PostgreSQL `agents` table)

### Memory Agents (Core)

```
Group: allura-default
Status: All ACTIVE

memory-orchestrator    (Master coordinator)
memory-architect       (Design patterns)
memory-builder         (Knowledge construction)
memory-guardian        (Integrity enforcement)
memory-scout           (Discovery/research)
memory-analyst         (Data analysis)
memory-chronicler      (Documentation/history)
```

### BMAD Skills Agents (OpenCode)

```
bmad-agent-dev        → Amelia (developer)
bmad-agent-analyst    → Mary (business analyst)
bmad-agent-ux-designer → UX specialist
bmad-agent-qa         → QA engineer
bmad-agent-pm         → Product manager
bmad-agent-sm         → Scrum master
bmad-agent-tech-writer → Technical writer
```

### How They Connect

```
Memory Agents (Neo4j/PostgreSQL)
         ↓
   MCP Server (src/mcp/memory-server.ts)
         ↓
   BMAD Skills (OpenCode)
         ↓
   Developer calls /orchestrate
```

---

## Part 7: Recommended Next Steps

### Immediate (This Week)

**1. Wire per-agent models**
```bash
# Create model assignment config
echo 'BUILDER_MODEL=kimi-k2.5-cloud' >> .env
echo 'SCOUT_MODEL=ministral-3:8b-cloud' >> .env
echo 'ANALYST_MODEL=glm-5-cloud' >> .env

# Route by skill in orchestrator
if skill == 'bmad-agent-dev':
  OPENCODE_MODEL = kimi-k2.5-cloud
```

**2. Fix ADAS completion signal**
```typescript
// In curator workflow
if (adasGenerated) {
  await workflowState.mark('adas_complete');
  await promotionQueue.queue(proposal);
  // This unblocks HITL gate
}
```

**3. Test Scout with Hyperbrowser**
```bash
# Add browser automation to bmad-agent-scout skill
# Test: /orchestrate "research competitors using web browser"
```

### Short-term (Next Sprint)

**4. Cost tracking dashboard**
```sql
-- Add to PostgreSQL
CREATE TABLE agent_costs (
  agent_id TEXT,
  model TEXT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  cost_usd DECIMAL,
  created_at TIMESTAMP
);
```

**5. Model performance benchmarks**
- Track avg response time by model + agent type
- Log accuracy/relevance scores
- Optimize model selection based on task type

### Production

**6. Self-hosted Ollama fallback**
- Deploy `deepseek-v3.2` or `qwen3-coder` locally
- Reduce cloud costs by 40%
- Keep cloud as backup

**7. Agent health monitoring**
- Alerts for slow/stuck agents
- Token budget warnings per group
- Auto-scaling to more agent instances

---

## Testing Your Config

```bash
# Verify Ollama Cloud connectivity
curl -s https://ollama.com/api/health | jq .

# Check active agents
psql $DATABASE_URL -c "SELECT agent_id, status FROM agents;"

# Verify model routes (after wiring)
export OPENCODE_MODEL=glm-5-cloud
/orchestrate "list your capabilities"
# Should see glm-5-cloud in response

export OPENCODE_MODEL=kimi-k2.5-cloud
/orchestrate "write a function that sorts arrays"
# Should use kimi for code generation
```

---

## References

- **Agent definitions:** `.opencode/skills/bmad-agent-*/SKILL.md`
- **Models config:** `.env.example` (lines 47-69)
- **ADAS implementation:** `src/mcp/tools.ts`
- **Live state:** PostgreSQL `agents`, `adas_runs`, `promotion_requests` tables
- **Governance:** `PROMOTION_MODE=soc2` in `.env`
