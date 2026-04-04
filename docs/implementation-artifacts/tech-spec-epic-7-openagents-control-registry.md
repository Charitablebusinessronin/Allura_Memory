# Tech Spec: OpenAgents Control Registry

**Epic**: Epic 7 — OpenAgents Control Registry
**Created**: 2026-04-03
**Status**: Ready for Implementation

---

## Technical Architecture

### Component Diagram

```
Local Files (.opencode/, _bmad/)
    ↓
Extraction Scripts (TS/Bun)
    ├─ extract-agents.ts
    ├─ extract-skills.ts
    ├─ extract-commands.ts
    └─ extract-workflows.ts
    ↓
Normalization Layer
    └─ normalize.ts (canonical IDs + relations)
    ↓
Sync Engine
    ├─ sync.ts (orchestrator)
    ├─ verify.ts (drift detection)
    └─ sync-registry-logger.ts
    ↓
Notion MCP Client
    └─ notion-client.ts (upsert wrapper)
    ↓
Notion Control Plane
    ├─ Agents DB
    ├─ Skills DB
    ├─ Commands DB
    ├─ Workflows DB
    └─ Sync Registry DB
```

### Data Model

```typescript
// Canonical Agent
{
  id: string;              // memory-orchestrator, bmad-agent-architect
  displayName: string;     // "Frederick P. Brooks Jr.", "Winston"
  type: AgentType;         // OpenAgent | Specialist | Worker | BMad Persona | WDS Persona
  category?: string;       // core, subagents/code, bmm, wds
  status: EntityStatus;   // active | idle | deprecated | experimental
  sourcePath: string;      // .opencode/agent/core/openagent.md
  skills: string[];        // linked skill IDs
  commands: string[];      // linked command IDs
  workflows: string[];     // linked workflow codes
}

// Canonical Skill
{
  id: string;              // bmad-party-mode, brainstorming
  category?: SkillCategory; // bmad | wds | tea | context
  sourcePath: string;      // .opencode/skills/bmad-party-mode/SKILL.md
  requiredTools?: string[]; // read, write, edit, bash, grep, task
  status: EntityStatus;
}
```

### Sync Flow

1. **Extract**: Parse local sources into canonical entities
2. **Normalize**: Build relation graph (agent → skills, workflow → agent)
3. **Compare**: Query Notion, identify drift (missing, mismatches, broken links)
4. **Upsert**: Create/update Notion entries
5. **Verify**: Count parity + field checks + link integrity
6. **Log**: Audit entry to Sync Registry

---

## Tech Stack

- **Runtime**: Bun + TypeScript (strict mode)
- **Parsing**: `csv-parse` for manifests, `gray-matter` for SKILL.md frontmatter
- **File System**: `glob` for file discovery, `fs/promises` for reads
- **Testing**: Bun test runner
- **Notion API**: MCP_DOCKER Notion tools (create-database, create-pages, update-page)

---

## Implementation Phases

### Phase 1: Notion Setup (Tasks 1.1–1.5)
- Create 5 databases via MCP_DOCKER_notion-create-database
- Configure schema properties (titles, selects, relations)
- Save database IDs to config file

### Phase 2: TypeScript Foundation (Tasks 2.1–2.2)
- Define types in `src/lib/opencode-registry/types.ts`
- Build Notion client wrapper in `src/lib/opencode-registry/notion-client.ts`

### Phase 3: Extraction Scripts (Tasks 3.1–3.4)
- Agent extractor: parse JSON + CSV
- Skills extractor: glob SKILL.md files
- Commands extractor: glob .md in command dir
- Workflows extractor: parse CSVs

### Phase 4: Normalization (Task 4.1)
- Build relation graph
- Map canonical IDs

### Phase 5: Sync Engine (Tasks 5.1)
- Orchestrator: extract → normalize → compare → upsert → verify
- Drift detection: missing entities + broken links + field mismatches
- Sync registry logger: audit trail

### Phase 6: CLI (Task 6.1)
- `registry:sync` — full sync
- `registry:dry-run` — preview only

---

## API Surface

| CLI Command | Purpose | Output |
|-------------|---------|--------|
| `bun run registry:sync` | Execute full sync | Sync run logged to Notion |
| `bun run registry:dry-run` | Preview sync counts | Console output only |

---

## Error Handling

- CSV parse errors: Log + skip row + continue
- Notion API errors: Retry with exponential backoff (max 3)
- Missing source files: Log warning + skip entity
- Broken relations: Log to drift report + continue sync

---

## Testing Strategy

- Unit tests for each extractor (agents, skills, commands, workflows)
- Unit test for normalizer (relation graph)
- Unit test for verifier (drift detection)
- Integration test (skip in CI, requires NOTION_API_KEY)
- End-to-end validation: run dry-run, check counts

---

## Deployment Notes

- Run locally via Bun CLI
- Schedule weekly sync via cron (future)
- Manual sync triggered by user command

---

**Dependencies**:
- `csv-parse` — CSV parsing
- `gray-matter` — frontmatter extraction (optional, can use regex)
- `glob` — file pattern matching
- `@notionhq/client` — Notion SDK (via MCP_DOCKER)