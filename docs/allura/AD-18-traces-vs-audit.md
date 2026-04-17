# AD-18: Traces vs Audit — Merge Duplicate Event Surfaces

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| **ID**         | AD-18                                                            |
| **Status**     | Proposed                                                         |
| **Date**       | 2026-04-17                                                       |
| **Author**     | WOZ_BUILDER                                                      |
| **Reviewers**  | _Pending — requires Brooks + Pike sign-off_                      |
| **Supersedes** | None                                                             |
| **Related**    | AD-01 (PostgreSQL for episodic memory), AD-08 (Soft-delete only) |

---

## Context

Two pages in the Paperclip UI currently present the same data:

| Route               | File                                       | Built    | Audience         | Presentation                                          |
| ------------------- | ------------------------------------------ | -------- | ---------------- | ----------------------------------------------------- |
| `/dashboard/traces` | `src/app/(main)/dashboard/traces/page.tsx` | Sprint 1 | Developer        | Raw event table, JSON metadata expand                 |
| `/dashboard/audit`  | `src/app/(main)/dashboard/audit/page.tsx`  | Sprint 2 | Operator / Admin | Grouped timeline, plain-English summaries, CSV export |

Both pages query **the same API endpoint** (`GET /api/audit/events`) against the **same PostgreSQL append-only trace table**. Neither page introduces new data — they are two read-only projections of the same rows.

### Why This Matters

1. **Conceptual drift.** Two names ("traces" and "audit") for one data source creates ambiguity about what each surface owns. Future features land in whichever page the developer happens to be looking at, leading to feature divergence.
2. **Wireframe spec divergence.** `DESIGN-ALLURA.md` §12 specifies the audit log at `/admin/audit` in the enterprise view — not `/dashboard/traces`, not `/dashboard/audit`. Neither current route matches the canon.
3. **Maintenance burden.** Filter logic, pagination, filter-option hydration, and status badge styling are duplicated across ~350 + ~490 lines. A bug fixed in one surface may not reach the other.
4. **Navigation confusion.** Users encountering both routes must mentally map which one to use. "Traces" implies distributed-system tracing (Opentelemetry); "Audit" implies compliance logging. Neither connotation is accurate — the data is simply _events_.

### Brooksian Principle

> "Conceptual integrity is the most important consideration in system design." — Frederick Brooks, _The Mythical Man-Month_

A system where two doors lead to the same room violates conceptual integrity. The user should see one concept — _the event stream_ — exposed through one primary surface.

---

## Decision

**Merge: `/dashboard/audit` becomes the single event viewer; `/dashboard/traces` is deprecated and removed.**

The audit page already subsumes every capability of the traces page and adds:

- Plain-English event summaries (`buildEventSummary`, `buildMetadataSummary`)
- Date-range filtering (`from` / `to` inputs)
- Grouped-by-day timeline view
- CSV export
- Durham design-system styling consistent with the rest of the Paperclip UI

The traces page offers nothing the audit page does not — except the word "traces" in the heading and a legacy table layout.

**Migration path:**

1. Add a redirect from `/dashboard/traces` → `/dashboard/audit` (Next.js `redirect()` in `page.tsx`).
2. Remove the traces `layout.tsx` metadata.
3. Add sidebar/nav entry update to remove "Traces" link.
4. In a later sprint, relocate audit to `/admin/audit` per the wireframe spec (AD-18-A, deferred).

---

## Options Considered

### Option A: Merge (recommended)

`/dashboard/audit` is the single event viewer. `/dashboard/traces` redirects or is deleted.

**Pros:**

- Eliminates conceptual duplication immediately.
- Audit page is strictly more capable — no functionality lost.
- Single maintenance surface for filters, pagination, styling.
- Aligns with the "audit trail" language already established in AD-01, AD-08, and BLUEPRINT.md.

**Cons:**

- Developers who bookmarked `/dashboard/traces` hit a redirect.
- "Audit" connotes compliance to some developers; they may expect a different data source.
- Does not yet address the wireframe spec's `/admin/audit` placement (requires separate route migration).

### Option B: Split — traces for developers, audit for operators

`/dashboard/traces` stays as a developer-focused raw-event debugger. `/dashboard/audit` is the operator-facing compliance view with plain English and export.

**Pros:**

- Each audience gets a tailored experience.
- Developers keep their fast "just show me the JSON" view.
- Audit page can evolve compliance features (signed exports, tamper evidence) without developer-tool concerns.

**Cons:**

- **Violates conceptual integrity.** Two names, one table — the core problem remains.
- Feature divergence risk: filter logic, pagination, and new columns drift between surfaces.
- Doubles maintenance: every schema change to the events table requires updating two pages.
- The "developer vs operator" persona split is not enforced by RBAC or routing — both pages are under `/dashboard/`, accessible to the same roles.
- The traces page's "raw JSON" view already exists in the audit page's expandable row.

### Option C: Unify into one page with a view toggle

Merge both into a single page at `/dashboard/events` (or `/admin/audit`) with a toggle: "Raw view" vs "Narrative view."

**Pros:**

- Single URL, single component tree.
- Toggle preserves both presentations without separate routes.
- Could be extended with future view modes (e.g., timeline, graph).

**Cons:**

- Most implementation effort — requires refactoring both pages into a single component with toggled rendering paths.
- The audit page already provides both: narrative by default, raw JSON on expand. The toggle would be redundant.
- Adds a UI control that must be tested, persisted (URL param? localStorage?), and maintained.
- Premature generalization — no third view mode has been requested.

---

## Consequences

### If Merge (Option A) Is Accepted

- `/dashboard/traces` becomes a redirect → `/dashboard/audit`. One file to delete, one file to convert.
- Single source of truth for event-UI features going forward.
- Future compliance features (signed exports, retention-policy display, SOC2 filtering) land in one place.
- Sidebar navigation simplifies: one "Audit Trail" entry instead of two.
- **Deferred work:** Route migration to `/admin/audit` (per wireframe spec) becomes a follow-up task, not blocked by this decision.

### If Split (Option B) Is Accepted

- Both pages continue to exist. Maintenance burden persists.
- Must define clear ownership: what features belong in traces vs audit. This decision will be needed again when the next feature request lands.
- RBAC scoping may become necessary to enforce the persona split — currently neither page is role-gated.

### If Unify with Toggle (Option C) Is Accepted

- Largest implementation effort.
- Risk of over-engineering: the audit page's expandable-row UX already serves both audiences without a toggle.
- Testing surface increases: toggle state, URL persistence, keyboard shortcuts, mobile responsive behavior for each mode.

---

## Rationale for Merge (Option A)

1. **The audit page strictly dominates the traces page.** Every feature in traces (event list, type/agent filters, pagination, expandable JSON) exists in audit, plus date-range filtering, grouped timeline, plain-English summaries, CSV export, and design-system consistency. No user loses capability.

2. **Conceptual integrity demands one concept per data source.** PostgreSQL has one events table. The UI should have one page for it. Two names for one table is the kind of ambiguity that compounds — today it's two pages; tomorrow it's two different filter semantics, two different pagination bugs, two different date formats.

3. **The word "audit" is already canonical.** AD-01 establishes PostgreSQL as the "audit trail." AD-08 is "Soft-delete only — audit trail." BLUEPRINT.md calls it "raw event log and audit trail." The traces page introduces a competing term that has no backing in the architecture.

4. **The wireframe spec places audit at `/admin/audit`.** Merging now makes the later route migration simpler — there is one page to move, not two. Option B would require deciding which page moves to `/admin/audit` and which is deleted, or moving both and maintaining the split at the new location.

5. **The expandable row in audit _is_ the "raw view."** Developers who want raw JSON can click any audit row and see the full JSON dump. Option C's toggle would add complexity for a view mode that already exists as an in-page interaction.

6. **Minimal blast radius.** The merge is: (a) redirect one route, (b) remove one layout file, (c) update sidebar. No shared components, no API changes, no database changes. If the team later decides the split was justified, the redirect can be removed and the traces page restored from git history.

---

## Open Questions

1. **Route placement:** Should `/dashboard/audit` move to `/admin/audit` now (per wireframe), or is that a separate AD? **Recommendation:** Separate. Route restructuring touches RBAC middleware and sidebar config — out of scope for this decision.
2. **Breadcrumb trail:** When a user arrives via the `/dashboard/traces` redirect, should the breadcrumb show "Audit Trail" or preserve "Traces"? **Recommendation:** Always show "Audit Trail" — preserve the single concept.

---

## References

- `DESIGN-ALLURA.md` §12 — Audit Log wireframe (`/admin/audit`)
- `RISKS-AND-DECISIONS.md` — AD-01 (PostgreSQL for episodic memory), AD-08 (Soft-delete only)
- `BLUEPRINT.md` — B12 (Enterprise admin audit log)
- `src/app/(main)/dashboard/traces/page.tsx` — 356 lines, raw table view
- `src/app/(main)/dashboard/audit/page.tsx` — 487 lines, narrative timeline + raw expand
- `src/app/api/audit/events/route.ts` — shared API endpoint
