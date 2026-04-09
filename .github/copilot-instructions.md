# GitHub Copilot Instructions

> [!IMPORTANT]
> This file configures GitHub Copilot behavior in this repository.

## AI-Assisted Documentation Policy

All code and documentation generated with AI assistance (GitHub Copilot, Claude, etc.) must:

1. **Include disclosure block** (see AI-GUIDELINES.md)
   - Added at top of file after title
   - Removed only after full human review

2. **Follow Brooksian principles**
   - AI assists implementation, not architecture
   - One human architect owns conceptual integrity
   - Never let AI decide system design alone

3. **Validate against source of truth**
   - Code is authoritative (not documentation)
   - JSON schemas are definitive
   - Team consensus overrides AI output

## When Copilot Should Help

✅ Drafting initial document structure
✅ Generating field tables from schemas
✅ Cross-referencing existing documentation
✅ Formatting and spell-checking
✅ Naming conventions (following established patterns)

## When Copilot Should NOT Decide

❌ Architecture decisions (APIs, data models, system design)
❌ Security constraints or threat models
❌ Performance trade-offs
❌ Governance rules (HITL, curator approval gates)
❌ Naming conventions (must match existing patterns)

## Required Artifacts (Before Coding)

- **BLUEPRINT.md** — Service purpose, concepts, requirements
- **SOLUTION-ARCHITECTURE.md** — Design decisions, trade-offs
- **DESIGN-*.md** — Component-level designs
- **REQUIREMENTS-MATRIX.md** — B# → code mapping
- **DATA-DICTIONARY.md** — All entities and fields

See `AI-GUIDELINES.md` for complete guidance.

## Review & Sign-Off

Every AI-assisted document requires:
1. PR review (human eyes on output)
2. Architectural sign-off (architect approves design intent)
3. Disclosure removal (only after sign-off)

Copilot output is a draft, not a final specification.

## Agent Harness Integration

This repository uses three AI harnesses:
- **Claude Code** (primary) — `.claude/` configuration
- **GitHub Copilot** — This file
- **OpenCode** — `.opencode/` configuration

All harnesses must reference AI-GUIDELINES.md and enforce disclosure requirements.

## Memory Bank

This project uses a **Memory Bank** for persistent context. See memory-bank/ for details.

## Brooks as Architect

Frederick Brooks (the persona) serves as the architectural authority:
- Reviews all AI-assisted architecture decisions
- Maintains conceptual integrity across harnesses
- Approves removal of disclosure blocks
- Validates against Brooksian principles

When in doubt, defer to Brooks.

## Key Patterns to Follow

### Steel Frame Versioning
All Insights are immutable. Create new versions with SUPERSEDES relationships:
```
(v2-insight)-[:SUPERSEDES]->(v1-insight:deprecated)
```

### group_id Enforcement
Every node MUST have a `group_id` property. Schema constraint rejects nodes without it.

### HITL Knowledge Promotion
Agents CANNOT autonomously promote to Neo4j/Notion. Human approval required.

### ADR 5-Layer Framework
Every architectural decision captured with:
1. Action Logging
2. Decision Context
3. Reasoning Chain
4. Alternatives Considered
5. Human Oversight Trail

## Memory Retrieval Order

When working on this project, read in this order:

1. `memory-bank/activeContext.md` - Current focus and blockers
2. `memory-bank/progress.md` - What's been done
3. `memory-bank/systemPatterns.md` - How things are built
4. `memory-bank/techContext.md` - Tools and constraints
5. `_bmad-output/implementation-artifacts/` - Story specs and tech details

## Project-Specific Rules

1. **Use Zustand** for client state management (existing pattern in `src/stores/`)
2. **Use shadcn/ui** for UI components
3. **Use server actions** for state persistence (pattern in `src/server/`)
4. **Use group_id** in all database operations for tenant isolation
5. **Use append-only** for PostgreSQL traces - never mutate
6. **Use SUPERSEDES** for Neo4j versioning - never edit Insights
7. **Prefer premade MCP servers from `MCP_DOCKER`**; avoid custom wrappers when a catalog server already exists
8. **Use Bun exclusively** for all package operations — never use `npm` or `npx` (supply chain security)

## Important Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | PostgreSQL and Neo4j containers |
| `_bmad-output/planning-artifacts/epics.md` | Story definitions |
| `_bmad-output/implementation-artifacts/tech-spec-*.md` | Technical specifications |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Current sprint status |

## Verification Commands

```bash
# Check PostgreSQL
docker exec knowledge-postgres pg_isready -U $POSTGRES_USER -d memory

# Check Neo4j
curl -s http://localhost:7474 | jq .neo4j_version

# Test Neo4j Cypher (use environment variable for password)
docker exec knowledge-neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" "RETURN 1 AS test"
```

## Updating Memory Bank

When making significant changes:

1. **After completing a story**: Update `progress.md`
2. **When starting new work**: Update `activeContext.md`
3. **Making architectural decisions**: Update `systemPatterns.md`
4. **Adding new dependencies**: Update `techContext.md`
5. **Major scope changes**: Update `projectbrief.md`

## References

- [Memory Bank System - Tweag Agentic Coding Handbook](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_MEMORY_BANK/)
- [How to Use a Memory Bank in Copilot](https://www.loom.com/share/152cea77575148b8af9fe8538ed30c30)
- [10x your Cursor Workflow with Memory Bank](https://www.youtube.com/watch?v=Uufa6flWid4)
