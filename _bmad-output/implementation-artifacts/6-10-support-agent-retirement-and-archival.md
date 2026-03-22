# Story 6.10: Support Agent Retirement and Archival

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.4, 6.5 (COMPLETE)

## User Story

As a system owner,
I want deprecated agents archived with usage history preserved,
So that we maintain audit trail without cluttering active registry.

## Acceptance Criteria

### Given an agent in Deprecated state for 90 days
When archival process runs
Then it:
- Transitions to Archived state
- Moves Notion entry to Archive database
- Preserves Neo4j node (read-only)
- Preserves PostgreSQL records
- Logs final usage statistics
- Removes from active discovery

## Technical Specification

### Archival Process

```typescript
// src/lib/agents/archive.ts

export class AgentArchive {
  async archiveAgent(agentId: string): Promise<ArchiveResult>;
  async getArchivedAgents(): Promise<AgentRecord[]>;
  async restoreAgent(agentId: string): Promise<void>;
  async getArchiveStats(): Promise<ArchiveStats>;
}
```

### Archive Policy

- Deprecated agents archived after 90 days
- Archived agents removed from active search
- Full audit trail preserved
- Manual restore possible

## Definition of Done

- [ ] Archive workflow implemented
- [ ] Notion archival working
- [ ] Neo4j read-only preservation
- [ ] Tests pass: `npm test -- agent-archive`
- [ ] Code review approved
- [ ] Memory log updated

---

*Story 6.10 - Support Agent Retirement and Archival*
*Epic 6 - Agent Persistence and Lifecycle Management*