# AD-003: ARCH-001 — groupIdEnforcer Enforced at All Entry Points

| Field        | Value                                              |
|-------------c|----------------------------------------------------|
| ID          | AD-003                                             |
| Status      | Accepted                                           |
| Date        | 2026-04-12                                         |
| Author      | opencode (brooks-architect)                        |
| References  | ARCH-001, Issue #7, F6, F10, B2                   |

## Context

ARCH-001 identified that `groupIdEnforcer.ts` was not consistently enforcing the `^allura-[a-z0-9-]+$` pattern across all entry points. Several code paths accepted `group_id` without full validation, allowing potential tenant isolation bypass:

1. **`src/lib/validation/group-id.ts`** — The canonical `validateGroupId()` validated format (lowercase, length, characters) but did **NOT** enforce the `allura-` prefix. Its pattern was `/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/`, accepting IDs like `my-project`, `global`, etc.

2. **`src/mcp/canonical-tools.ts`** — Had a **local duplicate** `validateGroupId()` that enforced `^allura-`, shadowing the canonical import. This meant the canonical module's validator was inconsistent with the MCP tool validator.

3. **`src/mcp/legacy/memory-server.ts`** — Had its **own** local `validateGroupId()` with yet another regex, creating a third enforcement point that could drift.

4. **REST API routes** (`/api/memory/route.ts`, `/api/memory/[id]/route.ts`) — Cast `group_id` as `GroupId` type without validation, relying solely on downstream `canonical-tools.ts` validation.

5. **Curator routes** (`/api/curator/approve/route.ts`, `/api/curator/proposals/route.ts`) — Only checked `group_id.startsWith("allura-")`, missing full regex validation (could allow `allura- INVALID` with spaces or special chars).

## Decision

### 1. Canonical `validateGroupId` now enforces `^allura-` prefix

Changed `GROUP_ID_RULES.PATTERN` from `/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/` to `/^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/`.

This regex enforces:
- Must start with `allura-`
- Must end with alphanumeric (no trailing hyphens)
- Only lowercase letters, digits, and hyphens in the suffix
- No underscores (ARCH-001: underscores removed from tenant IDs)

Updated `RESERVED_GROUP_IDS` from `["global", "system", "admin", "public"]` to `["allura-global", "allura-system", "allura-admin", "allura-public"]` — reserved IDs now use the allura- prefix.

### 2. Removed duplicate validators

- **`src/mcp/canonical-tools.ts`** — Replaced local `validateGroupId()` with a thin wrapper that delegates to `canonicalValidateGroupId()` from `@/lib/validation/group-id`.
- **`src/mcp/legacy/memory-server.ts`** — Replaced local `validateGroupId()` with import from `@/lib/validation/group-id`.

### 3. REST API routes now validate at the boundary

- **`/api/memory/route.ts`** — Added `validateGroupId()` + `GroupIdValidationError` handling for both GET and POST.
- **`/api/memory/[id]/route.ts`** — Added `validateGroupId()` + `GroupIdValidationError` handling for GET and DELETE.
- **`/api/curator/approve/route.ts`** — Replaced `group_id.startsWith("allura-")` with `validateGroupId()`.
- **`/api/curator/proposals/route.ts`** — Replaced `group_id.startsWith("allura-")` with `validateGroupId()`.
- **`/api/curator/watchdog/route.ts`** — Replaced local `GROUP_ID_RE` regex with `validateGroupId()`.

### 4. `EnforcedMcpClient` simplified

Removed the separate `validateAlluraPrefix()` function since `validateGroupId()` now enforces the prefix. The constructor simply calls `validateGroupId(groupId)` — single validation point.

### 5. `validateGroupIdWithRules` updated for uppercase handling

When `allowUppercase` is true, the pattern check now tests the lowercase variant to avoid false negatives (e.g., `ALLURA-GLOBAL` is valid with `allowUppercase`).

### 6. `KernelTenantEnforcer` and `tenant.ts` updated

Removed the redundant `validateAlluraPrefix()` + `validateGroupId()` two-step in `validateTenantIsolation()`. Now it simply delegates to `validateGroupId()`.

## Entry Points Covered

| Entry Point                         | Before                          | After                              |
|-------------------------------------|---------------------------------|-------------------------------------|
| `validateGroupId()` (canonical)     | No `^allura-` prefix check      | Enforces `^allura-[a-z0-9-]+$`     |
| `canonical-tools.ts` validateGroupId | Local duplicate with allura-   | Delegates to canonical             |
| `memory-server.ts` validateGroupId  | Local duplicate with allura-   | Delegates to canonical             |
| `/api/memory` (GET, POST)           | No validation at API layer     | `validateGroupId()` at boundary    |
| `/api/memory/[id]` (GET, DELETE)    | No validation at API layer     | `validateGroupId()` at boundary    |
| `/api/curator/approve`              | `startsWith("allura-")` only    | Full `validateGroupId()`            |
| `/api/curator/proposals`            | `startsWith("allura-")` only    | Full `validateGroupId()`            |
| `/api/curator/watchdog`             | Local `GROUP_ID_RE` regex       | `validateGroupId()`                 |
| `EnforcedMcpClient`                 | Two-step validation             | Single `validateGroupId()` call     |
| `KernelTenantEnforcer`              | Two-step validation             | Single `validateGroupId()` call     |
| Legacy MCP tools (Zod schemas)      | `^allura-[a-z0-9-]+$`           | `^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` (no trailing hyphens) |

## Consequences

- **Positive:** No code path can reach DB operations with an invalid `group_id`. Tenant isolation is enforced at every entry point.
- **Positive:** Single canonical validation function eliminates drift between enforcement points.
- **Positive:** Trailing hyphens in `group_id` are now rejected (e.g., `allura-project-` is invalid).
- **Negative:** Any existing data with non-allura-prefixed `group_id` values will be flagged as invalid by governance tools. These must be migrated or archived.
- **Negative:** Underscores are no longer valid in `group_id` (removed from pattern). This is intentional for tenant isolation consistency.

## Migration Notes

Existing non-allura-prefixed group IDs (e.g., `roninmemory`, `my-project`) need to be migrated to `allura-` prefixed format before they can be used with the updated enforcement. The governance report (`group-governance.ts`) uses `validateGroupId()` to flag these as `is_valid: false`.