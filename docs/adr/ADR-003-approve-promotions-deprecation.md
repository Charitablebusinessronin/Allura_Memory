# ADR-003: Deprecation of approvePromotions() Legacy Path

**Status**: Active
**Date**: 2026-04-12
**Decision Maker**: brooks-architect

## Context

The curator pipeline has two approval paths:
1. **Canonical**: `POST /api/curator/approve` — the single operational door. Validates group_id, creates Neo4j insights with SUPERSEDES, emits notion_sync_pending events, and writes witness_hash.
2. **Legacy**: `approvePromotions()` in `src/curator/index.ts` — the pre-API path that directly modifies canonical_proposals without Notion sync or witness auditing.

Having two paths creates divergence risk. The legacy path is already hard-blocked (throws `DeprecatedApprovalPathError` unless env flags are set), but the code still exists and the deprecation timeline is not documented.

## Decision

**`approvePromotions()` will be REMOVED in v1.1 (target: 2026-05-01).**

Until removal:
- `approvePromotions()` throws `DeprecatedApprovalPathError` in all non-migration contexts
- `MIGRATION_MODE=true` is the ONLY env flag that allows execution (documented for migration use only)
- `DEBUG_LEGACY=true` allows execution in development (documented, NOT for production)
- All approval operations MUST go through `POST /api/curator/approve`

## Timeline

| Date | Action |
|------|--------|
| 2026-04-12 | ADR-003 published, deprecation documented |
| 2026-04-19 | Remove `MIGRATION_MODE` env flag acceptance (hard block everywhere) |
| 2026-04-26 | Remove `approvePromotions()` function from `src/curator/index.ts` |
| 2026-05-01 | v1.1 release — `approvePromotions()` no longer exists |

## Consequences

### Positive
- Single approval path preserves conceptual integrity
- No divergence risk between API and function-level approval
- Clear audit trail via notion_sync_pending events and witness_hash

### Negative
- Any code still calling `approvePromotions()` directly will break at removal
- Migration from legacy to canonical path requires env flag temporarily

## References

- Issue #17: https://github.com/Charitablebusinessronin/Allura_Memory/issues/17
- `src/curator/index.ts` — deprecated function location
- `src/app/api/curator/approve/route.ts` — canonical approval path
- ADR-002: Autonomous Curator Agent