# Fix ADR Duplicate Key Issue: Implementation Tasks

> Status: Ready for implementation  
> Created from: docs/fix-adr-duplicate-key.md migration

---

## Overview

This task list tracks the implementation of fixes for the ADR duplicate key constraint violation issue. The Curator Agent fails when logging Agent Decision Records to PostgreSQL due to duplicate `adr_id` values.

**Error:** `duplicate key value violates unique constraint "agent_decision_records_adr_id_key"`

See [BLUEPRINT.md](BLUEPRINT.md) for full system design.

---

## Must Have

### [ ] T1: Investigate ID generation collision mechanism

**Priority:** P0 — Blocking  
**Description:** Review `generateId()` implementation in `src/lib/adr/types.ts` to understand the collision mechanism  
**File:** `src/lib/adr/types.ts`  

**Acceptance criteria:**
- [ ] Document current ID format and collision scenarios
- [ ] Identify why collisions occur (same millisecond + same random)
- [ ] Understand the relationship between `Math.random()` and collision probability

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §1 Core Concepts, [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) AD-02

---

### [ ] T2: Add uniqueness check before insert

**Priority:** P0 — Blocking  
**Description:** Before inserting an ADR, check if the ID already exists in PostgreSQL  
**File:** `src/lib/adr/capture.ts` (around line 314-322)  

**Current code:**
```typescript
async beginDecision(options: ADRCreationOptions): Promise<string> {
  const adrId = generateId("adr");
  // ... rest of implementation
  await this.storage.save(adr);
  return adrId;
}
```

**Target code:**
```typescript
async beginDecision(options: ADRCreationOptions): Promise<string> {
  let adrId = generateId("adr");
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    const existing = await this.storage.findById(adrId);
    if (!existing) break;
    adrId = generateId("adr");
    attempts++;
  }
  
  // ... rest of implementation
  await this.storage.save(adr);
  return adrId;
}
```

**Acceptance criteria:**
- [ ] Code calls `findById()` before `save()`
- [ ] Loop regenerates ID if exists (max 3 attempts)
- [ ] Warning log on each retry attempt
- [ ] No TypeScript errors (`npm run typecheck` passes)

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §6 "Uniqueness Check", [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) AD-01

---

### [ ] T3: Add retry logic on duplicate key error

**Priority:** P0 — Blocking  
**Description:** Wrap ADR insert in try-catch with retry logic for duplicate key constraint violations  
**File:** `src/curator/curator.service.ts` (around lines 223-236)  

**Acceptance criteria:**
- [ ] Try-catch around ADR logging in curator
- [ ] On duplicate key error: wait 10ms, regenerate ID, retry
- [ ] Maximum 3 retry attempts
- [ ] Fatal error if max retries exceeded
- [ ] Log retry attempts at warning level

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §6 "Retry Logic", [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) RK-02

---

### [ ] T4: Add counter entropy to ID generation

**Priority:** P0 — Blocking  
**Description:** Include additional entropy (counter) in ID generation to eliminate same-millisecond collisions  
**File:** `src/lib/adr/types.ts`  

**Target code:**
```typescript
export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const counter = (generateId as any)._counter = ((generateId as any)._counter || 0) + 1;
  return `${prefix}_${random}_${timestamp}_${counter}`;
}
```

**Acceptance criteria:**
- [ ] Counter increments on each `generateId()` call
- [ ] Counter is module-level singleton
- [ ] IDs have format: `adr_random_timestamp_counter`
- [ ] Existing ID parsing still works for old IDs
- [ ] 1000 sequential calls produce 1000 unique IDs (verified by test)

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §6 "ID Generation", [DATA-DICTIONARY.md](DATA-DICTIONARY.md) §ID Generation Format, [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) AD-02

---

## Should Have

### [ ] T5: Unit tests for ID generation uniqueness

**Priority:** P1  
**Description:** Add unit test to verify ID uniqueness across multiple calls  
**File:** New or existing test file for `src/lib/adr/types.ts`  

**Test code:**
```typescript
describe("ADR ID generation", () => {
  it("should generate unique IDs across multiple calls", async () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      const id = generateId("adr");
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });
});
```

**Acceptance criteria:**
- [ ] Test passes with new ID generation
- [ ] Test detects collisions if entropy is removed
- [ ] Included in test suite (`npm test` passes)

---

### [ ] T6: Integration test for curator ADR logging

**Priority:** P1  
**Description:** Run curator multiple times to verify no duplicate key errors  

**Test script:**
```bash
# Run curator 5 times
for i in {1..5}; do
  echo "Run $i..."
  bun run curator:run
done

# Verify no duplicate key errors in logs
grep -i "duplicate key" logs/curator.log && echo "FAIL: Found duplicate key errors" || echo "PASS: No duplicate key errors"
```

**Acceptance criteria:**
- [ ] 5 consecutive curator runs complete without ADR errors
- [ ] No "duplicate key" messages in logs
- [ ] All ADRs successfully created in PostgreSQL

---

## Done

_(None yet — implementation pending)_

---

## Definition of Done

For each task to be marked complete:
1. All acceptance criteria met
2. Code reviewed (if applicable)
3. Tests added/updated and passing
4. `npm run typecheck` passes
5. No regression in existing curator functionality

---

## Dependencies

```
T1 (Investigate)
└── Blocks: T4 (requires understanding of collision mechanism)

T4 (ID entropy)
└── Blocks: T2 (uniqueness check less critical with entropy)

T2 (Uniqueness check)
└── Blocks: T3 (retry logic complements pre-check)

T3 (Retry logic)
└── Blocks: T6 (integration test validates the fix)
```

---

## References

- [BLUEPRINT.md](BLUEPRINT.md) — Full system design
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) — Architectural decisions and risks
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) — Requirements traceability
- `src/lib/adr/types.ts` — ID generation
- `src/lib/adr/capture.ts` — ADR capture and storage
- `src/curator/curator.service.ts` — Curator integration
