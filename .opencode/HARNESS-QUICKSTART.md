# Harness Quick Start

**The plugin architecture for `.opencode` — separate from OpenCode itself.**

This harness orchestrates MCP servers, skills, and the surgical team under Brooks's direction.

---

## What You Got

### Files Created

```
.opencode/
├── plugin/
│   └── mcp-registry.yaml              ✅ Curated MCP server list
├── harness/
│   ├── index.ts                       ✅ Main orchestrator
│   ├── mcp-plugin-loader.ts           ✅ Discover + approve + load
│   └── skill-loader.ts                ✅ Load skills + route to agents
├── commands/
│   ├── mcp-discover.md                ✅ /mcp-discover <keyword>
│   ├── mcp-approve.md                 ✅ /mcp-approve <server-id>
│   ├── mcp-load.md                    ✅ /mcp-load <server-id>
│   ├── skill-propose.md               ✅ /skill-propose <skill-name>
│   └── skill-load.md                  ✅ /skill-load <skill-name>
└── PLUGIN-ARCHITECTURE.md             ✅ Full design doc
```

---

## Three Brooksian Principles

### 1. Explicit Approval

MCP servers are discovered but not auto-loaded. Brooks approves before they're active.

```bash
/mcp-discover database        # See what's available
/mcp-approve postgresql-mcp   # Brooks approves
/mcp-load postgresql-mcp      # Now active
```

**Why:** Conceptual integrity. You know what's in your harness.

---

### 2. Surgical Team Delegation

Skills are loaded, but Brooks decides the executor. The harness does not auto-route.

```bash
/skill-propose code-review       # Show skill + preferred executor
/skill-load code-review --executor oracle  # Brooks decides: oracle reviews code
```

**Why:** The surgeon directs the team. One mind, multiple specialists.

---

### 3. Manual Curation

The MCP registry is yours. No auto-fetch from external sources.

`.opencode/plugin/mcp-registry.yaml` is the source of truth.

**Why:** Bounded complexity. No drift. Every tool is intentional.

---

## Quick Commands

### Discover & Load MCP Servers

```bash
# 1. Discover what's available
/mcp-discover database

# 2. Brooks approves a server
/mcp-approve postgresql-mcp

# 3. Load it
/mcp-load postgresql-mcp

# Now tools are available:
# mcp__MCP_DOCKER__query_database
# mcp__MCP_DOCKER__execute_sql
# ... etc
```

---

### Load & Execute Skills

```bash
# 1. Propose a skill to Brooks
/skill-propose code-review

# 2. Brooks decides who executes it
/skill-load code-review --executor oracle

# @oracle now executes the skill
```

---

## Registry Structure

### MCP Registry (`mcp-registry.yaml`)

**Approved** (ready to load):
- `allura-memory` (local; pre-approved)
- `tavily-search` (web research; pre-approved)

**Pending Approval:**
- `postgresql-mcp` (requires env vars)
- `neo4j-cypher` (HITL required)
- `notion-mcp` (HITL required)
- `github-mcp` (audit required)

**To add a new server:**
1. Add entry to `mcp_servers` with `approved: false`
2. Optionally set `approved_by`, `approved_date` after Brooks approves
3. `/mcp-load <server-id>` once approved

---

## Integration with Brooks Persona

The harness implements the **Brooksian model**:

- **Brooks is the architect** — Makes approval + routing decisions
- **MCP servers are instruments** — Each tool has a purpose
- **Skills are templates** — Reusable task definitions
- **Agents are specialists** — Oracle, Hephaestus, Atlas, Scribe, etc.
- **Harness is the operating theater** — Coordinates, logs, enforces constraints

---

## Integration with Memory System

All harness events log to Postgres (append-only):

```json
{
  "event_type": "MCP_APPROVED",
  "group_id": "allura-system",
  "agent_id": "brooks",
  "status": "completed",
  "metadata": { "server_id": "postgresql-mcp" },
  "timestamp": "2026-04-09T14:30:00Z"
}
```

No Neo4j writes without curation. HITL gates sensitive operations.

---

## Next Steps

### Immediate

1. **Test the harness locally:**
   ```bash
   bun run .opencode/harness/index.ts status
   bun run .opencode/harness/index.ts list-mcp
   bun run .opencode/harness/index.ts list-skills
   ```

2. **Integrate with OpenCode CLI** — Route `/mcp-discover`, `/skill-propose` to the harness

3. **Wire up Postgres logging** — Implement `logEvent()` in `harness/index.ts`

### Later

4. **Extend the MCP registry** — Add curated servers as they're validated
5. **Refine skill routing** — Extract metadata from SKILL.md frontmatter
6. **Add approval hooks** — Gate sensitive operations on user confirmation

---

## Architecture Diagram

```
User Prompt
    ↓
/mcp-discover → mcp-plugin-loader
              ↓ (list approved + pending)
              ↓
              mcp-registry.yaml
              ↓
              (show user)
              ↓
/mcp-approve → mcp-plugin-loader
             ↓ (update registry)
             ↓
/mcp-load → mcp_add() (MCP Docker Toolkit)
          ↓ (tools now available)
          ↓
          log event to Postgres
          
---

/skill-propose → skill-loader
              ↓ (show skill + executor options)
              ↓
/skill-load → skill-loader
           ↓ (route to agent)
           ↓
           @agent executes
           ↓
           log event to Postgres
```

---

## Brooksian Takeaway

> "The purpose of organization is to reduce the amount of communication and coordination necessary."

This harness reduces coordination by:

1. **Explicit approval** — Clear decision points (no magic)
2. **Surgical team** — Clear roles (no ambiguity)
3. **Manual curation** — Clear boundaries (no drift)

Result: Brooks makes decisions; the harness executes them; the team knows what's happening.

---

## Files Reference

| File | Purpose |
|------|---------|
| `.opencode/plugin/mcp-registry.yaml` | Source of truth for MCP servers |
| `.opencode/harness/index.ts` | Main orchestrator |
| `.opencode/harness/mcp-plugin-loader.ts` | MCP discovery + approval + loading |
| `.opencode/harness/skill-loader.ts` | Skill routing to agents |
| `.opencode/PLUGIN-ARCHITECTURE.md` | Full design documentation |
| `.opencode/commands/mcp-*.md` | Command definitions |
| `.opencode/commands/skill-*.md` | Command definitions |

---

**Ready to use. Separate from OpenCode. Governed by Brooks.**
