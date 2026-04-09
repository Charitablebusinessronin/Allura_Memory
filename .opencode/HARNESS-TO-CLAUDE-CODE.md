# Harness Integration with Claude Code

**Goal**: Route Claude Code commands to the OpenCode harness so users can discover/load MCP servers and execute skills from the IDE.

---

## Architecture

```
Claude Code (.claude/)
    ↓
Command Router
    ↓
Shell Script
    ↓
Harness Orchestrator (.opencode/harness/)
    ↓
Event Logger → PostgreSQL
```

---

## Integration Points

### 1. Claude Code Commands (`.claude/commands/`)

Create wrapper commands that route to the harness:

```bash
# .claude/commands/mcp-discover.md
/mcp-discover [keyword]

Handler:
  → bun .opencode/harness/index.ts mcp-discover [keyword]
  → returns: discovered servers (approved + pending)
  → logs: MCP_DISCOVERED event
```

### 2. Quick Prompts (`.claude/commands/`)

For common workflows:

```bash
/mcp-available      # List all approved MCP servers
/skills-available   # List all available skills
/harness-status     # Show harness health + loaded servers
```

### 3. Slash Command Expansion

In Claude Code:

```
/mcp-discover database
  ↓
[Call .opencode/harness/index.ts mcp-discover database]
  ↓
[Parse YAML registry, log event]
  ↓
[Display results: approved + pending servers]
```

---

## File Structure

```
.claude/
├── commands/
│   ├── mcp-discover.md        # NEW: Route to harness
│   ├── mcp-approve.md         # NEW: Request approval
│   ├── mcp-load.md            # NEW: Load server
│   ├── skill-propose.md       # NEW: Show skill
│   └── skill-load.md          # NEW: Execute skill
│
└── scripts/
    └── harness-router.sh      # NEW: Shell wrapper

.opencode/
├── harness/
│   ├── index.ts               # Orchestrator (DONE)
│   ├── event-logger.ts        # Logging (DONE)
│   └── test-logging-integration.ts  # Tests (DONE)
└── HARNESS-LOGGING-INTEGRATION.md   # Docs (DONE)
```

---

## Implementation Steps

### Step 1: Create Harness Router Script

```bash
# .claude/scripts/harness-router.sh

#!/bin/bash
cd /home/ronin704/Projects/allura\ memory
bun .opencode/harness/index.ts "$@"
```

### Step 2: Create Claude Code Commands

**`.claude/commands/mcp-discover.md`**

```markdown
# /mcp-discover

Discover available MCP servers.

Usage: /mcp-discover [keyword]

Examples:
  /mcp-discover
  /mcp-discover database
  /mcp-discover search

Handler: .claude/scripts/harness-router.sh mcp-discover
```

(Similar for `/mcp-approve`, `/mcp-load`, `/skill-propose`, `/skill-load`)

### Step 3: Register Commands in Settings

**`.claude/settings.json`**

```json
{
  "commands": {
    "mcp-discover": {
      "handler": "bash",
      "script": ".claude/scripts/harness-router.sh mcp-discover"
    },
    "mcp-approve": {
      "handler": "bash",
      "script": ".claude/scripts/harness-router.sh mcp-approve"
    }
  }
}
```

---

## User Flow (After Integration)

### Scenario 1: Discover & Load PostgreSQL

```
User (Claude Code):
  /mcp-discover database

Harness:
  MCP_DISCOVERED event logged
  Response: "2 approved, 1 pending"

User:
  /mcp-approve postgresql-mcp

Harness:
  MCP_APPROVED event logged
  Response: "Ready to load with: /mcp-load postgresql-mcp"

User:
  /mcp-load postgresql-mcp

Harness:
  MCP_LOADED event logged
  Response: "Tools available: mcp__MCP_DOCKER__query_database ..."
```

### Scenario 2: Propose & Execute Skill

```
User:
  /skill-propose code-review

Harness:
  SKILL_PROPOSED event logged
  Response: "Skill: code-review, preferred: @oracle"

User:
  /skill-load code-review --executor oracle

Harness:
  SKILL_LOADED event logged
  Response: "@oracle now executing code-review"
```

---

## Integration Checklist

### Phase 1: Harness Ready ✅

- [x] Harness orchestrator (`index.ts`)
- [x] Event logger (`event-logger.ts`)
- [x] MCP loader (`mcp-plugin-loader.ts`)
- [x] Skill loader (`skill-loader.ts`)
- [x] Logging integration complete
- [x] Integration test passing

### Phase 2: Claude Code Integration (Next)

- [ ] Create `harness-router.sh` script
- [ ] Create Claude Code commands (mcp-discover, mcp-approve, mcp-load, skill-propose, skill-load)
- [ ] Register commands in `.claude/settings.json`
- [ ] Test each command end-to-end
- [ ] Document in `.claude/HARNESS-GUIDE.md`

### Phase 3: Production Readiness

- [ ] Run E2E test with live Postgres
- [ ] Verify events logged correctly
- [ ] Set up event dashboards
- [ ] Wire curator promotion flow
- [ ] Document admin workflows

---

## Command Registry

| Command | Handler | Purpose |
|---------|---------|---------|
| `/mcp-discover [keyword]` | `harness-router.sh mcp-discover` | List MCP servers |
| `/mcp-approve <server-id>` | `harness-router.sh mcp-approve` | Request approval |
| `/mcp-load <server-id>` | `harness-router.sh mcp-load` | Load server |
| `/skill-propose <skill>` | `harness-router.sh skill-propose` | Show skill details |
| `/skill-load <skill> [--executor]` | `harness-router.sh skill-load` | Execute skill |
| `/harness-status` | `harness-router.sh status` | Show harness health |

---

## Testing

### Local Test

```bash
# Simulate Claude Code calling harness
cd /home/ronin704/Projects/allura\ memory
bun .opencode/harness/index.ts mcp-discover database
# → Should output: approved servers + pending + next steps

bun .opencode/harness/index.ts list-skills
# → Should output: all available skills with executors
```

### Integration Test

```bash
# With Claude Code running, try:
/mcp-discover
/skill-propose code-review
/skill-load code-review --executor oracle
```

---

## Brooksian Design Principles

✅ **Explicit Routing**: Claude Code explicitly routes to harness (no auto-discovery)
✅ **Surgical Delegation**: Commands show options; user (Brooks) decides
✅ **Clear Contracts**: Each command has well-defined inputs/outputs
✅ **Audit Trail**: All operations logged (via event-logger)
✅ **Separation of Concerns**: Claude Code (UI) separate from harness (logic)

---

## Next Actions

**Immediate:**
1. Create `harness-router.sh` shell script
2. Create 5 Claude Code command files
3. Test locally: `bun .opencode/harness/index.ts mcp-discover`

**Short Term:**
1. Register commands in `.claude/settings.json`
2. Test each command from Claude Code IDE
3. Document user workflows

**Medium Term:**
1. Set up event dashboards (PostgreSQL queries)
2. Wire curator promotion flow
3. Build admin monitoring/audit reports

---

**Ready for Phase 2: Claude Code integration.**
