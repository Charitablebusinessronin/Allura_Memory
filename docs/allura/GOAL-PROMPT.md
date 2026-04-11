# Goal Prompt — Allura v1 Unification

**Date**: 2026-04-10
**Status**: ✅ COMPLETE
**Architect**: Frederick P. Brooks Jr.

---

## Mission

Fix, clean, simplify, and validate the Allura memory system so that it matches the canonical design in:
- `docs/allura/BLUEPRINT.md`
- `docs/allura/DESIGN-ALLURA.md`
- `docs/allura/REQUIREMENTS-MATRIX.md`
- `docs/allura/RISKS-AND-DECISIONS.md`
- `docs/allura/SOLUTION-ARCHITECTURE.md`

---

## Primary Objective

Deliver one coherent Allura v1, not several partial systems.

That means:
1. **Unify the interface** around the canonical 5 operations:
   - `memory_add`
   - `memory_search`
   - `memory_get`
   - `memory_list`
   - `memory_delete`

2. **Ensure storage behavior matches architecture**
   - PostgreSQL is append-only episodic truth
   - Neo4j is curated semantic memory
   - `group_id` is enforced everywhere
   - promotion is deduped and governed
   - `PROMOTION_MODE=soc2` blocks autonomous semantic writes
   - semantic updates use versioning / SUPERSEDES, not ad hoc mutation

3. **Repair missing or broken interfaces**
   - Implement missing REST endpoints used by UI
   - Align MCP tools and REST routes to the same domain contracts
   - Remove or quarantine obsolete/duplicate/ADAS-era interfaces from the critical path

4. **Split the UX correctly**
   - `/memory` = consumer memory viewer per `DESIGN-ALLURA.md`
   - `/curator` = governance / approval workflow
   - do not leave admin-tab scaffolding as the primary user experience

5. **Validate the finished slice**
   - types compile
   - lint passes
   - relevant tests pass
   - add regression tests for canonical flows
   - ensure UI no longer calls nonexistent endpoints
   - ensure docs and implementation no longer contradict each other on the v1 path

---

## Non-Negotiable Constraints

- **Preserve conceptual integrity**
- **Prefer fewer interfaces, stronger contracts**
- **Remove accidental complexity where possible**
- **Do not add new product scope**
- **Do not invent alternate pipelines if one canonical one will do**
- **Do not keep legacy interfaces alive unless they are required for current behavior**
- **Keep changes incremental and reviewable**

---

## Required Work Sequence

### Phase 1 — Contract First
Define the canonical request/response contracts for:
- add
- search
- get
- list
- delete
- proposal queue actions if required for v1 governance

### Phase 2 — Backend Unification
Refactor MCP and REST around those contracts.

### Phase 3 — Governed Promotion Path
Make the write flow canonical:
- write episodic record first
- score
- threshold decision
- auto promote or SOC2 queue
- dedup before Neo4j write
- log failures correctly

### Phase 4 — UI Correction
Rebuild `/memory` to match the design spec.
Move governance workflow to `/curator`.

### Phase 5 — Cleanup
Remove or isolate obsolete paths, placeholders, and drift-inducing code.

### Phase 6 — Validation
Run:
- typecheck
- lint
- targeted tests
- full relevant test suite

Add missing tests for:
- add
- search
- get
- list
- delete
- queue
- approve/reject
- tenant isolation
- promotion-mode behavior

---

## Deliverables

Return:
1. What was changed
2. What architectural drift was removed
3. What remains intentionally deferred
4. Validation results
5. Any blockers requiring architectural decision

---

## Definition of Done

Done means:
- one canonical Allura v1 flow exists
- UI, REST, MCP, and storage agree on it
- `/memory` and `/curator` match their intended roles
- missing routes are implemented
- append-only and tenant isolation invariants hold
- promotion governance works
- tests prove the critical path

---

## Final Instruction

If you encounter multiple possible approaches, choose the one that:
- reduces interfaces,
- strengthens contracts,
- removes duplicate concepts,
- and best preserves conceptual integrity.

Do not optimize for cleverness. Optimize for coherence.

---

## 📝 Reflection

├─ Action Taken: Wrote a goal prompt to unify, clean, fix, and validate Allura v1
├─ Principle Applied: Fewer Interfaces, Stronger Contracts
└─ Confidence: High