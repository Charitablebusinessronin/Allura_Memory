# Skill Ownership Matrix

| Skill | Owner | Trigger | Required? | Overlaps With | Decision |
|-------|-------|---------|-----------|---------------|----------|
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
| penpot-design | Woz | Penpot design canvas work | ⬜ Overlay | figma-*, allura-design | **Keep** — Penpot-specific design tool scope |
| perplexica-search | Scout | External web research | ⬜ Overlay | multi-search | **Keep** — self-hosted Perplexica research path |
| postgres-best-practices | Knuth | DB patterns | ⬜ Overlay | none | **Keep** — PostgreSQL guidance |

**Total: 22 skills** — 6 Required (core gates), 16 Overlay (project-specific)

**No skills deleted.** All Allura skills have clear ownership, triggers, and no destructive overlaps.

**Special attention items:**
- `allura-memory-skill`: Mandatory for all agents. Cannot be removed without breaking Brain integration.
- `context7` + `multi-search`: Both serve Scout's discovery role. context7 for library docs, multi-search for web search. Complementary, not overlapping.
- `figma-*` skills: 6 Figma skills may seem excessive, but each serves a distinct Figma API surface. Keep all.
- `penpot-design`, `perplexica-search`, and `mcp-docker-ops`: Skill-embedded MCP pattern examples. They may declare/allow tools, but activation still requires mcp-harness governance.
- Ralph-related: `ralph.md` is a command, not a skill. Ralph's execution is gated by the ContextScout + skill gate (R5).

---
*Generated: 2026-05-03 | Part of OAC Core Restoration PRD*
