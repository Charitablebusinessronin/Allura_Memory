# Story 6.2: Persist Agent Definitions to PostgreSQL

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.1 (COMPLETE)

## User Story

As a system architect,
I want agent definitions stored as versioned records in PostgreSQL,
So that we have durable storage and audit history.

## Acceptance Criteria

### Given a new agent is created
When the persistence pipeline runs
Then it stores in PostgreSQL:
- agent_id (canonical)
- name, description, persona
- created_by, created_at
- version (semantic: 1.0.0)
- status (Draft/Testing/Active/Deprecated/Archived)
- confidence_score (0.0-1.0)
- source_files (JSON array of file paths)

## Technical Specification

### Database Schema

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  persona TEXT,
  module TEXT NOT NULL,
  platform TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'Draft',
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  source_files JSONB DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  group_id TEXT NOT NULL DEFAULT 'default'
);

CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_module ON agents(module);
CREATE INDEX idx_agents_platform ON agents(platform);
CREATE INDEX idx_agents_confidence ON agents(confidence_score);
```

### TypeScript Client

```typescript
// src/lib/agents/postgres-client.ts

export interface AgentRecord {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  persona: string;
  module: string;
  platform: string;
  version: string;
  status: 'Draft' | 'Testing' | 'Active' | 'Deprecated' | 'Archived';
  confidence_score: number;
  source_files: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  group_id: string;
}

export class AgentPostgresClient {
  async createAgent(agent: Partial<AgentRecord>): Promise<AgentRecord>;
  async getAgent(agentId: string): Promise<AgentRecord | null>;
  async updateAgent(agentId: string, updates: Partial<AgentRecord>): Promise<AgentRecord>;
  async listAgents(filters?: AgentFilters): Promise<AgentRecord[]>;
  async deleteAgent(agentId: string): Promise<void>;
}
```

### Integration with Generator

```typescript
// After generating agent files, persist to PostgreSQL
import { AgentPostgresClient } from './lib/agents/postgres-client';

const client = new AgentPostgresClient();

await client.createAgent({
  agent_id: config.name,
  name: config.name,
  description: config.description || 'Auto-generated agent',
  module: config.module,
  platform: config.platform,
  source_files: [
    `agents/${config.name}.md`,
    `skills/${config.name}/SKILL.md`,
    `skills/${config.name}/workflow.md`
  ]
});
```

## Definition of Done

- [ ] PostgreSQL schema created
- [ ] AgentPostgresClient implemented
- [ ] Integration with generator complete
- [ ] Tests pass: `npm test -- agent-postgres`
- [ ] Code review approved
- [ ] Memory log updated

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/agents/postgres-client.ts` | PostgreSQL client |
| `src/lib/agents/schema.sql` | Database schema |
| `src/lib/agents/index.ts` | Export barrel |
| `src/__tests__/agent-postgres.test.ts` | Test suite |

## Estimated Effort
2-3 hours

---

*Story 6.2 - Persist Agent Definitions to PostgreSQL*
*Epic 6 - Agent Persistence and Lifecycle Management*