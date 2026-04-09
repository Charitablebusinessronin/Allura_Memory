# Plugin Architecture — Brooksian Design

> **Principle:** "The purpose of organization is to reduce the amount of communication and coordination necessary."

This document defines the plugin harness system: MCP server discovery, skill loading, and agent delegation.

---

## Philosophy

Three core commitments:

### 1. Explicit Approval (No Auto-Loading)

**The surgeon does not allow untrusted instruments.**

MCP servers are discovered but not loaded automatically. Brooks (or designated approver) must explicitly approve each server before it's available to agents.

**Flow:**
```
mcp-discover database
  ↓ (list approved + unapproved)
mcp-approve postgresql-mcp
  ↓ (Brooks approves)
mcp-load postgresql-mcp
  ↓ (tools now available)
```

**Why?**
- **Conceptual Integrity:** You know exactly what's in your harness.
- **Security:** No untrusted code loads automatically.
- **Simplicity:** The list of available tools is bounded and intentional.

---

### 2. Surgical Team Delegation (Brooks Routes)

**The architect decides who does the work.**

Skills are loaded, but the harness does not automatically select an executor. Brooks decides which agent (surgeon, consultant, deep worker, etc.) executes each skill.

**Flow:**
```
skill-propose code-review
  ↓ (Brooks reviews proposal)
skill-load code-review --executor oracle
  ↓ (@oracle executes)
```

**Why?**
- **Surgical Team Model:** The orchestrator directs specialists.
- **Accountability:** Brooks knows who's doing what.
- **Flexibility:** Brooks can override defaults based on context.

---

### 3. Manual Curation (No Auto-Fetch)

**You control your registry.**

The MCP registry (`mcp-registry.yaml`) is manually curated. It does not auto-fetch from external sources (e.g., `awesome-agent-skills`).

**Why?**
- **Bounded Complexity:** You know what's available.
- **No External Drift:** Your registry doesn't depend on external changes.
- **Intentional Architecture:** Every tool is there for a reason.

The alternative—auto-fetching from external registries—introduces the Second-System Effect: adding every feature that was "cut from the first version."

---

## Architecture

```
.opencode/
├── plugin/
│   ├── allura-memory.md           # Existing: Local MCP server
│   └── mcp-registry.yaml          # NEW: Manually curated MCP servers
│
├── harness/
│   ├── index.ts                   # Main orchestrator
│   ├── mcp-plugin-loader.ts       # Discover + approve + load
│   └── skill-loader.ts            # Load skills from registry
│
└── commands/
    ├── mcp-discover.md            # /mcp-discover <keyword>
    ├── mcp-approve.md             # /mcp-approve <server-id>
    ├── mcp-load.md                # /mcp-load <server-id>
    ├── skill-propose.md           # /skill-propose <skill-name>
    └── skill-load.md              # /skill-load <skill-name>
```

---

## Registry Structure

### MCP Registry (`mcp-registry.yaml`)

```yaml
registry_version: "1.0"
governance: "brooks-approved"
group_id: "allura-system"

mcp_servers:
  - id: "postgresql-mcp"
    name: "PostgreSQL MCP"
    description: "Direct PostgreSQL client"
    source: "docker://mcp/postgresql"
    env_vars: ["DATABASE_URL"]
    approved: false              # ⚠️ Not yet approved
    approved_by: null
    approved_date: null
    notes: "Requires DATABASE_URL env var"

  - id: "allura-memory"
    name: "Allura Memory Server"
    description: "Neo4j + PostgreSQL memory engine"
    source: "local"
    command: ["bun", "run", "src/mcp/memory-server.ts"]
    approved: true              # ✅ Already approved
    approved_by: "brooks"
    approved_date: "2026-04-09"
```

**States:**
- `approved: true` — Ready to load
- `approved: false` — Pending Brooks approval

---

## Command Flow

### 1. MCP Discovery

```bash
/mcp-discover database
```

**Flow:**
1. List all servers matching "database"
2. Show approved (✅) and pending (⏳)
3. Suggest next action

**Output:**
```
🔍 MCP Discovery Results

Approved (Ready to Load):
  ✅ allura-memory: Allura Memory Server
  ✅ tavily-search: Tavily Search + Research

Pending Approval:
  ⏳ postgresql-mcp: PostgreSQL MCP — Requires DATABASE_URL env var
  ⏳ neo4j-cypher: Neo4j Cypher MCP — HITL approval required

To request approval: mcp-approve <server-id>
To load: mcp-load <server-id>
```

---

### 2. MCP Approval

```bash
/mcp-approve postgresql-mcp
```

**Flow:**
1. Show server details
2. Prompt Brooks: "Approve?"
3. If yes → mark approved + save registry
4. Next step: `/mcp-load postgresql-mcp`

**Safeguards:**
- Only Brooks can approve (hardcoded check)
- HITL gates for sensitive servers (neo4j-cypher, notion-mcp, github-mcp)
- Audit trail in registry (approved_by, approved_date)

---

### 3. MCP Load

```bash
/mcp-load postgresql-mcp
```

**Flow:**
1. Verify server is approved
2. Call `mcp_add("postgresql-mcp")`
3. Tools become available: `mcp__MCP_DOCKER__*`
4. Log event to Postgres

---

### 4. Skill Proposal

```bash
/skill-propose code-review
```

**Flow:**
1. Look up skill in registry
2. Show description + preferred executor
3. Prompt Brooks: "Who should do this?"

**Output:**
```
🎯 Skill Proposal

Skill: code-review
Description: Review code for architecture, patterns, edge cases
Location: .opencode/skills/code-review/SKILL.md
Suggested executor: @oracle

Brooks, who should execute this?
→ skill-load code-review --executor oracle
```

---

### 5. Skill Load

```bash
/skill-load code-review --executor oracle
```

**Flow:**
1. Verify skill exists
2. Route to specified executor (@oracle)
3. Log event: SKILL_LOADED
4. Agent executes skill

---

## Data Model

### HarnessEvent (Postgres)

```typescript
interface HarnessEvent {
  event_type: string;           // "SKILL_LOADED", "MCP_APPROVED", "MCP_LOADED"
  group_id: string;             // "allura-system"
  agent_id: string;             // "brooks", "oracle", etc.
  status: "pending" | "completed" | "failed";
  metadata: Record<string, unknown>;
  timestamp: string;            // ISO 8601
}
```

**Examples:**
```json
{
  "event_type": "MCP_APPROVED",
  "group_id": "allura-system",
  "agent_id": "brooks",
  "status": "completed",
  "metadata": {
    "server_id": "postgresql-mcp",
    "approved_by": "brooks"
  }
}
```

---

## Constraints & Governance

### Approval Matrix

| Server | Requires Approval | HITL Required | Notes |
|--------|-------------------|---------------|-------|
| `allura-memory` | Brooks | No | Local; pre-approved |
| `tavily-search` | Brooks | No | Web research; pre-approved |
| `postgresql-mcp` | Brooks | No | DB client; env vars needed |
| `neo4j-cypher` | Brooks | **Yes** | Mutations must audit SUPERSEDES |
| `notion-mcp` | Brooks | **Yes** | Memory promotion target |
| `github-mcp` | Brooks | **Yes** | Audit all writes; never force-push |

### Rate Limits

```yaml
constraints:
  max_concurrent_mcp_servers: 10
  max_env_vars_per_server: 5
  rate_limit_mcp_calls: "100 per minute"
```

---

## Integration with Memory System

All harness events log to Postgres (append-only). No Neo4j writes without curation.

```
HarnessEvent → Postgres
  ↓
Curator review (if decision-making)
  ↓
Promotion to Neo4j (SUPERSEDES versioning)
```

Example promotion:
```
event_type: "MCP_APPROVED"
  → curator:approve
    → (v2:Decision)-[:SUPERSEDES]->(v1:deprecated)
```

---

## Quick Reference

| Command | Purpose | Approval | Effect |
|---------|---------|----------|--------|
| `mcp-discover <keyword>` | List servers | — | Show status quo |
| `mcp-approve <id>` | Request approval | Brooks | Prompt for approval |
| `mcp-load <id>` | Load approved server | — | Activate tools |
| `skill-propose <name>` | Show skill details | — | Propose to Brooks |
| `skill-load <name>` | Load + route skill | Brooks (executor choice) | Delegate to agent |
| `list-mcp` | Show all servers | — | Inspection |
| `list-skills` | Show all skills | — | Inspection |

---

## Next Steps

1. **Integrate with OpenCode CLI** — Route `/mcp-discover`, `/skill-propose` to harness
2. **Postgres logging** — Implement `logEvent()` in `harness/index.ts`
3. **Brooks approval hook** — Gate sensitive approvals on user confirmation
4. **Extend registry** — Add curated MCP servers as they're validated
5. **Skill file parsing** — Extract metadata from `.opencode/skills/*/SKILL.md` frontmatter

---

## References

- **MCP Registry:** `.opencode/plugin/mcp-registry.yaml`
- **MCP Loader:** `.opencode/harness/mcp-plugin-loader.ts`
- **Skill Loader:** `.opencode/harness/skill-loader.ts`
- **Harness Orchestrator:** `.opencode/harness/index.ts`
- **Agent Routing:** `.claude/rules/agent-routing.md`
- **Brooksian Principles:** *The Mythical Man-Month*, "Conceptual Integrity"
