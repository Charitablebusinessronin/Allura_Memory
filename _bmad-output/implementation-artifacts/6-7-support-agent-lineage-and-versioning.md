# Story 6.7: Support Agent Lineage and Versioning

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.3, 6.5 (COMPLETE)

## User Story

As a system architect,
I want agent versions linked in Neo4j,
So that I can trace evolution and roll back if needed.

## Acceptance Criteria

### Given Agent v1.0.0 exists
When Agent v2.0.0 is created
Then Neo4j stores:
- v2.0.0 node with `SUPERSEDES` → v1.0.0
- v1.0.0 status changes to Deprecated
- Both versions remain queryable
- Rollback path preserved

## Technical Specification

### Lineage Model

```
(Agent v3.0.0)-[:SUPERSEDES]->(Agent v2.0.0)-[:SUPERSEDES]->(Agent v1.0.0)
```

### Version Numbering

- Major version: Breaking changes
- Minor version: New features, backward compatible
- Patch version: Bug fixes

### TypeScript Implementation

```typescript
// src/lib/agents/lineage.ts

export class AgentLineage {
  async createVersion(oldAgentId: string, newAgentId: string): Promise<void>;
  async getLineage(agentId: string): Promise<AgentNode[]>;
  async getLatestVersion(agentId: string): Promise<AgentNode>;
  async rollback(agentId: string, targetVersion: string): Promise<void>;
  async getVersionHistory(agentId: string): Promise<VersionRecord[]>;
}
```

## Definition of Done

- [ ] Lineage creation in Neo4j
- [ ] Version history tracking in PostgreSQL
- [ ] Rollback support
- [ ] Tests pass: `npm test -- agent-lineage`
- [ ] Code review approved
- [ ] Memory log updated

---

*Story 6.7 - Support Agent Lineage and Versioning*
*Epic 6 - Agent Persistence and Lifecycle Management*