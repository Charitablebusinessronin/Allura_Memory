# OpenAgentsControl — Allura System Blueprint
## Architecture Pattern
This system adapts the **OpenAgentsControl (OAC)** plan-first development workflow within the **Allura Agent-OS** framework.

### The 6-Stage Workflow
1.  **Analyze**: Understand the requirements and constraints. (Prometheus)
2.  **Discover**: Map the existing codebase and context. (Explore)
3.  **Plan**: Create an implementation plan with task breakdowns. (Sisyphus)
4.  **Execute**: Implement the changes in small, atomic steps. (Hephaestus)
5.  **Validate**: Run tests and verify types. (Turing / Knuth)
6.  **Complete**: Final code review and documentation update. (Oracle / Brooks)

### Command Interface
- `/oac:plan` [topic]: Kickstart the workflow for a new feature.
- `/oac:status`: View current progress and bottlenecks.
- `/oac:add-context` [url]: Pull external documentation/data into memory.
- `/oac:setup`: Repair/Initialize the agent structure.

### Context Management
The system loads context through the `@` symbol, searching:
1.  `.opencode/context/*.md`
2.  `memory-bank/*.md`
3.  `docs/allura/*.md`
4.  Notion Memory (via `allura-memory` MCP)
