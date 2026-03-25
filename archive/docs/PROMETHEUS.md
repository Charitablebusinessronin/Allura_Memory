# PROMETHEUS.md - Persistent Autonomous Docker Agents for Allura's Memory

## Executive Summary

**Goal**: Create a system for persistent autonomous ADAS agents that run as Docker containers, are tracked in Notion, execute on schedules, and can be monitored and managed.

**Scope**: This is a NEW system (separate from existing OpenCode agents and separate from ADAS sandbox). It provides persistent agent execution infrastructure.

**Why**: Existing agents (hephaestus, sisyphus, etc.) are ephemeral OpenCode agents. ADAS sandbox is for evaluation only. This system enables long-running, scheduled, autonomous agents with Notion-based governance.

---

## Confirmed Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Support multiple agent types: Knowledge Curator, ADAS Search Loop, Memory Promotion, Custom Tasks | P0 |
| FR2 | Agents run as Docker containers with restart policies | P0 |
| FR3 | Agent configuration via YAML/JSON config file | P0 |
| FR4 | Notion tracking for all agents (status, health, performance, approval) | P0 |
| FR5 | Config changes trigger automatic agent updates | P1 |
| FR6 | Heartbeat logging to PostgreSQL | P1 |
| FR7 | Automatic restart with exponential backoff on failures | P1 |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | Test-Driven Development (TDD) - tests written first |
| NFR2 | Follow existing project patterns (TypeScript strict, group_id isolation) |
| NFR3 | Docker containers use existing adas-sandbox image as base |
| NFR4 | Agent registry schema uses Neo4j with SUPERSEDES versioning |
| NFR5 | All agents must include group_id for tenant isolation |
| NFR6 | Human-in-the-loop approval for agent creation (like curator) |

---

## Current State Analysis

### Existing Systems

| System | Purpose | What It Does |
|--------|---------|--------------|
| OpenCode Agents | Development assistance | Ephemeral agents (hephaestus, sisyphus, etc.) |
| ADAS Sandbox | Agent evaluation | Docker-based isolated execution for untrusted code |
| Curator | Knowledge promotion | PostgreSQL → Neo4j → Notion pipeline |

### What We Need to Build

| Component | Purpose | Reuses From |
|-----------|---------|-------------|
| **Persistent Agent System** | Long-running autonomous agents | ADAS sandbox patterns, curator Notion integration |
| **Agent Registry** | Track agents in Neo4j | Existing Neo4j connection |
| **Notion Integration** | Agent lifecycle in Notion | Curator's Notion patterns |
| **Orchestrator Service** | Manage agent containers | Dockerode (same as ADAS) |
| **Heartbeat Monitor** | Health tracking | PostgreSQL logging |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Config File (agents.yaml)                                        │
│ - Agent definitions                                              │
│ - Schedules, resources, Notion sync                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Agent Orchestrator Service                                       │
│ - Reads config and manages containers                            │
│ - Implements restart policies                                    │
│ - Handles config hot-reloading                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Docker Containers (One per Agent)                                │
│ - Based on adas-sandbox image                                    │
│ - Isolated execution                                             │
│ - Health checks + heartbeats                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Neo4j Agent Registry                                             │
│ - Agent nodes with status, metrics                               │
│ - SUPERSEDES relationships for versions                          │
│ - group_id isolation                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Notion Agent Registry (Database)                                 │
│ - Human-readable agent list                                      │
│ - Approval workflow (like curator)                               │
│ - Health dashboard                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Work Items

### Epic: Persistent Autonomous Agent System

#### Story 1: Core Infrastructure

**1.1 Create Agent Configuration Schema**
- File: `src/agents/config/schema.ts`
- Define TypeScript types for agent config (AgentConfig, Schedule, Resources)
- Zod validation schema
- **Test First**: `src/agents/config/schema.test.ts`

**1.2 Config Loader with Hot-Reload**
- File: `src/agents/config/loader.ts`
- Load `config/agents.yaml`
- Watch for changes and trigger reload
- **Test First**: `src/agents/config/loader.test.ts`

**1.3 Neo4j Agent Registry Schema**
- File: `src/agents/registry/schema.ts`
- Cypher schema for:
  - `(:Agent {id, name, type, status, group_id})`
  - `(:AgentVersion)-[:SUPERSEDES]->(:AgentVersion)`
  - `(:AgentRun {timestamp, duration, success})`
- **Test First**: `src/agents/registry/schema.test.ts`

#### Story 2: Docker Orchestration

**2.1 Agent Container Manager**
- File: `src/agents/orchestrator/container.ts`
- Wrapper around dockerode for agent containers
- Methods: create(), start(), stop(), restart(), remove()
- Restart policies: unless-stopped, on-failure, always
- **Test First**: `src/agents/orchestrator/container.test.ts`

**2.2 Health Check Implementation**
- File: `src/agents/orchestrator/health.ts`
- Docker health checks (HTTP endpoint or process check)
- Mark containers unhealthy after N failures
- **Test First**: `src/agents/orchestrator/health.test.ts`

**2.3 Agent Runner Script**
- File: `docker/agent-runner/Dockerfile`
- Entrypoint script for containers
- Reads config from mounted volume
- Executes agent task
- Reports heartbeat to PostgreSQL
- **Test First**: E2E test in `src/__tests__/agent-runner.e2e.test.ts`

#### Story 3: Built-in Agent Types

**3.1 Knowledge Curator Agent**
- File: `src/agents/built-in/knowledge-curator.ts`
- Runs curator pipeline periodically
- Schedule: configurable (default: hourly)
- **Test First**: `src/agents/built-in/knowledge-curator.test.ts`

**3.2 Memory Promotion Agent**
- File: `src/agents/built-in/memory-promotion.ts`
- Promotes PostgreSQL traces to Neo4j insights
- Schedule: configurable (default: every 5 minutes)
- **Test First**: `src/agents/built-in/memory-promotion.test.ts`

**3.3 ADAS Search Agent**
- File: `src/agents/built-in/adas-search.ts`
- Runs meta agent search loop continuously
- Stops when converged or max iterations reached
- **Test First**: `src/agents/built-in/adas-search.test.ts`

**3.4 Custom Task Agent**
- File: `src/agents/built-in/custom-task.ts`
- Executes arbitrary commands or scripts
- Configurable command, working directory, env vars
- **Test First**: `src/agents/built-in/custom-task.test.ts`

#### Story 4: Heartbeat and Monitoring

**4.1 Heartbeat Logger**
- File: `src/agents/monitoring/heartbeat.ts`
- Log heartbeats to PostgreSQL (table: `agent_heartbeats`)
- Fields: agent_id, timestamp, status, metrics (JSON)
- **Test First**: `src/agents/monitoring/heartbeat.test.ts`

**4.2 Status Aggregator**
- File: `src/agents/monitoring/status.ts`
- Query heartbeats and calculate:
  - Last run time
  - Success rate (last 24h)
  - Average duration
  - Error count
- **Test First**: `src/agents/monitoring/status.test.ts`

**4.3 Alert System (Basic)**
- File: `src/agents/monitoring/alert.ts`
- Log alerts to PostgreSQL (not email/Slack yet)
- Thresholds: consecutive failures, timeout
- **Test First**: `src/agents/monitoring/alert.test.ts`

#### Story 5: Notion Integration

**5.1 Notion Agent Registry Database**
- File: `src/agents/notion/registry.ts`
- Create Notion database with properties:
  - Name (title)
  - Type (select: curator, memory-promotion, adas-search, custom)
  - Status (select: Pending, Running, Stopped, Error)
  - Last Run (date)
  - Next Run (date)
  - Success Rate (number)
  - AI Accessible (checkbox)
  - group_id (text)
- **Test First**: `src/agents/notion/registry.test.ts`

**5.2 Agent Page Creator**
- File: `src/agents/notion/creator.ts`
- Create Notion page when new agent defined in config
- Set Status: Pending Review, AI Accessible: false
- Wait for human approval
- **Test First**: `src/agents/notion/creator.test.ts`

**5.3 Sync Agent Status to Notion**
- File: `src/agents/notion/sync.ts`
- Periodically sync Neo4j agent status to Notion
- Update: Last Run, Success Rate, Error Count
- **Test First**: `src/agents/notion/sync.test.ts`

#### Story 6: Orchestrator Service

**6.1 Orchestrator Entry Point**
- File: `src/agents/orchestrator/index.ts`
- CLI: `npx tsx src/agents/orchestrator/index.ts start`
- Loads config, initializes registry, starts managing agents
- **Test First**: `src/agents/orchestrator/index.test.ts`

**6.2 Agent Lifecycle Manager**
- File: `src/agents/orchestrator/lifecycle.ts`
- Handles agent transitions:
  - Config Added → Create Container → Start → Running
  - Config Removed → Stop → Remove Container → Deleted
  - Config Changed → Stop → Recreate → Start → Running
- **Test First**: `src/agents/orchestrator/lifecycle.test.ts`

**6.3 Restart Policy Enforcer**
- File: `src/agents/orchestrator/restart.ts`
- Implements restart policies:
  - `unless-stopped`: Auto-restart unless manually stopped
  - `on-failure`: Restart only on failure, with backoff
  - `always`: Always restart
- Exponential backoff: 1s, 2s, 4s, 8s... max 5 minutes
- **Test First**: `src/agents/orchestrator/restart.test.ts`

#### Story 7: Configuration and Deployment

**7.1 Example Configuration File**
- File: `config/agents.example.yaml`
- Show all agent types with full configuration
- Comments explaining each field
- Include all 4 built-in agent types

**7.2 Docker Compose Integration**
- File: `docker-compose.agents.yml`
- Orchestrator service
- Depends on PostgreSQL and Neo4j
- Volume mounts for config

**7.3 NPM Scripts**
- Add to `package.json`:
  ```json
  "agent:orchestrator:start": "tsx src/agents/orchestrator/index.ts start",
  "agent:orchestrator:stop": "tsx src/agents/orchestrator/index.ts stop",
  "agent:orchestrator:status": "tsx src/agents/orchestrator/index.ts status"
  ```

---

## Configuration Schema

```yaml
# config/agents.yaml
version: "1.0"
group_id: "memory-system"

agents:
  # Knowledge Curator - runs every hour
  - name: "hourly-knowledge-curator"
    type: "knowledge-curator"
    enabled: true
    schedule:
      cron: "0 * * * *"  # Every hour
    resources:
      memory_mb: 512
      cpu_percent: 50
      timeout_seconds: 300
    restart_policy: "unless-stopped"
    notion:
      sync: true
      database_id: "..."  # Optional: specific Notion DB
    config:
      min_confidence: 0.7
      max_promotions_per_run: 10

  # Memory Promotion - runs every 5 minutes
  - name: "frequent-memory-promoter"
    type: "memory-promotion"
    enabled: true
    schedule:
      interval_seconds: 300
    resources:
      memory_mb: 256
      cpu_percent: 30
    restart_policy: "on-failure"
    config:
      batch_size: 100

  # ADAS Search - runs continuously
  - name: "continuous-adas-search"
    type: "adas-search"
    enabled: false  # Disabled by default (resource intensive)
    schedule:
      continuous: true
    resources:
      memory_mb: 1024
      cpu_percent: 80
    restart_policy: "unless-stopped"
    config:
      population_size: 10
      max_generations: 100
      early_stopping: true

  # Custom Task - runs daily
  - name: "daily-backup"
    type: "custom-task"
    enabled: true
    schedule:
      cron: "0 2 * * *"  # 2 AM daily
    restart_policy: "on-failure"
    config:
      command: "npm run backup"
      working_dir: "/data"
      env:
        BACKUP_TARGET: "s3://backups/memory"
```

---

## Verification Strategy

### TDD Approach

For each work item:

1. **Write test first** - Define expected behavior
2. **Run test (should fail)** - Confirm test setup is correct
3. **Implement code** - Minimal code to pass test
4. **Run test (should pass)** - Verify implementation
5. **Refactor** - Clean up while keeping tests green

### Test Coverage Requirements

| Component | Min Coverage | Notes |
|-----------|--------------|-------|
| Config schema | 100% | Critical for validation |
| Orchestrator | 90% | Core business logic |
| Health checks | 100% | Reliability critical |
| Built-in agents | 85% | Each agent type tested |
| Notion sync | 80% | Integration tests |
| Monitoring | 90% | Heartbeat, status, alerts |

### E2E Tests

- `src/__tests__/agent-lifecycle.e2e.test.ts` - Full agent lifecycle
- `src/__tests__/agent-notion-sync.e2e.test.ts` - Notion integration
- `src/__tests__/agent-restart.e2e.test.ts` - Restart policies

---

## Integration Points

### Existing Systems

| System | Integration Point | How |
|--------|-------------------|-----|
| PostgreSQL | Heartbeat logging | New table `agent_heartbeats` |
| Neo4j | Agent registry | New nodes `:Agent`, `:AgentVersion` |
| Notion | Agent dashboard | New database "Agent Registry" |
| Curator | Knowledge curator agent | Reuses curator service |
| ADAS | ADAS search agent | Reuses ADAS modules |
| Docker | Container runtime | Reuses dockerode + adas-sandbox |

### New Database Tables

```sql
-- PostgreSQL
CREATE TABLE agent_heartbeats (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  group_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) NOT NULL, -- 'healthy', 'unhealthy', 'starting', 'stopped'
  metrics JSONB,
  message TEXT
);

CREATE INDEX idx_heartbeats_agent_time ON agent_heartbeats(agent_id, timestamp DESC);
```

### Neo4j Schema

```cypher
// Agent Registry
CREATE CONSTRAINT agent_id_exists IF NOT EXISTS
FOR (a:Agent) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT agent_group_id_exists IF NOT EXISTS
FOR (a:Agent) REQUIRE a.group_id IS NOT NULL;

// Agent nodes
(:Agent {
  id: string,
  name: string,
  type: string,  // 'knowledge-curator', 'memory-promotion', etc.
  status: string,  // 'Pending', 'Running', 'Stopped', 'Error'
  group_id: string,
  config_hash: string,
  created_at: datetime,
  updated_at: datetime
})

// Agent versions (SUPERSEDES pattern)
(:AgentVersion)-[:SUPERSEDES]->(:AgentVersion)

// Agent runs
(:AgentRun {
  run_id: string,
  agent_id: string,
  started_at: datetime,
  ended_at: datetime,
  duration_ms: integer,
  success: boolean,
  error_message: string
})-[:RUN_OF]->(:Agent)
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docker not available | High | Graceful degradation with warning logs |
| Config syntax errors | Medium | Zod validation with detailed error messages |
| Resource exhaustion | High | Resource limits per agent + monitoring |
| Notion API rate limits | Medium | Exponential backoff, batch updates |
| Agent crashes loop | Medium | Max restart attempts + circuit breaker |
| Database connection failures | High | Retry with backoff, alert on persistent failure |

---

## Success Criteria

1. ✅ Config file `config/agents.yaml` can define agents
2. ✅ Running `npm run agent:orchestrator:start` launches agents
3. ✅ Each agent runs in its own Docker container
4. ✅ Agent status visible in Notion with real-time sync
5. ✅ Agents restart automatically based on policy
6. ✅ Heartbeats logged to PostgreSQL
7. ✅ All tests pass (TDD approach)
8. ✅ Agent types work: curator, memory promotion, ADAS search, custom

---

## Next Steps

1. **Review Plan** - Approve PROMETHEUS.md
2. **Initialize Project** - Create directory structure
3. **Story 1.1** - Start with config schema (TDD)
4. **Iterate** - Complete stories in order, tests first

## Rollback Strategy

If needed, this system can be disabled by:
1. Stopping orchestrator: `npm run agent:orchestrator:stop`
2. Stopping all agent containers: `docker stop $(docker ps -q --filter "label=agent.managed=true")`
3. No impact to existing OpenCode agents or ADAS sandbox

## Appendix: File Structure

```
src/agents/
├── config/
│   ├── schema.ts          # + schema.test.ts
│   ├── loader.ts          # + loader.test.ts
│   └── types.ts
├── orchestrator/
│   ├── index.ts           # + index.test.ts
│   ├── container.ts       # + container.test.ts
│   ├── lifecycle.ts       # + lifecycle.test.ts
│   ├── restart.ts         # + restart.test.ts
│   └── health.ts          # + health.test.ts
├── built-in/
│   ├── knowledge-curator.ts    # + .test.ts
│   ├── memory-promotion.ts     # + .test.ts
│   ├── adas-search.ts          # + .test.ts
│   └── custom-task.ts          # + .test.ts
├── registry/
│   ├── schema.ts          # + schema.test.ts
│   ├── queries.ts         # + queries.test.ts
│   └── client.ts          # + client.test.ts
├── monitoring/
│   ├── heartbeat.ts       # + heartbeat.test.ts
│   ├── status.ts          # + status.test.ts
│   └── alert.ts           # + alert.test.ts
├── notion/
│   ├── registry.ts        # + registry.test.ts
│   ├── creator.ts         # + creator.test.ts
│   └── sync.ts            # + sync.test.ts
└── types.ts               # Shared types

config/
└── agents.example.yaml

docker/
└── agent-runner/
    ├── Dockerfile
    └── entrypoint.sh

src/__tests__/
├── agent-lifecycle.e2e.test.ts
├── agent-notion-sync.e2e.test.ts
└── agent-restart.e2e.test.ts
```