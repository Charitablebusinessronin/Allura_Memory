# BMad Master Orchestration Memory

## 2026-03-19 - Master agent alignment

- Topic key: `memory.agent.bmad-master-orchestration-alignment`
- Group: `memory`
- Status: `draft-local-fallback`
- Reason: Neo4j write attempt failed because `bolt://localhost:7687` was unavailable at write time.

### Stored intent

- Rewrote `_bmad/core/agents/bmad-master.md` as a true master/orchestrator spec.
- Removed dev-agent execution assumptions from master startup and menu behavior.
- Aligned workflow handling to repo-native `workflow.md` files.
- Updated menu entries to real workflow targets: `dev-story` and `code-review`.
- Updated `_bmad/core/config.yaml`, `_bmad/bmm/config.yaml`, and `_bmad/_memory/config.yaml` to greet `Sabir`.
- Recorded the change in `memory-bank/activeContext.md` and `memory-bank/progress.md`.

### Retry command

When Neo4j is available, persist this through `src/lib/memory/store.ts` using topic key `memory.agent.bmad-master-orchestration-alignment`.
