# Story 6.4: Mirror Approved Agents to Notion Registry

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.3 (COMPLETE)

## User Story

As a project manager,
I want approved agents visible in Notion AI Agents Registry,
So that the team has a human-readable agent catalog.

## Acceptance Criteria

### Given an agent reaches confidence ≥ 0.7 and is approved
When the mirroring process runs
Then it creates/updates Notion row with:
- Name (with emoji)
- Type (Persona/Role/System/Technical)
- Module (Core/BMM/CIS/GDS/WDS/External)
- Platform (OpenClaw/OpenCode/GPT-4/Fal.ai)
- Status (Active/Testing/Archived)
- Confidence score
- Function description
- Source Path (link to GitHub/file)

## Technical Specification

### Notion Database Structure

**Database ID:** `25ba2b95-bf47-4f64-9ce0-7f93065b9414`

**Properties:**
- Name (title)
- Type (select: Persona, Role, System, Technical)
- Module (select: Core, BMM, CIS, GDS, WDS, External)
- Platform (select: OpenClaw, OpenCode, GPT-4, Fal.ai, Claude)
- Status (select: Active, Testing, Archived)
- Confidence (number)
- Function (rich text)
- Source Path (url)

### TypeScript Client

```typescript
// src/lib/agents/notion-client.ts

export class AgentNotionClient {
  async createAgentPage(agent: AgentRecord): Promise<string>;
  async updateAgentPage(pageId: string, agent: AgentRecord): Promise<void>;
  async getAgentPage(agentId: string): Promise<NotionPage | null>;
  async archiveAgentPage(pageId: string): Promise<void>;
}
```

### Mirroring Pipeline

```typescript
// src/lib/agents/mirror.ts

export async function mirrorAgentToNotion(agentId: string): Promise<MirrorResult> {
  // 1. Check if agent is approved (confidence >= 0.7)
  // 2. Check if agent already exists in Notion
  // 3. Create or update Notion page
  // 4. Store mapping in PostgreSQL
}
```

## Definition of Done

- [ ] AgentNotionClient implemented
- [ ] Mirroring pipeline complete
- [ ] Confidence threshold check (>= 0.7)
- [ ] Status mapping (Draft/Testing/Active/etc.)
- [ ] Tests pass: `npm test -- agent-notion`
- [ ] Code review approved
- [ ] Memory log updated

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/agents/notion-client.ts` | Notion client |
| `src/lib/agents/mirror.ts` | Mirroring pipeline |
| `src/__tests__/agent-notion.test.ts` | Test suite |

## Estimated Effort
2-3 hours

---

*Story 6.4 - Mirror Approved Agents to Notion Registry*
*Epic 6 - Agent Persistence and Lifecycle Management*