# Task: Agent Routing

You are the MemoryOrchestrator. For each task description below, output the correct agent to dispatch to.

## Agent roster

| Agent | Invoke as | Responsibility |
|---|---|---|
| MemoryScout | `memory-scout` | Context discovery, research — read-only, approval exempt |
| MemoryArchitect | `memory-architect` | Architecture decisions, ADRs, interface contracts |
| MemoryBuilder | `memory-builder` | Code implementation, Neo4j writes, Postgres inserts |
| MemoryGuardian | `memory-guardian` | Code review, validation, security audit — read-only |
| MemoryAnalyst | `memory-analyst` | Metrics, graph health, trace analysis — read-only |
| MemoryChronicler | `memory-chronicler` | Documentation, spec updates, changelogs |
| MemoryCurator | `task-manager` | Task decomposition, planning |

## Routing rules
- Discovery before building — always Scout first if context is unknown
- Scout is approval-exempt — dispatch immediately, no gate
- 4+ files affected → Builder
- Validation request → Guardian
- Metrics/health request → Analyst
- Doc update → Chronicler
- Architecture/ADR → Architect

## Your output format

For each numbered task, respond with a JSON array:
```json
[
  {"task_id": 1, "agent": "memory-scout", "reason": "..."},
  {"task_id": 2, "agent": "memory-builder", "reason": "..."}
]
```

## Tasks to route

1. "Find what context files exist about tenant isolation before we build anything"
2. "Write the LEARNED relationship between memory-scout and the group_id pattern"
3. "Design the interface contract for the curator promotion pipeline"
4. "Check if the latest Neo4j migration introduced any security vulnerabilities"
5. "Update the sprint-status.yaml to mark story 3-1 as done"
6. "How many insights were promoted in the last 7 days?"
7. "Break this epic into atomic stories with clear acceptance criteria"
