# Memory Project - Artifact Index

Generated: 2026-03-15

This INDEX provides a map of all project artifacts for quick navigation and context-aware development.

## Memory Bank (Persistent Context)

The Memory Bank provides session-persistent context for AI agents:

| File | Purpose |
|------|---------|
| [`memory-bank/projectbrief.md`](../memory-bank/projectbrief.md) | Overall scope and goals |
| [`memory-bank/productContext.md`](../memory-bank/productContext.md) | UX, users, problems being solved |
| [`memory-bank/systemPatterns.md`](../memory-bank/systemPatterns.md) | Architecture, patterns, decisions |
| [`memory-bank/techContext.md`](../memory-bank/techContext.md) | Stack, dependencies, constraints |
| [`memory-bank/activeContext.md`](../memory-bank/activeContext.md) | Current task, working notes |
| [`memory-bank/progress.md`](../memory-bank/progress.md) | Status log, completed items |

**Read these files first at the start of each session.**

---

## Planning Artifacts

### Epics and Stories
| File | Purpose |
|------|---------|
| [`planning-artifacts/epics.md`](planning-artifacts/epics.md) | Complete epic and story breakdown with acceptance criteria |

**Epic Overview:**
- **Epic 1**: Persistent Knowledge Capture and Tenant-Aware Memory (7 stories)
- **Epic 2**: ADAS Discovery and Design Promotion Pipeline (5 stories)
- **Epic 3**: Governed Runtime, Policy Enforcement, and Bounded Autonomy (6 stories)
- **Epic 4**: Knowledge Lifting and Automated Curation Pipeline (6 stories)

---

## Implementation Artifacts

### Current Sprint Status
| File | Purpose |
|------|---------|
| [`implementation-artifacts/sprint-status.yaml`](implementation-artifacts/sprint-status.yaml) | Sprint and story status tracking |

**Current Focus:** Epic 1, Story 1.1 - Record Raw Execution Traces (ready-for-dev)

### Technical Specifications
| File | Purpose |
|------|---------|
| [`implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md`](implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md) | Core schema, Steel Frame, HITL governance |

**Key Technical Decisions:**
1. Neo4j for knowledge graph (versioning, relationships)
2. PostgreSQL for raw traces (append-only)
3. MCP for tool interfaces (standard protocol)
4. HITL for promotion gates (human control)
5. Steel Frame for versioning (immutable Insights)

### Story Files

| Story ID | Title | Status |
|----------|-------|--------|
| [`1-1-record-raw-execution-traces.md`](implementation-artifacts/1-1-record-raw-execution-traces.md) | Record Raw Execution Traces | ready-for-dev |
| 1-2-* | Retrieve Episodic Memory from Trace History | backlog |
| 1-3-* | Store Versioned Semantic Insights in Neo4j | backlog |
| 1-4-* | Query Dual Context Memory | backlog |
| 1-5-* | Enforce Tenant Isolation with Group IDs | backlog |
| 1-6-* | Link Promoted Knowledge Back to Raw Evidence | backlog |
| 1-7-* | Automated Knowledge Curation | backlog |

---

## Test Artifacts

*Test artifacts will be created during implementation*

---

## Quick Reference

### Infrastructure Status
| Service | Status | URL |
|---------|--------|-----|
| PostgreSQL 16 | ✅ Healthy | `localhost:5432` |
| Neo4j 5.26 + APOC | ✅ Healthy | `http://localhost:7474` |

### Group IDs
| ID | Description |
|----|-------------|
| `faith-meats` | Jerky business |
| `difference-driven` | Non-profit organization |
| `patriot-awning` | Freelance account |
| `global` | Cross-project shared knowledge |

### Key Paths
```
memory/
├── memory-bank/              # Persistent context (READ FIRST)
├── _bmad-output/             # Generated artifacts (THIS INDEX)
│   ├── planning-artifacts/   # Epics, stories
│   └── implementation-artifacts/  # Tech specs, story files
├── src/lib/postgres/         # PostgreSQL client (TO CREATE)
├── src/lib/neo4j/            # Neo4j client (TO CREATE)
├── src/lib/knowledge/        # Knowledge utilities (TO CREATE)
└── src/lib/mcp/              # MCP tools (TO CREATE)
```

### P0 Checklist (Must Complete First)
- [ ] PostgreSQL TypeScript client
- [ ] Neo4j TypeScript client
- [ ] Notion MCP integration
- [ ] Neo4j schema constraints/indexes
- [ ] group_id constraint enforcement
- [ ] ADR 5-Layer Framework
- [ ] HITL Knowledge Promotion Gate
- [ ] HITL Restricted Tools approval flow
- [ ] Insight Versioning (SUPERSEDES edges)
- [ ] Data separation verification

---

## Related Documentation

- [BMAD Memory Anchor](_bmad/_memory/unified-memory-anchor.md) - Memory retrieval order
- [GitHub Copilot Instructions](../.github/copilot-instructions.md) - Agent context file
- [Docker Compose](../docker-compose.yml) - Container definitions

---

*This INDEX is auto-generated. Update when adding new artifacts.*