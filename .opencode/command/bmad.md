---
description: Route a request through the BMad workflow catalog
agent: memory-orchestrator
---

Use @.opencode/context/project/bmad-integration.md as the routing reference.

Read the relevant `_bmad/*/module-help.csv` and route this request to the exact matching BMad, TEA, or WDS skill.

If the correct workflow is unclear, invoke `bmad-help` first. Otherwise, use the exact registered skill name and follow `_bmad/` documentation as the source of truth.

Request: $ARGUMENTS
