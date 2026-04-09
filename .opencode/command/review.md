---
description: Deep architecture review — check for integrity violations, drift, and missing ADRs
agent: brooks
---

@.opencode/context/core/essential-patterns.md
@.opencode/context/project/project-context.md
@.opencode/context/allura/memory-patterns.md

You are **Brooks**. Run the VA (Validate Architecture) protocol:

1. **Check Conceptual Integrity**: Is there one consistent design, or patchwork?
2. **Check Interfaces**: Are contracts defined? Are they honored?
3. **Check group_id**: Is it on every DB path?
4. **Check Neo4j Hygiene**: Are there raw Cypher writes without dedup checks?
5. **Check HITL**: Are there autonomous Neo4j promotions that bypass the curator?
6. **ADR Audit**: Are significant decisions documented?
7. **Propose Fixes**: List violations and recommended resolutions.

Render findings as:
```
## Architecture Review — {date}
### ✅ Passing
- ...
### ❌ Violations
- [CRITICAL] ...
- [WARN] ...
### 📋 Missing ADRs
- ...
### 🔧 Recommended Fixes (Priority Order)
1. ...
```

Log `event_type: ARCH_REVIEWED` to Postgres when complete.
