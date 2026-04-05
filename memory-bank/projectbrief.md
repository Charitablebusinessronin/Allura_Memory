# Project Brief

> **Last Updated:** 2026-04-04

---

## Project Name

**roninmemory** — The memory layer for Allura Agent-OS

---

## Project Goal

Build a unified AI engineering brain that provides persistent, governed, auditable memory for multi-agent systems.

---

## Scope

### In Scope

1. **PostgreSQL Layer** — Raw append-only event traces
2. **Neo4j Layer** — Curated/versioned knowledge graph
3. **MCP Integration** — Tool protocol for agent interactions
4. **Tenant Isolation** — `group_id` enforcement on all operations
5. **HITL Governance** — Human approval workflows
6. **Notion Mirroring** — Human workspace synchronization

### Out of Scope

1. **Agent Development** — Agents are separate (OpenCode, OpenClaw)
2. **UI Development** — Paperclip dashboard is separate project
3. **Cloud Hosting** — Self-hosted only
4. **PII Storage** — Sensitive data excluded from memory

---

## Stakeholders

| Role | Name | Responsibility |
|------|------|----------------|
| Founder | Sabir Asheed | Product owner, architecture decisions |
| Architect | Winston (AI) | System design, ADR authoring |
| Builder | Amelia (AI) | Implementation |
| QA | Quinn (AI) | Test coverage, validation |

---

## Success Criteria

| Criterion | Target |
|-----------|--------|
| Memory persistence | 100% recovery after restart |
| Tenant isolation | Zero cross-tenant leakage |
| Audit trail | 6-12 month reconstruction |
| First workflow | Bank-auditor live |

---

## Constraints

### Technical

- TypeScript 5.9 strict mode
- Bun runtime
- Docker-only execution (except OpenClaw)
- PostgreSQL 16 + Neo4j 5.26
- Next.js 16 + React 19

### Organizational

- Single developer (Sabir) with AI assistance
- Self-hosted infrastructure
- No external cloud dependencies

### Regulatory

- GLBA for bank audits
- HACCP for food safety
- 501(c)(3) rules for nonprofit

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| TypeScript strict | Type safety for memory operations |
| Bun runtime | Faster than Node for scripts |
| Docker execution | Isolation, reproducibility |
| PostgreSQL + Neo4j | Raw events + curated knowledge |
| `group_id` isolation | Multi-tenant separation |
| HITL approval | Governance requirement |

---

## Timeline

### Phase 1: Foundation (Current)

**Epic 1: Persistent Knowledge Capture**
- Fix `groupIdEnforcer.ts` (ARCH-001)
- Record raw execution traces
- Implement tenant isolation

### Phase 2: Curation

**Epic 2: Knowledge Promotion**
- Curator agent implementation
- Neo4j promotion workflow
- HITL approval queue

### Phase 3: Integration

**Epic 3: Notion Mirroring**
- Sync promoted knowledge to Notion
- Human workspace integration
- Approval workflow

### Phase 4: Scale

**Epic 4+: Multi-Workspaces**
- Faith Meats CMS
- Creative Studio
- Personal Assistant
- Nonprofit
- Bank Audits
- HACCP

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| PostgreSQL 16 | Infrastructure | ✅ Available |
| Neo4j 5.26 + APOC | Infrastructure | ✅ Available |
| Docker | Infrastructure | ✅ Available |
| OpenCode | Framework | ✅ Available |
| MCP Tools | Integration | ✅ Available |
| Notion API | Integration | ✅ Available |

---

## Risks

See `memory-bank/productContext.md` Risks section.

---

## Related Documents

- `_bmad-output/planning-artifacts/prd-v2.md` — Product Requirements Document
- `_bmad-output/planning-artifacts/architectural-brief.md` — Architecture details
- `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md` — Isolation rules
- `_bmad-output/planning-artifacts/source-of-truth.md` — Document hierarchy