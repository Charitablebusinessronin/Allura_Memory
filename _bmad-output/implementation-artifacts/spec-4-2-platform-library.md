---
title: 'Story 4-2: Platform Library'
type: 'feature'
created: '2026-04-06'
status: 'in-progress'
baseline_commit: '692fb42d9d71eb49f85f476499219923cd75e452'
context:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architectural-brief.md'
  - 'memory-bank/techContext.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Organizations cannot share sanitized knowledge with each other. Each tenant operates in isolation, unable to benefit from insights validated across the platform. This limits collective intelligence and requires redundant work.

**Approach:** Create a platform-wide knowledge library (`platform_insights` table with `group_id: 'allura-platform'`) that stores curated, sanitized insights. Implement a search interface for cross-organization discovery, version control for knowledge evolution, and adoption metrics to track usage.

## Boundaries & Constraints

**Always:**
- Use `group_id: 'allura-platform'` for all platform library records (enforced by Steel Frame)
- Follow append-only semantics for PostgreSQL (never mutate historical rows)
- Use SUPERSEDES pattern for versioning in Neo4j
- Validate all platform insights are sanitized before insertion (no tenant-specific data leaks)
- Enforce HITL approval before promotion to platform library
- Use existing `EnforcedMcpClient` for all database operations

**Ask First:**
- None (boundaries are clear)

**Never:**
- Store tenant-specific data in platform library
- Allow agent-promoted insights without human approval
- Delete or mutate platform library records
- Bypass group_id enforcement for platform operations

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Publish insight to platform | Curated insight with `allura-platform` group_id | New record in `platform_insights` table | Reject if missing required fields |
| Search platform library | Query string + filters | Matching insights ranked by adoption | Empty results if no matches |
| Version update | New insight superseding old | SUPERSEDES relationship in Neo4j, new version in PG | Preserve old version immutable |
| Track adoption | Agent references platform insight | Increment `adoption_count` | Create adoption record |
| Unauthorized access | Request without valid group_id | 403 Forbidden | Log security event |

</frozen-after-approval>

## Code Map

- `postgres-init/07-platform-library.sql` -- Schema for `platform_insights` table
- `src/lib/platform/types.ts` -- TypeScript interfaces for platform library
- `src/lib/platform/library.ts` -- Core PlatformLibrary class with CRUD operations
- `src/app/(main)/dashboard/platform-library/page.tsx` -- UI page for platform library

## Tasks & Acceptance

**Execution:**
- [ ] `postgres-init/07-platform-library.sql` -- Create `platform_insights` table with `group_id: 'allura-platform'`, versioning, and adoption metrics
- [ ] `src/lib/platform/types.ts` -- Define PlatformInsight, InsightVersion, AdoptionMetrics interfaces
- [ ] `src/lib/platform/library.ts` -- Implement PlatformLibrary class with publish(), search(), trackAdoption(), getVersionHistory()
- [ ] `src/app/(main)/dashboard/platform-library/page.tsx` -- Create search interface UI with version display and adoption metrics

**Acceptance Criteria:**
- Given a sanitized insight, when published to platform library, then stored with `group_id: 'allura-platform'` and searchable
- Given a platform library search query, when executed, then returns ranked results with adoption metrics
- Given a new insight version, when updated, then SUPERSEDES relationship created in Neo4j and old version preserved
- Given an insight reference, when tracked, then adoption metrics incremented
- Given unauthorized access attempt, when accessing platform library, then returns 403 and logs security event

## Spec Change Log

## Design Notes

**Database Schema:**
```sql
-- Platform Insights: Curated, sanitized knowledge shared across organizations
CREATE TABLE platform_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL DEFAULT 'allura-platform',
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  source_org VARCHAR(255), -- Anonymized organization identifier
  confidence_score DECIMAL(3,2),
  adoption_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  supersedes_id UUID REFERENCES platform_insights(id),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Design Decisions:**
1. `group_id` hard-coded to `'allura-platform'` for all platform records
2. `source_org` is anonymized to prevent tenant identification
3. `adoption_count` tracks how many times an insight is referenced
4. `version` + `supersedes_id` implements Steel Frame versioning
5. Insights require HITL approval (via `promotion_proposals`) before entering platform library

**Neo4j Integration:**
- Each platform insight creates an `Insight` node with `group_id: 'allura-platform'`
- Version updates create SUPERSEDES relationships
- Adoption metrics stored on node properties

## Verification

**Commands:**
- `bun run typecheck` -- expected: no TypeScript errors
- `bun run lint` -- expected: no lint errors
- `bun vitest run src/lib/platform/library.test.ts` -- expected: all tests pass

**Manual checks:**
- Verify `platform_insights` table created in PostgreSQL
- Verify `group_id: 'allura-platform'` enforced on all operations
- Verify search returns ranked results with adoption metrics
- Verify version history shows SUPERSEDES relationships