# Story 6-2: Faith Meats Operations Workflow

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with AI assistance.
> When in doubt, defer to code, schemas, and team consensus.

---

## Goal

Implement production workflow for Faith Meats meat subscription service including automated order processing, inventory tracking, and customer communication via Paperclip dashboard.

---

## Acceptance Criteria

- [ ] Order processing workflow handles new subscriptions, renewals, and cancellations
- [ ] Inventory tracking updates available stock on order creation/cancellation
- [ ] Customer communication triggers on order status changes (created, shipped, delivered)
- [ ] Workflow logs all state transitions to PostgreSQL with group_id enforcement
- [ ] Neo4j knowledge graph tracks customer → order → product relationships

---

## Key Decisions

**Decision 1:** Use Paperclip dashboard for all customer-facing operations
- Rationale: Faith Meats is one of several Paperclip workspaces; dashboard already provides HITL approval gates

**Decision 2:** Store orders in PostgreSQL, relationships in Neo4j
- Rationale: Dual-database architecture — PostgreSQL for transactional traces, Neo4j for curated knowledge

**Decision 3:** Enforce `group_id: allura-faith-meats` on all database operations
- Rationale: Tenant isolation is mandatory; enforced via EnforcedMcpClient wrapper

---

## Implementation Notes

### Architecture Context

Faith Meats is the first production workspace under Epic 6: Production Workflows. It demonstrates:
- End-to-end workflow from order creation to delivery
- Human-in-the-loop governance for state transitions
- Memory system integration (traces → promoted insights)

### Key Patterns

```
Order State Machine:
  created → processing → shipped → delivered
             ↓
           cancelled

All state transitions logged to:
  - PostgreSQL: events table (append-only traces)
  - Neo4j: Order state nodes with SUPERSEDES chain
```

### Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/workflows/faith-meats/order-workflow.ts` | Order state machine |
| `src/workflows/faith-meats/inventory-tracker.ts` | Stock management |
| `src/workflows/faith-meats/customer-notify.ts` | Communication triggers |
| `src/lib/mcp/enforced-client.ts` | group_id enforcement (exists) |

### Integration Points

| System | Method | Notes |
|--------|--------|-------|
| Paperclip Dashboard | HITL approval | Human promotion gate |
| PostgreSQL | MCP_DOCKER | Event logging |
| Neo4j | MCP_DOCKER | Knowledge graph |

---

## Evidence

| Item | Value |
|------|-------|
| Commit | `{pending}` |
| Tests | `{pending}` |
| Files | `{pending}` |
| PostgreSQL Event ID | `{pending}` |
| Neo4j Node | `{pending}` |

---

## Traceability

**Epic:** Epic 6 — Production Workflows
**Story ID:** 6-2-faith-meats-operations
**Status:** `backlog`
**Updated:** 2026-04-06

**Source of Truth:**
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Memory context: `memory-bank/activeContext.md`

---

## Documentation Tier

| Tier | Applies When |
|------|--------------|
| **Story Card** | ✅ This story (days, single workspace) |
| Architecture Decision | Cross-cutting decision needed |
| Full PROJECT.md | Major initiative (weeks) |

This story uses **Story Card** documentation. Full PROJECT.md not required.

---

*Last Updated: 2026-04-06*