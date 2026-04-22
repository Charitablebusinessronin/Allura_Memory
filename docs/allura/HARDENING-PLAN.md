# Allura Brain — 6-Month Hardening Plan

> "The tar pit of eternal integration." — Brooks (Frederick, not ours)

This plan covers the 5 things we'll regret in 6 months if we don't do them now, plus the orchestration enhancements that make the team smarter than OmO.

---

## Phase 0: Schema-Level Enforcement (Ship Now)
> Prompts are suggestions. Policy is policy.

### 0.1 PostgreSQL group_id CHECK constraint
```sql
ALTER TABLE allura_memories
ADD CONSTRAINT chk_group_id_format
CHECK (group_id ~ '^allura-[a-z0-9-]+$');
```
- Makes it impossible to write `allura-roninmemory` or any invalid group_id
- Existing rows in `allura-system` pass; bad rows are rejected at INSERT

### 0.2 Neo4j creation trigger
- Add a pre-commit hook or APOC trigger that rejects Memory node creation without a valid `group_id` matching `^allura-`
- Prevents direct Cypher writes from bypassing the governance layer

### 0.3 Canonical MCP enforcement
- Add `validateGroupId()` call in `canonical-tools.ts` BEFORE every write operation
- Already partially exists — harden it to block (not just warn) on invalid group_id

**Done when:** No agent, script, or manual insert can write to an invalid group_id. The schema rejects it.

---

## Phase 1: Memory-First Orchestration (Ship This Week)
> The brain is the first step, not an afterthought.

### 1.1 Brooks boot sequence — memory_search first
Current boot:
1. Search PG for events
2. Search Neo4j for insights
3. Greet

New boot:
1. `memory_search({ query: "active tasks and blockers", group_id: "allura-system" })`
2. `memory_search({ query: "recent architecture decisions", group_id: "allura-system" })`
3. `memory_search({ query: "agent outcomes and patterns", group_id: "allura-system" })`
4. Synthesize context
5. Greet with evidence

### 1.2 Specialist dispatch — inject memory context
When Brooks dispatches a specialist, include relevant memories in the prompt:
```
You are [agent]. Context from prior work on this project:
[memory_search results for relevant topic]
Your task: [specific assignment]
After completing: call memory_add with your agent_id, what you did, and what you found.
```

### 1.3 Post-task memory write — mandatory
Every specialist must call `memory_add` after completing with:
- `user_id`: their agent persona (e.g., `woz-builder`)
- `content`: what they did, what they found, what to watch out for
- `metadata.source`: "conversation"
- `metadata.agent_id`: their agent persona

**Done when:** No specialist dispatch happens without memory injection. No specialist completes without memory write.

---

## Phase 2: MCP Docker Skill Consolidation (Ship This Week)
> Two containers doing one job is accidental complexity.

### 2.1 Create allura-brain MCP Docker skill
- Package `canonical-tools.ts` + `connection.ts` + `validation-utils.ts` + `budget-circuit.ts` as an MCP skill
- Expose the 8 governed operations (memory_add, search, get, list, delete, update, promote, export) as MCP tools
- Run inside the Docker MCP gateway alongside neo4j-memory, cypher, database
- One image, one gateway, one connection path

### 2.2 Update Dockerfile.mcp
- COPY the allura-brain skill into the image
- Ensure pg, neo4j-driver, dotenv dependencies are present
- Add launch entry for the skill

### 2.3 Update docker-compose.yml
- Remove the standalone `mcp` service (allura-memory-mcp)
- The Docker MCP gateway now serves all skills including allura-brain
- Reduce container count: 2 data stores + 1 MCP gateway + 1 web

### 2.4 Update all harness configs
- `.claude/settings.json`: remove `allura-brain` docker exec, use MCP_DOCKER
- `.opencode/mcp-client-config.json`: point at MCP_DOCKER
- `~/.openclaw/openclaw.json`: already using MCP_DOCKER (reference)

**Done when:** Zero standalone MCP containers. All memory operations route through one gateway.

---

## Phase 3: pgvector Upgrade + HNSW Restoration (Ship This Week)
> Brute force search on 238 rows is fine. On 10,000 rows it's not.

### 3.1 Upgrade pgvector to 0.8.4+
- Current: pgvector 0.8.2 (2000d HNSW limit)
- Need: pgvector 0.8.4+ (supports 4096d HNSW)
- Update Docker image tag in docker-compose.yml

### 3.2 Re-create HNSW index
```sql
CREATE INDEX hnsw_allura_memories_embedding
ON allura_memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 3.3 Validate search performance
- Run memory_search benchmarks before and after
- Target: <100ms for similarity search on 1000+ rows

**Done when:** HNSW index active, search is fast, embedding dimension is 4096d.

---

## Phase 4: Agent Reputation System (Ship Next Week)
> "Woz ships 3x faster on migrations" — but only if we track it.

### 4.1 Schema: agent_outcomes table
```sql
CREATE TABLE agent_outcomes (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_type TEXT NOT NULL,      -- build, refactor, debug, review, plan
  outcome TEXT NOT NULL,        -- success, partial, failure, blocked
  group_id TEXT NOT NULL,
  context TEXT,                 -- what was the task
  lesson TEXT,                  -- what was learned
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Auto-log on specialist completion
After every specialist dispatch, log the outcome:
- Which agent
- What type of task
- Did it succeed
- What was the lesson

### 4.3 Reputation query at dispatch time
When Brooks routes a task, query agent_outcomes:
```sql
SELECT agent_id, count(*) as tasks,
       count(*) FILTER (WHERE outcome = 'success') as wins
FROM agent_outcomes
WHERE task_type = 'refactor'
GROUP BY agent_id
ORDER BY wins DESC;
```
Route to the agent with the best track record for that task type.

### 4.4 Neo4j reputation relationships
- (:Agent)-[:EXCELLENT_AT {score: 0.9}]->(:TaskType {name: 'migrations'})
- (:Agent)-[:STRUGGLES_WITH {score: 0.3}]->(:TaskType {name: 'edge_cases'})
- Updated on every task completion

**Done when:** Brooks routes based on evidence, not just role definitions.

---

## Phase 5: Orchestration Enhancements (Ship Weeks 2-4)
> Faster team → wiser team.

### 5.1 Parallel Agent Dispatch
- Wire Brooks to fire specialists as parallel subagents via OpenCode's background agent support
- Each specialist gets memory-injected context (from Phase 1)
- Results collected and synthesized

### 5.2 ultrawork Command
- Slash command `/ulw` that triggers full-team activation
- Brooks: "All hands. Task is [X]. Specialists, activate. Don't stop until done."
- Fires all relevant specialists in parallel

### 5.3 IntentGate
- Pre-classification step in Brooks' prompt
- Before routing, classify intent: build | debug | refactor | plan | search | memory
- Search brain for prior related work
- Route to the right specialist set with evidence

### 5.4 Ralph Loop
- Post-task verification: "Is it actually done?"
- Check against stored definition of done
- Re-dispatch if verification fails
- Self-referential: keeps looping until completion criteria met

### 5.5 Todo Enforcer
- Session-level heartbeat that checks: "Is the task still active? Is the agent idle?"
- If idle with incomplete work, re-engage the specialist
- Prevents agents from going dark mid-task

**Done when:** Brooks can fire 5 specialists in parallel, verify completion, and re-engage on failure.

---

## Phase 6: Cross-Session Learning (Ship Months 2-3)
> The real differentiator. OmO can't do this.

### 6.1 Auto-promote recurring patterns
- If a raw trace recurs across 3+ sessions, propose promotion automatically
- "This pattern keeps showing up. Promote to canonical insight?"

### 6.2 "Last time we did this" surfacing
- When a new task arrives, automatically search for similar past tasks
- Surface: "Last time we refactored auth, Torvalds caught a boundary violation on line 47"
- Inject this context into specialist dispatch prompts

### 6.3 Living Architecture Decision Records
- Every ARCHITECTURE_DECISION event auto-creates a Neo4j :Memory node
- Relationships to agents, projects, and superseded decisions
- Searchable by future Brooks: "What did we decide about X?"

### 6.4 Cross-project pattern extraction
- Identify patterns that apply beyond one project
- Promote from `allura-system` to a global namespace
- Reusable engineering standards, not project-specific trivia

**Done when:** The brain automatically surfaces relevant past context without being asked.

---

## Timeline

| Phase | What | When | Effort |
|-------|------|------|--------|
| 0 | Schema enforcement | Today | 1 hour |
| 1 | Memory-first orchestration | This week | 2-3 hours |
| 2 | MCP Docker consolidation | This week | 4-6 hours |
| 3 | pgvector upgrade + HNSW | This week | 1-2 hours |
| 4 | Agent reputation | Next week | 3-4 hours |
| 5 | Orchestration (ulw, parallel, loop) | Weeks 2-4 | 6-8 hours |
| 6 | Cross-session learning | Months 2-3 | 8-12 hours |

## Success Metrics

- Zero invalid group_id writes ever again (Phase 0)
- Every specialist dispatch includes memory context (Phase 1)
- One container serves all MCP operations (Phase 2)
- HNSW search < 100ms at 1000+ rows (Phase 3)
- Brooks routes by evidence, not assumption (Phase 4)
- Team works in parallel, not sequentially (Phase 5)
- Brain surfaces relevant past context automatically (Phase 6)

---

*"Good judgment comes from experience. Experience comes from bad judgment."*
*But only if you remember the bad judgment.*