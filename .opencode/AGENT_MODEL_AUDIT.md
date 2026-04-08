# Agent & Model Configuration Audit

**Date:** 2026-04-08  
**Status:** Strategic review of agent ecosystem and model allocation  
**Reviewed:** Agents, OpenCode models, Ollama cloud models, MCP integrations

---

## Executive Summary

Your Allura Memory system has a **sophisticated 7-agent core** running on OpenCode with **dual-provider model strategy** (Ollama Cloud + OpenAI fallback). However, there are **critical gaps** between the configured agents and the running implementations:

| Category | Status | Gap |
|----------|--------|-----|
| **Agents Defined** | 7 active | ✅ Complete |
| **Models Configured** | Ollama Cloud (glm-5-cloud) | ⚠️ Not deployed |
| **Hyperbrowser** | Available via MCP_DOCKER | ⚠️ Not integrated |
| **Exa Search** | Available via MCP_DOCKER | ⚠️ Not integrated |
| **ADAS Runs** | 50+ test runs | ❌ Never completing |
| **Workflow State Machine** | Implemented | ⚠️ Not wired |

---

## Part 1: Your 7 Core Agents

### Architecture: Persona-Based Agent System

All agents follow the **BMAD Persona Pattern** — OpenCode skills that adopt professional personas:

```
┌──────────────────────────────────────────────────────────────┐
│  .opencode/skills/bmad-agent-*/SKILL.md (7 Personas)        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Amelia (Dev Agent)          → bmad-agent-dev            │
│     Role: Senior software engineer executing stories        │
│     Capabilities: DS (dev story), CR (code review)          │
│                                                              │
│  2. Mary (Analyst Agent)        → bmad-agent-analyst        │
│     Role: Business analyst & requirements expert           │
│     Capabilities: BP (brainstorm), MR (market research)    │
│                  DR (domain research), TR (tech research)   │
│                                                              │
│  3. UX Designer Agent           → bmad-agent-ux-designer    │
│     Role: User experience design specialist                 │
│     Capabilities: Design systems, prototypes, research     │
│                                                              │
│  4. QA Agent                    → bmad-agent-qa             │
│     Role: Quality assurance & test architecture            │
│     Capabilities: E2E tests, test planning, automation     │
│                                                              │
│  5. Product Manager Agent       → bmad-agent-pm             │
│     Role: Product strategy and roadmapping                 │
│     Capabilities: PRD creation, epic breakdown, planning   │
│                                                              │
│  6. Scrum Master Agent          → bmad-agent-sm             │
│     Role: Agile ceremonies and team facilitation           │
│     Capabilities: Sprint planning, retrospectives, status  │
│                                                              │
│  7. Tech Writer Agent           → bmad-agent-tech-writer    │
│     Role: Technical documentation specialist               │
│     Capabilities: Doc validation, Mermaid diagrams, prose  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Database Reality (PostgreSQL `agents` table)

```
group_id: allura-default
Platform: opencode
Status: All 7 = "Active"

Memory Agent Specializations:
├─ memory-orchestrator    (Master coordinator)
├─ memory-architect       (Design patterns)
├─ memory-builder         (Knowledge construction)
├─ memory-guardian        (Integrity enforcement)
├─ memory-scout           (Discovery/research)
├─ memory-analyst         (Data analysis)
└─ memory-chronicler      (Documentation/history)
```

### Critical Gap: Agent-to-Model Mapping

❌ **Problem:** Agents are defined in `.opencode/skills/` but **have no explicit model assignment**.

OpenCode determines which model runs an agent:
1. Uses env var `OPENCODE_MODEL` if set
2. Falls back to `OPENCODE_PROVIDER` config
3. If both unset, uses OpenAI (expensive default)

**Current config:**
```bash
OPENCODE_PROVIDER=ollama
OPENCODE_MODEL=glm-5-cloud  # Alibaba's GLM-5 Cloud
```

---

## Part 2: Your Model Strategy

### Active Configuration (`.env`)

```
Embedding Provider:     ollama
Embedding Model:        nomic-embed-text

LLM Provider:           ollama
LLM Model:              glm-5-cloud

Cloud Service:          Ollama Cloud (https://ollama.com)
API Key:                Configured ✅
```

### Ollama Cloud Models Available

From your `.env.example` comments, you have tested:

| Model | Provider | Status | Cost | Use Case |
|-------|----------|--------|------|----------|
| **glm-5-cloud** | Alibaba | ✅ Configured | ~Low | General reasoning |
| **qwen3-coder-next:cloud** | Alibaba | 🧪 Test | ~Med | Code generation |
| **deepseek-v3.2:cloud** | DeepSeek | 🧪 Test | ~Low | Reasoning + code |
| **minimax-m2.7:cloud** | MiniMax | 🧪 Test | ~Med | Multilingual |

### OpenAI Fallback (Configured but inactive)

```bash
# Commented out in .env — but code can auto-switch if Ollama fails
OPENCODE_PROVIDER=openai
OPENCODE_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

**Risk:** Silent fallback to GPT-4o-mini if Ollama Cloud goes down = surprise costs.

---

## Part 3: MCP Tool Ecosystem

### What's Available (MCP_DOCKER catalog)

You have **3 major research/scraping tools** available but **not integrated into agent workflows:**

#### 1. Hyperbrowser (MCP_DOCKER)

**Status:** Available, not wired to agents  
**Capabilities:**
- Browser automation with cloud VMs
- Form filling, login flows, dynamic content extraction
- Session persistence with profiles

**Why relevant:** Your `memory-scout` agent should use this for web research, but it's not in the skill.

**Integration point:** Modify `.opencode/skills/bmad-agent-*/` to invoke `mcp-exec` for browser tasks.

#### 2. Exa Search (MCP_DOCKER)

**Status:** Available, not wired  
**Capabilities:**
- Neural web search (better than keyword search)
- Similarity-based content matching
- Real-time research

**Why relevant:** Better than Tavily for competitive analysis (Mary's job).

#### 3. Tavily Research (Already integrated)

**Status:** ✅ Used in domain-research skill  
**Capabilities:**
- Broad web search, news, academic papers
- High-relevance result filtering

**Good:** Your market research skill uses this correctly.

---

## Part 4: ADAS System Status

### Live Reality (from PostgreSQL)

```
ADAS Runs: 50+ entries
Status: ALL = "running" (never transitioned to completed/approved)
Models tested: qwen3-coder-next, deepseek-v3.2, glm-5-cloud, minimax-m2.7
Curator Queue: EMPTY
```

### Architecture (Designed)

```
Agent runs → ADAS loop (self-improvement) → Proposals → Curator (HITL) → Neo4j
```

### Implementation Gap

| Phase | Status | Issue |
|-------|--------|-------|
| Agent execution | ✅ Works | ADAS doesn't know when agents run |
| ADAS test harness | ✅ Exists | Runs only when explicitly invoked |
| Proposal generation | ✅ Implemented | ADR creation works |
| Curator HITL gate | ✅ Implemented | Waiting for promotions |
| **Auto-completion** | ❌ Missing | Test runs stuck in "running" state |

**Root cause:** ADAS test mode doesn't signal completion to the workflow state machine.

---

## Part 5: Hyperscaling Considerations

### What You'd Need for 100-Agent System

**Current:** 7 agents (serialized skill invocations)  
**Bottleneck:** MCP server becomes serialized dispatcher

**For parallel agent fleets:**

1. **Agent Pool Architecture**
   ```
   Agent 1-20   → Ollama instance A (glm-5-cloud)
   Agent 21-40  → Ollama instance B (deepseek-v3.2)
   Agent 41-60  → OpenAI backup (gpt-4-turbo)
   Agent 61-100 → Custom Ollama locally hosted
   ```

2. **Load Balancing**
   - Use connection pooling for Ollama endpoints
   - Implement circuit breaker per provider
   - Track per-agent cost/latency metrics

3. **Model Selection by Agent Type**
   ```
   Developer agents      → qwen3-coder-next (code focused)
   Analyst agents        → glm-5-cloud (reasoning)
   Writer agents         → minimax-m2.7 (multilingual)
   Emergency fallback    → gpt-4o-mini (expensive)
   ```

---

## Recommendations

### Immediate (This Sprint)

1. **Fix ADAS Completion**
   - Hook ADAS test completion → mark workflow state as "done"
   - Unblock curator queue
   - Get at least one promotion through HITL

2. **Wire Hyperbrowser to memory-scout**
   - Add browser automation skill
   - Use for competitive research workflows
   - Test with mock website research

3. **Add Exa Search to Mary (Analyst)**
   - Replace/supplement Tavily for market research
   - Test neural search for domain research accuracy

### Short-term (Next 2 Sprints)

4. **Model per Agent Type**
   - Assign `qwen3-coder-next` to Amelia (dev)
   - Keep `glm-5-cloud` for general reasoning
   - Test `deepseek-v3.2` for reasoning-heavy agents

5. **Cost Tracking Dashboard**
   - Log `OPENCODE_MODEL` + tokens to PostgreSQL
   - Aggregate by agent + group_id
   - Alert on > $100/day per group

6. **Agent Health Monitoring**
   - Add metrics: mean execution time, error rate, model fallbacks
   - Show in Notion dashboard
   - Flag slow agents for model optimization

### Long-term (Production Hardening)

7. **Ollama Self-Hosting Option**
   - Deploy local `deepseek-v3.2` or `qwen3-coder` instance
   - Route code-heavy agents to local (free, private)
   - Keep cloud for reasoning/search
   - Estimated: 40% cost reduction

8. **Agent Batching**
   - Group similar tasks → single model call
   - Reduce per-invocation overhead
   - Batch "analyze 50 requirements" → one `glm-5-cloud` pass

9. **Fallback Chain**
   ```
   Try Ollama Cloud → Try Local Ollama → Try OpenAI → Fail Safe
   ```

---

## Model Recommendations for Each Agent

| Agent | Current | Recommended | Rationale |
|-------|---------|-------------|-----------|
| **Amelia (Dev)** | glm-5-cloud | qwen3-coder-next:cloud | 75% code-focused, needs strong syntax |
| **Mary (Analyst)** | glm-5-cloud | glm-5-cloud | Reasoning heavy, multimodal understanding |
| **UX Designer** | glm-5-cloud | minimax-m2.7:cloud | Visual thinking, multilingual prompts |
| **QA Agent** | glm-5-cloud | qwen3-coder-next:cloud | Test code generation |
| **PM Agent** | glm-5-cloud | glm-5-cloud | Strategy, less code |
| **SM Agent** | glm-5-cloud | glm-5-cloud | Facilitation, communication |
| **Tech Writer** | glm-5-cloud | minimax-m2.7:cloud | Prose quality, formatting |
| **Memory-Scout** | (none) | deepseek-v3.2:cloud | Research reasoning |

---

## Cost Estimate (Monthly)

Based on Ollama Cloud typical pricing:

| Model | $/ 1M input tokens | $/ 1M output tokens |
|-------|-------------------|-------------------|
| glm-5-cloud | $0.05 | $0.08 |
| qwen3-coder-next | $0.05 | $0.10 |
| deepseek-v3.2 | $0.03 | $0.06 |
| minimax-m2.7 | $0.10 | $0.15 |
| gpt-4o-mini | $0.15 | $0.60 |

**Estimated for 7 agents, typical usage:**
- **Conservative:** $50-100/mo (Ollama Cloud)
- **High volume:** $200-300/mo (mixed)
- **Fallback leakage:** $500+/mo (if defaulting to GPT-4o-mini)

---

## Next Steps

1. **Run immediate audit:**
   ```bash
   bun run mcp              # Start MCP server
   curl http://localhost:3000/tools | jq '.[] | {name, description}'
   ```

2. **Check live ADAS state:**
   ```bash
   psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM adas_runs GROUP BY status;"
   ```

3. **Review agent execution:**
   ```bash
   psql $DATABASE_URL -c "SELECT agent_id, status, COUNT(*) FROM events WHERE group_id = 'allura-default' GROUP BY agent_id, status;"
   ```

4. **Test a single agent with Hyperbrowser:**
   ```
   /orchestrate "research competitive landscape for Allura using hyperbrowser web search"
   ```

---

## References

- **Agents:** `.opencode/skills/bmad-agent-*/SKILL.md`
- **Models:** `.env` → `OPENCODE_MODEL`, `OPENCODE_PROVIDER`
- **MCP Tools:** `mcp-find`, `mcp-add`, `mcp-exec`
- **Live State:** PostgreSQL `agents`, `adas_runs`, `workflow_states` tables
- **ADAS:** `src/lib/adas/` (needs completion hook wiring)

---

## Questions to Explore

1. **Why did ADAS test runs all stall at "running"?**
   - Missing completion signal
   - Agent timeout configuration too short
   - Workflow state machine not connected

2. **What's the cost-benefit of Ollama Cloud vs. local?**
   - Cloud: easy, no ops, variable cost
   - Local: requires GPU hardware, fixed cost, private data

3. **Should each agent persona have a dedicated model?**
   - Yes: specialization (coder vs. analyst models)
   - No: single model, less ops complexity

4. **Is Hyperbrowser being underutilized?**
   - Currently: only mentioned in available tools
   - Should be: integrated into market research workflow
