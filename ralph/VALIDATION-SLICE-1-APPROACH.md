# RalphLoop Validation Slice 1 — Brooksian Approach

**Date**: 2026-04-11
**Status**: Ready for execution

---

## Why This Approach

### ✅ Right Use of RalphLoop

This validation slice is **perfect** for RalphLoop because:

1. **Bounded Task**
   - Clear scope: Verify one endpoint in two modes
   - Clear success criteria: UUID match, numeric IDs
   - Clear completion: All three features pass

2. **Small Surface Area**
   - One endpoint: POST /api/memory
   - Two modes: auto and soc2
   - Three features: auto validation, soc2 validation, evidence collection

3. **Fast Feedback**
   - curl commands return immediately
   - DB queries are simple SELECTs
   - Results are binary: PASS or FAIL

4. **Low Architectural Risk**
   - No schema changes
   - No architecture decisions
   - Validation only, not implementation

### ❌ Wrong Use of RalphLoop

Do NOT hand RalphLoop the whole v1 recovery:

- ❌ Schema repair (architectural)
- ❌ MCP isolation (architectural)
- ❌ Dashboard (multi-component)
- ❌ CI pipeline (infrastructure)
- ❌ Documentation (creative)
- ❌ Full test suite (too large)

**Why not?** These invite the **second-system effect** and muddy causality.

---

## Brooksian Principles Applied

### 1. Conceptual Integrity
- **I define the slice** (architect)
- **Ralph executes within that slice** (toolsmith)
- **We inspect the result** (validation)
- **Then move to next slice** (incremental)

### 2. Surgical Team
- **Brooks (Architect)**: Defines validation slice
- **RalphLoop (Toolsmith)**: Executes bounded task
- **Human**: Inspects results, decides next slice

### 3. Separation of Concerns
- **Architecture**: Human defines what to validate
- **Implementation**: RalphLoop executes validation
- **Judgment**: Human interprets results

### 4. No Silver Bullet
- RalphLoop doesn't solve the essential complexity
- It only automates the accidental (retries, loops)
- Human still defines the slice and interprets results

---

## The Ratchet Approach

Think of RalphLoop as a **ratchet**, not a general contractor:

```
Slice 1: Validate canonical API
  ↓
RalphLoop executes
  ↓
Human inspects
  ↓
Slice 2: Validate kernel routing
  ↓
RalphLoop executes
  ↓
Human inspects
  ↓
... (one slice at a time)
```

Each slice is:
- Bounded
- Testable
- Low risk
- Fast feedback

---

## Expected Results

### Feature V1-1 (auto mode)
```
PASS:
- curl returns 200 with UUID
- PostgreSQL has events row
- metadata.memory_id matches UUID
- events.id is numeric
```

### Feature V1-2 (soc2 mode)
```
PASS:
- curl returns 200 with UUID
- PostgreSQL has events row
- metadata.memory_id matches UUID
- events.id is numeric
- trace_ref is numeric (BIGINT)
```

### Feature V1-3 (evidence)
```
PASS:
- All events counted
- All memory_ids listed
- All trace_refs listed
- Neo4j nodes (if any) listed
```

---

## How to Run

```bash
# Execute validation slice
./ralph/run-validation-slice-1.sh

# Monitor from another terminal
ralph --status

# Check results
cat ralph/validation-slice-1.json | jq '.features[] | {id, passes}'
```

---

## Next Slices (After This One)

If Slice 1 passes, next slices could be:

1. **Slice 2**: Validate kernel routing (soc2 mode only)
2. **Slice 3**: Validate Neo4j write path
3. **Slice 4**: Validate Notion sync
4. **Slice 5**: Validate curator promotion

Each slice is **bounded**, **testable**, and **low risk**.

---

## Key Insight

> **RalphLoop is a toolsmith's ratchet, not the architect.**

- I define the slice
- Ralph executes/retries within that slice
- We inspect the result
- Then move to the next slice

This preserves conceptual integrity while automating the tedious parts.

---

## See Also

- [Ralph Integration Contract](../.opencode/contracts/ralph-integration.md)
- [Brooksian Surgical Team](../.claude/rules/agent-routing.md)
- [Harness Contract](../.opencode/contracts/harness-v1.md)