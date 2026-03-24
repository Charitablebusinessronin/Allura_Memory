# Story 6.8: Implement Agent Discovery Search

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.2, 6.3 (COMPLETE)

## User Story

As an agent operator,
I want to search agents by capability, module, or platform,
So that I can find the right agent for my task.

## Acceptance Criteria

### Given 40+ agents exist
When I search "grant research"
Then it returns agents matching:
- Name/description similarity
- Function text similarity
- Associated tags
- Module/platform filters
And results ranked by confidence score

## Technical Specification

### Search Implementation

```typescript
// src/lib/agents/discovery.ts

export class AgentDiscovery {
  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]>;
  async findByCapability(capability: string): Promise<AgentRecord[]>;
  async findByModule(module: string): Promise<AgentRecord[]>;
  async findByPlatform(platform: string): Promise<AgentRecord[]>;
  async getRecommendations(task: string): Promise<AgentRecord[]>;
}
```

### Search Ranking

- Text similarity (0-1)
- Confidence score (0-1)
- Usage frequency (log scale)
- Combined score: `0.4 * similarity + 0.4 * confidence + 0.2 * usage`

## Definition of Done

- [ ] Search implemented
- [ ] Filtering by module/platform
- [ ] Ranking by confidence
- [ ] Tests pass: `npm test -- agent-discovery`
- [ ] Code review approved
- [ ] Memory log updated

---

*Story 6.8 - Implement Agent Discovery Search*
*Epic 6 - Agent Persistence and Lifecycle Management*