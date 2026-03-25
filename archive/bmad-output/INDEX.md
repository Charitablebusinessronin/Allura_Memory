# Allura's Memory - Artifact Index

**Status:** All 6 Epics Complete (1854+ tests passing)  
**Last Updated:** 2026-03-24

> ⚠️ **This archive contains historical planning artifacts for Allura's Memory.**
>
> For **current documentation**, see:
> - **[AGENTS.md](../AGENTS.md)** — Agent coding guide (merged with project-context)
> - **[README.md](../README.md)** — Allura's Memory overview and quick start
> - **[memory-bank/](../memory-bank/)** — Persistent AI context (6 files)
> - **[docs/](../docs/)** — Architecture and deployment docs

---

## Historical Archive Contents

This directory preserves the planning and implementation artifacts from the 6-epic development cycle that built **Allura's Memory**.

---

## Planning Artifacts

### Epics and Stories
| File | Purpose |
|------|---------|
| [`planning-artifacts/epics.md`](planning-artifacts/epics.md) | Complete epic and story breakdown with acceptance criteria |
| [`planning-artifacts/architecture.md`](planning-artifacts/architecture.md) | Architecture decisions and system design |
| [`planning-artifacts/epic-6-agent-persistence.md`](planning-artifacts/epic-6-agent-persistence.md) | Agent lifecycle management |

**Epic Overview:**
- **Epic 1**: Persistent Knowledge Capture and Tenant-Aware Memory (7 stories)
- **Epic 2**: ADAS Discovery and Design Promotion Pipeline (5 stories)
- **Epic 3**: Governed Runtime, Policy Enforcement, and Bounded Autonomy (6 stories)
- **Epic 4**: Knowledge Lifting and Automated Curation Pipeline (6 stories)
- **Epic 5**: Notion Integration Hardening (6 stories)
- **Epic 6**: Agent Persistence & Lifecycle (10 stories)

---

## Implementation Artifacts

### Current Sprint Status
| File | Purpose |
|------|---------|
| [`implementation-artifacts/sprint-status.yaml`](implementation-artifacts/sprint-status.yaml) | Sprint and story status tracking |

### Technical Specifications
| File | Purpose |
|------|---------|
| [`implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md`](implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md) | Core schema, Steel Frame, HITL governance |
| [`implementation-artifacts/tech-spec-governed-auto-approval-foundation.md`](implementation-artifacts/tech-spec-governed-auto-approval-foundation.md) | Auto-approval pipeline |
| [`implementation-artifacts/tech-spec-audit-memory-backups-and-approved-notion-records.md`](implementation-artifacts/tech-spec-audit-memory-backups-and-approved-notion-records.md) | Audit and backup specifications |

### Story Files

See [`implementation-artifacts/sprint-status.yaml`](implementation-artifacts/sprint-status.yaml) for current status of all stories.

---

## Documentation Artifacts

| File | Purpose |
|------|---------|
| [`BLUEPRINT.md`](BLUEPRINT.md) | Core design intent with requirements, architecture, and data model |
| [`SOLUTION-ARCHITECTURE.md`](SOLUTION-ARCHITECTURE.md) | System topology and interaction patterns |
| [`project-context.md`](project-context.md) | AI agent rules and patterns (CRITICAL for coding agents) |

---

## Test Artifacts

*Test artifacts are located in `src/__tests__/` and alongside source files as `*.test.ts`*

---

## Quick Reference

### Toolchain

| Component | Type | Purpose |
|-----------|------|---------|
| OhMyOpenCode | Agent | AI agent |
| OpenClaw | Agent | AI agent |
| MCP_DOCKER | CLI | Add/execute MCP servers from Docker Hub |
| MCP Servers | Services | Pulled from [Docker Hub MCP](https://hub.docker.com/mcp) |
| ronin-memory | Custom MCP | Memory system for agents |

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
│   ├── implementation-artifacts/  # Tech specs, story files
│   ├── BLUEPRINT.md          # Core design document
│   └── SOLUTION-ARCHITECTURE.md   # System topology
├── src/
│   ├── lib/postgres/         # PostgreSQL client (Layer 1 - Raw Memory)
│   ├── lib/neo4j/            # Neo4j client (Layer 2 - Semantic Memory)
│   ├── lib/adas/             # ADAS runtime library (backend logic only)
│   ├── lib/ralph/            # Self-correcting execution loops
│   ├── lib/circuit-breaker/  # Cascade failure prevention
│   ├── lib/policy/           # RBAC, allow/deny rules
│   ├── curator/              # Knowledge promotion pipeline
│   └── mcp/                  # MCP server for agents (via MCP_DOCKER)
└── .opencode/                # OhMyOpenCode configuration
```

### P0 Checklist (Must Complete First)
- [x] PostgreSQL TypeScript client
- [x] Neo4j TypeScript client
- [x] Notion MCP Integration
- [x] Neo4j schema constraints/indexes
- [x] group_id constraint enforcement
- [x] ADR 5-Layer Framework
- [x] HITL Knowledge Promotion Gate
- [x] Insight Versioning (SUPERSEDES edges)
- [ ] Memory Card Documentation Update (IN PROGRESS)
- [ ] Self-Improvement System Specification

---

## Related Documentation

- [BMAD Memory Anchor](_bmad/_memory/unified-memory-anchor.md) - Memory retrieval order
- [GitHub Copilot Instructions](../.github/copilot-instructions.md) - Agent context file
- [Docker Compose](../docker-compose.yml) - Container definitions
- [AGENTS.md](../AGENTS.md) - Agent coding guide

---

*This INDEX is auto-generated. Update when adding new artifacts.*
