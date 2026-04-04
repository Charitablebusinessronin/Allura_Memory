---
title: 'Notion Client Implementation'
type: 'feature'
created: '2026-04-03'
status: 'done'
baseline_commit: '2349fe6648c5c3715565af589c5d6af1c5de14ca'
context:
  - 'docs/superpowers/specs/2026-04-03-openagents-control-registry-design.md'
  - 'src/lib/opencode-registry/types.ts'
  - '.opencode/config/registry-databases.json'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `NotionRegistryClient` class currently returns empty stubs. All query methods return empty arrays (`[]`), and all create/update methods return empty strings (`""`) or void. This prevents the OpenAgents Control Registry from syncing to Notion, making it impossible to operate on the canonical registry from Notion's UI.

**Approach:** Replace stub implementations with real Notion MCP tool calls. Query methods will use `MCP_DOCKER_notion-fetch` and `MCP_DOCKER_notion-query-database-view`. Create methods will use `MCP_DOCKER_notion-create-pages`. Update methods will use `MCP_DOCKER_notion-update-page`. All methods will transform between canonical TypeScript types and Notion's property schema.

## Boundaries & Constraints

**Always:** 
- Use MCP_DOCKER_notion tools (already loaded in session) — no custom fetch/axios wrappers
- Transform canonical types to Notion properties using the type map from design spec
- Convert relations (string arrays) to Notion page references by looking up IDs from cached query results
- Handle Notion API errors with typed errors and descriptive messages
- Preserve database IDs from `registry-databases.json` config
- Map `title` properties correctly: `CanonicalAgent.id`, `CanonicalSkill.id`, `CanonicalCommand.id`, `CanonicalWorkflow.code`, `SyncRun.runId`

**Ask First:**
- Adding retry logic for rate limits (429 errors) — ask if exponential backoff is needed
- Creating database views for sync verification — ask which properties to include
- Implementing conflict detection (version mismatches) — ask if `lastSynced` timestamp should drive conflict resolution

**Never:**
- Delete Notion pages — only upsert (create or update by ID)
- Modify database schemas — schema changes require separate migration workflow
- Skip relation resolution — always resolve string IDs to Notion page references before upsert
- Use hardcoded database IDs — load from `registry-databases.json`
- Implement pagination for query methods — assume <100 entities per database for MVP

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Query Agents (happy path) | Database has 25 agents | Returns `CanonicalAgent[]` with all 25 mapped correctly | N/A |
| Query empty database | No entities in database | Returns `[]` | N/A |
| Create Agent (happy path) | Valid `CanonicalAgent` object | Returns Notion page ID string | N/A |
| Create Agent (missing required field) | Agent without `displayName` | Throws `ValidationError` with field name | App catches and shows user-friendly message |
| Update Agent (happy path) | Page ID + partial `CanonicalAgent` | Returns void, page updated in Notion | N/A |
| Update Agent (page not found) | Invalid page ID | Throws `NotionApiError` with 404 context | App catches and logs |
| Create with relations (happy path) | Agent with `skills: ['skill-1', 'skill-2']` | Creates page with relation properties resolved to Notion page IDs | N/A |
| Create with missing relation | Agent with `skills: ['nonexistent-skill']` | Logs warning, creates agent with empty `skills` relation | `log.warn('Skill not found: nonexistent-skill')` |
| Query with Notion API error | Network timeout | Throws `NotionApiError` with retry hint | App catches and retries |
| Sync Run creation (happy path) | Valid `SyncRun` object | Returns page ID, `driftReport` stored as JSON string | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/opencode-registry/notion-client.ts` -- Main implementation file (stub → real)
- `src/lib/opencode-registry/types.ts` -- Canonical types (input/output contracts)
- `.opencode/config/registry-databases.json` -- Database IDs config
- `scripts/opencode-registry/sync.ts` -- Call site for `NotionRegistryClient` methods
- `scripts/opencode-registry/verify.ts` -- Call site for `notionPageToLocal` function

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/opencode-registry/notion-client.ts` -- Implement query methods (agents, skills, commands, workflows, syncRun) using `MCP_DOCKER_notion-fetch` and `MCP_DOCKER_notion-query-database-view` -- Enables reading existing registry state
- [x] `src/lib/opencode-registry/notion-client.ts` -- Implement create methods (createAgent, createSkill, createCommand, createWorkflow, createSyncRun) using `MCP_DOCKER_notion-create-pages` -- Enables writing new entities
- [x] `src/lib/opencode-registry/notion-client.ts` -- Implement update methods (updateAgent, updateSkill, updateCommand, updateWorkflow) using `MCP_DOCKER_notion-update-page` -- Enables modifying existing entities
- [x] `src/lib/opencode-registry/notion-client.ts` -- Add helper method `resolveRelations` to convert string IDs to Notion page references -- Enables relation property support
- [x] `src/lib/opencode-registry/notion-client.ts` -- Add error classes `ValidationError`, `NotionApiError` with descriptive messages -- Enables proper error handling

**Acceptance Criteria:**
- Given Notion databases exist, when `queryAgents()` is called, then all agents are returned as `CanonicalAgent[]` with relations as string IDs
- Given valid `CanonicalAgent`, when `createAgent(agent)` is called, then agent is created in Notion and page ID returned
- Given existing agent page ID and partial agent, when `updateAgent(pageId, agent)` is called, then agent is updated in Notion
- Given agent with `skills: ['skill-1']`, when `createAgent(agent)` is called, then relation is resolved and linked in Notion
- Given agent missing required `displayName`, when `createAgent(agent)` is called, then throws `ValidationError` with field name

## Spec Change Log

(Empty — first version)

## Design Notes

**Relation Resolution Strategy:**

Relations are stored as string arrays in canonical types (e.g., `skills: string[]`). Notion requires page IDs for relation properties. The client resolves this by:

1. **Query cache:** Before any create/update, call the appropriate query method to get all existing entities
2. **Lookup table:** Build a `Map<string, string>` from entity ID → Notion page ID
3. **Transform:** For each relation array, map IDs to page references
4. **Fallback:** If an ID is not found, log warning and skip (don't fail the whole operation)

**Example: Creating an Agent with Skills**

```typescript
// Canonical type
const agent: CanonicalAgent = {
  id: 'memory-orchestrator',
  skills: ['bmad-party-mode', 'brainstorming'],
  // ... other fields
};

// Resolution
const skillsMap = await this.buildSkillsMap(); // { 'bmad-party-mode': 'page-id-1', ... }
const notionSkills = agent.skills
  .map(id => skillsMap.get(id))
  .filter(Boolean); // Skip missing

// Notion property
properties.Skills = {
  relation: notionSkills.map(id => ({ id }))
};
```

**Property Transformation Patterns:**

| Canonical Field | Notion Property Type | Transform |
|----------------|---------------------|-----------|
| `string` (id, name) | `title` | `{ title: [{ text: { content: value } }] }` |
| `string` (text) | `rich_text` | `{ rich_text: [{ text: { content: value } }] }` |
| `enum` (status, type) | `select` | `{ select: { name: value } }` |
| `string[]` (relations) | `relation` | `{ relation: resolvedIds.map(id => ({ id })) }` |
| `boolean` | `checkbox` | `{ checkbox: value }` |
| `number` | `number` | `{ number: value }` |
| `Date` | `date` | `{ date: { start: value.toISOString() } }` |

**Error Class Design:**

```typescript
export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotionApiError extends Error {
  constructor(
    public operation: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}
```

---

## Suggested Review Order

**Entry Point: Integration Pattern**

- Dependency injection pattern enables both agent context (MCP tools) and standalone runtime (custom executor)
  [`notion-client.ts:36-54`](../../src/lib/opencode-registry/notion-client.ts#L36-L54)

**API Surface: Query Methods**

- Query methods transform Notion database pages into canonical types using property extractors
  [`notion-client.ts:67-89`](../../src/lib/opencode-registry/notion-client.ts#L67-L89)

**API Surface: Create Methods**

- Create methods validate entities, transform properties, and delegate to MCP executor
  [`notion-client.ts:94-134`](../../src/lib/opencode-registry/notion-client.ts#L94-L134)

**API Surface: Update Methods**

- Update methods use partial flag to avoid required field validation on updates
  [`notion-client.ts:139-158`](../../src/lib/opencode-registry/notion-client.ts#L139-L158)

**Property Transformation: Canonical → Notion**

- Bidirectional property transformation handles title, rich_text, select, relation, checkbox, number, date
  [`notion-client.ts:393-543`](../../src/lib/opencode-registry/notion-client.ts#L393-L543)

**Property Transformation: Notion → Canonical**

- Extractors handle both PropertyName and property-name Notion formats for resilience
  [`notion-client.ts:318-391`](../../src/lib/opencode-registry/notion-client.ts#L318-L391)

**Error Handling**

- Typed errors with field-level context for validation, operation-level context for API failures
  [`notion-client.ts:12-23`](../../src/lib/opencode-registry/notion-client.ts#L12-L23)

**Integration: Sync Script**

- Updated to use new NotionClientConfig structure with MCP executor injection
  [`sync.ts:10-46`](../../scripts/opencode-registry/sync.ts#L10-L46)

**Supporting: Type Definitions**

- Canonical types define the contract between local registry and Notion mirror
  [`types.ts:13-95`](../../src/lib/opencode-registry/types.ts#L13-L95)

**Commands:**
- `bun run registry:sync --dry-run` -- expected: logs show "Would create X agents, Y skills, Z commands" with no errors
- `bun run registry:sync` -- expected: creates/updates entities in Notion, returns exit code 0
- `bun run typecheck` -- expected: no type errors in `notion-client.ts`

**Manual checks:**
- Open Notion page `https://www.notion.so/3371d9be65b38041bc59fd5cf966ff98` and verify Agents, Skills, Commands, Workflows databases have entities after sync
- Verify relations (e.g., Agent → Skills) are linked in Notion UI