# ADAS + OpenClaw Mission Control Integration

## Research Context

**User Goals:**
1. Create agents using OpenClaw Mission Control
2. Integrate with existing ADAS system in Ronin Memory
3. Run research tasks on schedule

**Research Questions:**
1. How do meta-agent search systems integrate with agent platforms?
2. How do discovered agents get registered with orchestration layers?
3. What metadata is needed for registration (tools, model, schedule, prompts)?
4. How is the handoff between discovery and deployment?

---

## Integration Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ADAS Search Loop                                      │
│  ┌─────────────┐    ┌───────────────┐    ┌─────────────────┐               │
│  │ Population  │───▶│ Sandboxed     │───▶│ Evaluation      │               │
│  │ Generation  │    │ Evaluation    │    │ Harness         │               │
│  └─────────────┘    └───────────────┘    └────────┬────────┘               │
│                                                    │                         │
│                                                    ▼                         │
│                                          ┌─────────────────┐               │
│                                          │ Promotion       │               │
│                                          │ Detector        │               │
│                                          │ (score >= 0.7)  │               │
│                                          └────────┬────────┘               │
└───────────────────────────────────────────────────┼─────────────────────────┘
                                                    │
                                                    ▼ Candidate Found
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Promotion Pipeline                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ Promotion       │───▶│ Neo4j AgentDesign│───▶│ PostgreSQL      │         │
│  │ Proposal        │    │ Node            │    │ Evidence        │         │
│  │ (pending_approv│    │ (pending_approv │    │ (audit trail)   │         │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘         │
│                                   │                                         │
│                                   │ Proposal Created                         │
│                                   ▼                                         │
│                          ┌─────────────────┐                               │
│                          │ Mission Control  │                               │
│                          │ Approval Queue   │                               │
│                          └────────┬────────┘                               │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                                    ▼ Human Approves
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Approval → Deployment                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ Approval        │───▶│ Active Insight  │───▶│ Agent           │         │
│  │ Workflow        │    │ (Neo4j)         │    │ Registration    │         │
│  │ (HITL Gate)     │    │                 │    │ (Mission Ctrl)  │         │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘         │
│                                                          │                   │
│                                                          ▼                   │
│                                                 ┌─────────────────┐         │
│                                                 │ Docker Agent    │         │
│                                                 │ Container       │         │
│                                                 │ (Scheduled)    │         │
│                                                 └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Integration Points

### 1. ADAS → Mission Control Handoff

**Current State:**
- ADAS creates `AgentDesign` nodes in Neo4j with `status: pending_approval`
- Approval workflow logs to PostgreSQL `approval_history` table
- Approved designs become active `Insight` nodes

**Integration Bridge:**
```typescript
// New: Mission Control Agent Registration
interface AgentRegistration {
  // From ADAS AgentDesign
  design_id: string;
  name: string;
  domain: string;
  config: {
    systemPrompt: string;
    tools: AgentTool[];
    model: ModelConfig;
    reasoningStrategy: ReasoningStrategy;
  };
  metrics: EvaluationMetrics;
  adas_run_id: string;
  
  // From Mission Control
  schedule: Schedule;  // cron | interval_seconds | continuous
  resources: Resources; // memory_mb, cpu_percent, timeout_seconds
  notion_sync: { sync: boolean; database_id?: string };
  restart_policy: RestartPolicy;
}
```

### 2. Required Changes

#### File: `src/lib/adas/approval-workflow.ts`

```typescript
// AFTER approval, trigger Mission Control registration
async approveProposal(action: ApprovalAction): Promise<ApprovalResult> {
  // ... existing approval logic ...
  
  // NEW: Register with Mission Control if configured
  if (process.env.MISSION_CONTROL_INTEGRATION === 'true') {
    await this.registerWithMissionControl(updatedNode);
  }
  
  return result;
}

// NEW METHOD
private async registerWithMissionControl(proposal: AgentDesignNode): Promise<void> {
  const registration: AgentRegistration = {
    design_id: proposal.design_id,
    name: proposal.name,
    domain: proposal.domain,
    config: JSON.parse(proposal.config as string),
    metrics: proposal.metrics,
    adas_run_id: proposal.adas_run_id ?? undefined,
    
    // Default Mission Control settings
    schedule: { continuous: true },  // or from proposal metadata
    resources: {
      memory_mb: 256,
      cpu_percent: 50,
      timeout_seconds: 300
    },
    notion_sync: { sync: true },
    restart_policy: 'unless-stopped'
  };
  
  // Insert into agents_config table or send to Mission Control API
  await this.insertAgentRegistration(registration);
}
```

#### New File: `src/lib/adas/mission-control-bridge.ts`

```typescript
/**
 * Bridge between ADAS approved designs and Mission Control agent execution
 */
export interface MissionControlAgentConfig {
  // Core agent definition (from ADAS)
  design_id: string;
  name: string;
  type: 'adas-search' | 'custom-task';
  domain: string;
  
  // Execution config (from AgentConfigSchema)
  schedule: Schedule;
  resources: Resources;
  restart_policy: RestartPolicy;
  
  // Notion tracking
  notion: NotionConfig;
  
  // ADAS metadata
  adas_run_id: string;
  metrics: EvaluationMetrics;
  score: number;
}

/**
 * Convert approved AgentDesign to Mission Control agent config
 */
export function designToAgentConfig(
  design: AgentDesignNode,
  options: Partial<MissionControlAgentConfig> = {}
): AgentConfig {
  return {
    name: design.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    type: 'custom-task', // or 'adas-search' for search agents
    enabled: true,
    schedule: options.schedule ?? { continuous: true },
    resources: options.resources ?? {
      memory_mb: 256,
      cpu_percent: 50,
      timeout_seconds: 300
    },
    restart_policy: options.restart_policy ?? 'unless-stopped',
    notion: options.notion ?? { sync: true },
    config: {
      design_id: design.design_id,
      model: design.config.model,
      tools: design.config.tools,
      reasoningStrategy: design.config.reasoningStrategy,
      systemPrompt: design.config.systemPrompt
    }
  };
}

/**
 * Register approved agent with Mission Control
 */
export async function registerApprovedAgent(
  design: AgentDesignNode,
  groupId: string
): Promise<{ agentId: string; containerId: string }> {
  // 1. Convert design to agent config
  const agentConfig = designToAgentConfig(design);
  
  // 2. Write to agents configuration
  await writeAgentConfig(groupId, agentConfig);
  
  // 3. Create Docker container if schedule is immediate
  if (agentConfig.schedule.continuous) {
    const containerId = await createAgentContainer(agentConfig);
    return { agentId: agentConfig.name, containerId };
  }
  
  // 4. For scheduled agents, register with cron/interval scheduler
  if (agentConfig.schedule.cron || agentConfig.schedule.interval_seconds) {
    await scheduleAgent(agentConfig);
  }
  
  // 5. Sync to Notion for tracking
  if (agentConfig.notion.sync) {
    await syncToNotion(design, agentConfig);
  }
  
  return { agentId: agentConfig.name, containerId: '' };
}
```

---

## Implementation Sequence

### Phase 1: Database Schema Extensions

**File: `src/lib/postgres/schema/agents.sql`**

```sql
-- Agent registrations (approved ADAS designs ready for deployment)
CREATE TABLE IF NOT EXISTS agent_registrations (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  design_id VARCHAR(255) REFERENCES promotion_candidates(design_id),
  group_id VARCHAR(255) NOT NULL,
  
  -- Agent config
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'custom-task',
  enabled BOOLEAN DEFAULT true,
  
  -- Schedule
  schedule_type VARCHAR(50) NOT NULL, -- 'cron', 'interval', 'continuous'
  schedule_value VARCHAR(255), -- cron expr or seconds
  
  -- Resources
  memory_mb INTEGER DEFAULT 256,
  cpu_percent INTEGER DEFAULT 50,
  timeout_seconds INTEGER DEFAULT 300,
  
  -- Tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, stopped, error
  container_id VARCHAR(255),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Notion
  notion_page_id VARCHAR(255),
  
  -- ADAS linkage
  adas_run_id VARCHAR(255),
  score DECIMAL(10, 6),
  metrics JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(group_id, agent_id)
);

CREATE INDEX idx_agent_registrations_status ON agent_registrations(status, next_run_at);
CREATE INDEX idx_agent_registrations_design ON agent_registrations(design_id);
```

### Phase 2: Mission Control Integration

**File: `src/agents/registry.ts`** (new)

```typescript
/**
 * Agent Registry - Manages approved agents and their lifecycle
 */
export class AgentRegistry {
  /**
   * Get all agents for a group
   */
  async getAgents(groupId: string): Promise<AgentRegistration[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM agent_registrations WHERE group_id = $1 ORDER BY created_at DESC`,
      [groupId]
    );
    return result.rows;
  }
  
  /**
   * Get pending deployments (approved agents not yet running)
   */
  async getPendingDeployments(groupId: string): Promise<AgentRegistration[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM agent_registrations 
       WHERE group_id = $1 AND status = 'pending'
       ORDER BY created_at ASC`,
      [groupId]
    );
    return result.rows;
  }
  
  /**
   * Update agent status
   */
  async updateAgentStatus(
    agentId: string,
    status: 'pending' | 'running' | 'stopped' | 'error',
    error?: string
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE agent_registrations 
       SET status = $1, last_error = $2, updated_at = NOW()
       WHERE agent_id = $3`,
      [status, error ?? null, agentId]
    );
  }
  
  /**
   * Calculate next run time for scheduled agents
   */
  calculateNextRun(agent: AgentRegistration): Date {
    if (agent.schedule_type === 'continuous') {
      return new Date(); // Now
    }
    
    if (agent.schedule_type === 'interval') {
      return new Date(Date.now() + parseInt(agent.schedule_value) * 1000);
    }
    
    if (agent.schedule_type === 'cron') {
      // Use cron parser
      const cron = parseCron(agent.schedule_value);
      return cron.next();
    }
    
    return new Date();
  }
}
```

### Phase 3: Approval → Deployment Hook

**File: `src/lib/adas/approval-workflow.ts`** (modify)

```typescript
// Add to existing ApprovalWorkflowManager class

private async deployApprovedAgent(
  proposal: AgentDesignNode,
  groupId: string,
  approverId: string
): Promise<{ agentId: string; status: string } | null> {
  try {
    // Check if Mission Control integration is enabled
    if (!process.env.ENABLE_MISSION_CONTROL) {
      return null; // Silent skip if not configured
    }
    
    // Import the bridge
    const { registerApprovedAgent } = await import('./mission-control-bridge');
    
    // Register the approved agent
    const result = await registerApprovedAgent(proposal, groupId);
    
    // Log the deployment
    await insertEvent({
      group_id: groupId,
      event_type: 'agent_deployed',
      agent_id: 'approval-workflow',
      workflow_id: `deploy-${proposal.design_id}`,
      metadata: {
        designId: proposal.design_id,
        agentId: result.agentId,
        containerId: result.containerId,
        approverId
      },
      status: 'completed'
    });
    
    return { agentId: result.agentId, status: 'deployed' };
  } catch (error) {
    console.error('[ApprovalWorkflow] Failed to deploy agent:', error);
    return null; // Don't fail approval if deployment fails
  }
}

// In approveProposal method, after creating the insight:
const deployment = await this.deployApprovedAgent(updatedNode, groupId, approverId);

return {
  success: true,
  designId,
  status: 'approved',
  approvedBy: approverId,
  approvedAt: new Date(),
  insightId: insightRecord?.insight_id,
  // NEW:
  agentId: deployment?.agentId,
  deploymentStatus: deployment?.status
};
```

---

## Metadata Schema Mapping

### ADAS AgentDesign → Mission Control AgentConfig

| ADAS Field | Mission Control Field | Notes |
|------------|----------------------|-------|
| `design_id` | `config.design_id` | Retained for traceability |
| `name` | `name` | Kebab-case conversion |
| `domain` | `config.domain` | Task categorization |
| `config.systemPrompt` | `config.systemPrompt` | Agent instructions |
| `config.tools[]` | `config.tools[]` | Tool definitions |
| `config.model` | `config.model` | Model selection |
| `config.reasoningStrategy` | `config.reasoningStrategy` | Strategy type |
| `metrics.accuracy` | `config.metrics.accuracy` | For monitoring |
| `metrics.cost` | `config.metrics.cost` | Resource planning |
| `metrics.latency` | `config.metrics.latency` | Scheduling optimization |
| — | `schedule` | NEW: cron/interval/continuous |
| — | `resources` | NEW: memory/cpu limits |
| — | `restart_policy` | NEW: Docker behavior |
| — | `notion.sync` | NEW: Notion tracking |

---

## Workflow Integration Details

### Triggering ADAS from Mission Control

```typescript
// New endpoint: POST /api/adas/trigger
// Allows Mission Control to start an ADAS search

interface TriggerADASSearch {
  domain: string;
  groupId: string;
  config?: Partial<SearchConfig>;
}

// Mission Control → ADAS Flow:
// 1. Mission Control calls trigger endpoint
// 2. ADAS runs search loop (async)
// 3. On completion, proposals appear in approval queue
// 4. Human approves in Mission Control UI
// 5. Approved agent auto-registers and starts
```

### ADAS Proposals → Mission Control Queue

```typescript
// Poll proposals endpoint: GET /api/adas/proposals?status=pending_approval
// Returns: AgentDesign[] with status='pending_approval'

// Mission Control UI shows:
// - Proposal name, domain, score
// - Metrics breakdown (accuracy, cost, latency)
// - Evidence reference link
// - Approve/Reject buttons
```

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/lib/adas/approval-workflow.ts` | Add `deployApprovedAgent()` hook, extend return type |
| `src/lib/adas/promotion-proposal.ts` | Add Mission Control metadata fields |
| `src/integrations/openclaw/adapter.ts` | Add ADAS trigger tools |
| `src/mcp/memory-server.ts` | Add `mcp__adas__trigger_search` tool |
| `src/agents/config/schema.ts` | Extend with ADAS linkage fields |
| **NEW** `src/lib/adas/mission-control-bridge.ts` | Conversion logic (design → agent config) |
| **NEW** `src/agents/registry.ts` | Agent registry for approved agents |
| **NEW** `src/lib/postgres/schema/agents.sql` | Agent registration tables |

---

## Testing Strategy

1. **Unit Tests**: `mission-control-bridge.test.ts`
   - Design to config conversion
   - Schedule parsing
   - Resource defaults

2. **Integration Tests**: `approval-deployment.test.ts`
   - End-to-end approval → deployment
   - PostgreSQL audit trail
   - Neo4j insight creation

3. **E2E Tests**: `adas-mission-control.e2e.ts`
   - Trigger ADAS from API
   - Approve proposal via Mission Control
   - Verify agent starts

---

## Industry Patterns (Librarian Research)

### A2A Agent Card Standard

The Agent-to-Agent (A2A) protocol defines a canonical discovery metadata format:

```typescript
interface AgentCard {
  id: string;                    // Unique identifier
  displayName: string;           // Human-readable name
  description: string;           // Capability description
  version: string;               // Semantic version
  skills: Skill[];              // Core functionality
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  securitySchemes: Record<string, SecurityScheme>;
  authentication: { schemes: string[]; redirectUris: string[] };
}
```

### Three-Layer Testing Framework

Industry standard for agent evaluation before deployment:

| Layer | Purpose | Automation | Gate Strictness |
|-------|---------|------------|------------------|
| **1: Deterministic** | Tool call validation, schema checks | Full auto | Soft (block on fail) |
| **2: Model-Graded** | LLM-as-judge quality scoring | Auto with thresholds | Moderate (85% pass) |
| **3: Statistical** | Multi-run variance analysis | Auto with alerts | Hard (block >8% variance) |

### Handoff Decision Matrix

| Decision | Criteria | Automation Level |
|----------|----------|-------------------|
| Promote to testing | Valid manifest + metadata | Fully automated |
| Approve for staging | Test pass rate ≥ 85% | Semi-automated |
| Production release | Staging eval + human sign-off | Human-gated |
| Rollback trigger | Error rate > 5%, latency p95 > threshold | Fully automated |

### Key Metrics for Agent Reliability

| Metric | Description | Threshold Example |
|--------|-------------|-------------------|
| Task Success | Did the agent complete the goal? | ≥90% |
| Tool Selection Accuracy | Did it call the right tool? | ≥95% |
| Parameter Validity | Were tool arguments correct? | ≥95% |
| Recovery Quality | Did it handle failures gracefully? | ≥85% |
| Cost per Task | Token usage efficiency | ≤ $0.XX threshold |
| Latency p95 | Response time under load | ≤ XXXms |
| Pass Rate Variance | Consistency across runs | ≤8% |

---

## Open Questions

1. **Docker vs Process Execution**: Should agents run in Docker containers (current ADAS sandbox) or as processes?
   - **Recommendation**: Docker for isolation, use existing `SandboxExecutor` infrastructure

2. **Schedule Storage**: Where to store cron schedules?
   - **Recommendation**: `agent_registrations` table with scheduler process polling

3. **Agent Heartbeat**: How to monitor running agents?
   - **Recommendation**: Heartbeat to PostgreSQL `agent_heartbeat` table with auto-restart on failure

4. **Notion Integration**: Should approved agents auto-sync to Notion?
   - **Recommendation**: Opt-in via `notion.sync` flag, default true for visibility

5. **Testing Integration**: Should we implement the three-layer testing framework?
   - **Recommendation**: Start with Layer 1 (deterministic), add Layer 2 (model-graded) in Phase 2

---

## Next Steps

**Phase 1: Core Integration (Estimated: 2-3 days)**
1. Create `src/lib/adas/mission-control-bridge.ts` with design-to-config conversion
2. Add `agent_registrations` table to PostgreSQL schema
3. Modify `approval-workflow.ts` to call bridge on approval
4. Add basic Layer 1 testing (schema validation, tool availability)

**Phase 2: Scheduler & Monitoring (Estimated: 2-3 days)**
5. Create scheduler process for cron/interval agents
6. Add heartbeat monitoring to `agent_registrations`
7. Implement auto-restart on failure

**Phase 3: UI & Notion (Estimated: 2-3 days)**
8. Build Mission Control UI for approval queue
9. Add Notion sync for approved agents
10. Create ADAS trigger tools in MCP server