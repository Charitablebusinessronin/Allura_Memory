# Skill Ownership Matrix

| Skill | Owner | Trigger | Required? | Overlaps With | Decision |
|-------|-------|---------|-----------|---------------|----------|
| roundtable | Brooks | Multi-agent discussion | ⬜ Overlay | party-mode | **Keep** — conversational multi-agent panel, complements execution-focused party-mode |
| allura-memory-skill | Scout | Any Brain operation | ✅ Yes | none | **Keep** — mandatory Brain governance |
| allura-approve-promotion | Brooks | HITL approval | ✅ Yes | allura-propose-promotion | **Keep** — promotion pipeline |
| allura-propose-promotion | Brooks | Memory promotion | ✅ Yes | allura-approve-promotion | **Keep** — promotion pipeline |
| allura-design | Durham agents | Brand/design tasks | ⬜ Overlay | huashu-design, figma-* | **Keep** — Allura-specific brand design |
| allura-graph-debug | Bellard | Neo4j debugging | ⬜ Overlay | none | **Keep** — Neo4j diagnostics |
| allura-health-observability | Hightower | Health checks | ⬜ Overlay | none | **Keep** — infra monitoring |
| allura-menu | All | Navigation | ⬜ Overlay | none | **Keep** — Brain menu system |
| bun-security | Hightower | Security audit | ⬜ Overlay | none | **Keep** — Bun security checks |
| code-review | Pike | Code review | ✅ Yes | none | **Keep** — review gate |
| context7 | Scout | Library docs | ✅ Yes | none | **Keep** — external context discovery |
| figma-code-connect | Woz | Figma→Code | ⬜ Overlay | figma-use, figma-implement | **Keep** — Figma integration |
| figma-create-new-file | Woz | Figma creation | ⬜ Overlay | none | **Keep** — Figma creation |
| figma-generate-design | Woz | Design generation | ⬜ Overlay | allura-design | **Keep** — Figma generation |
| figma-generate-library | Woz | Library generation | ⬜ Overlay | none | **Keep** — Figma library |
| figma-implement-design | Woz | Implementation | ⬜ Overlay | figma-code-connect | **Keep** — Figma implementation |
| figma-use | Woz | Figma inspection | ⬜ Overlay | none | **Keep** — Figma inspection |
| mcp-docker | All | MCP tool access | ✅ Yes | none | **Keep** — MCP gateway |
| mcp-docker-ops | Hightower | MCP server lifecycle | ✅ Yes | mcp-docker | **Keep** — skill-embedded MCP operations wrapper; does not replace canonical mcp-docker gateway |
| multi-search | Scout | Web search | ✅ Yes | context7 | **Keep** — search capability |
| perplexica-search | Scout | External web research | ⬜ Overlay | multi-search | **Keep** — self-hosted Perplexica research path |
| postgres-best-practices | Knuth | DB patterns | ⬜ Overlay | none | **Keep** — PostgreSQL guidance |
| brainstorming | Woz | Design exploration | ⬜ Overlay | frontend-design, allura-design | **Keep** — ideation and concept development before design |
| frontend-craft | Woz | Frontend engineering | ⬜ Overlay | frontend-design, impeccable | **Keep** — Brooksian frontend workflow, implementation companion |
| frontend-design | Woz | UI/UX design | ⬜ Overlay | brainstorming, huashu-design, impeccable | **Keep** — production-grade design for Next.js + Tailwind + ForceGraph2D |
| github | Pike | GitHub integration | ⬜ Overlay | code-review, mcp-docker | **Keep** — GitHub workflows, PRs, issues, secrets scanning |
| mcp-harness | Hightower | MCP orchestration | ⬜ Overlay | mcp-docker, mcp-docker-ops | **Keep** — MCP server discovery and governance |
| memory-client | Scout | Brain field guide | ⬜ Overlay | allura-memory-skill | **Keep** — agent-oriented Allura Brain usage patterns |
| party-mode | Brooks | Parallel dispatch | ⬜ Overlay | roundtable, mcp-harness | **Keep** — Team RAM surgical team coordination |
| quick-update | Scout | Doc sync | ⬜ Overlay | memory-client, allura-memory-skill | **Keep** — quick documentation updates from memory context |
| security-bluebook-builder | Pike | Security policy | ⬜ Overlay | code-review | **Keep** — threat model, auth, audit, retention policy |
| skill-creator | Brooks | Skill authoring | ⬜ Overlay | mcp-harness, skill-creator | **Keep** — skill creation and optimization workflow |
| systematic-debugging-memory | Bellard | Debugging + memory | ⬜ Overlay | memory-client, allura-memory-skill | **Keep** — 5-phase debugging with persistent knowledge |
| task-creator | Woz | Task generation | ⬜ Overlay | task-management | **Keep** — structured task creation with Brain integration |
| task-management | Woz | Task CLI | ⬜ Overlay | task-creator, memory-client | **Keep** — feature subtask tracking with memory linkage |
| varlock | Hightower | Env var security | ⬜ Overlay | bun-security | **Keep** — secrets management and non-exposure guardrails |

**Total: 37 skills** — 6 Required (core gates), 31 Overlay (project-specific, all owned)

**No skills deleted.** All 37 skills have clear ownership, triggers, and documented relationships.

**Decision Log:**
- **Deleted 8 dead orphans** (executing-plans, impeccable, plugin-creator, subagent-driven-development, superpowers-memory, trailofbits-audit, writing-plans, readme-memory)
- **Consolidated 0 skills** — all 14 live orphans have distinct purposes; kept all
- **Promoted all 14 orphans to matrix** with explicit owner, trigger, and relationship documentation

**Special attention items:**
- `allura-memory-skill`: Mandatory for all agents. Cannot be removed without breaking Brain integration.
- `context7` + `multi-search`: Both serve Scout's discovery role. context7 for library docs, multi-search for web search. Complementary, not overlapping.
- `figma-*` skills: 6 Figma skills may seem excessive, but each serves a distinct Figma API surface. Keep all.
- `penpot-design`, `perplexica-search`, and `mcp-docker-ops`: Skill-embedded MCP pattern examples. They may declare/allow tools, but activation still requires mcp-harness governance.
- Ralph-related: `ralph.md` is a command, not a skill. Ralph's execution is gated by the ContextScout + skill gate (R5).

---
*Generated: 2026-05-03 | Part of OAC Core Restoration PRD*
