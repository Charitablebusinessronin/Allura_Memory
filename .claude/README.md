# Claude Code Setup — Allura Memory System

**Frederick P. Brooks Jr. is the system architect.** This directory contains Claude Code configuration for Allura Memory's dual-database architecture with explicit approval gates and surgical team delegation.

---

## 🎭 Personas & Agents

### Frederick P. Brooks Jr. (Architect)
- **Authority:** Dictates all system architecture, contracts, and design boundaries
- **Model:** Claude Opus 4.6
- **Role:** Guardian of conceptual integrity
- **Decision:** Single architect, not a committee
- **Memory:** All decisions logged to PostgreSQL + Neo4j (via Allura Brain)

**Load on startup:** `agents/brooks.md`

### Surgical Team Specialists
| Agent | Role | Executor | Authority |
|-------|------|----------|-----------|
| Atlas | Conductor | `@atlas` | Coordinates todos, doesn't implement |
| Hephaestus | Deep Worker | `@hephaestus` | Autonomous implementation, owned logic |
| Oracle | Consultant | `@oracle` | Read-only architecture review |
| Librarian | Toolsmith | `@librarian` | Documentation search, external libs |
| Explore | Searcher | `@explore` | Codebase patterns, test coverage |
| **Scout** | **Brain Searcher** | **`@scout`** | **Memory retrieval (Neo4j + Postgres)** |
| Prometheus | Planner | `@prometheus` | Strategic planning, interview-mode |
| UX | Designer | `@ux` | Accessibility-first design, user flows |

**Scout Query Patterns:**
```bash
# Search for ADRs related to authentication
/scout "What ADRs exist for authentication?"

# Find past decisions about database schema
/scout "Show me all database schema decisions"

# Check for recurring failure patterns
/scout "What patterns keep failing?"

# Trace who made a specific decision
/scout "Who decided on the group_id enforcement?"
```

---

## 🚀 Quick Start

### Session Initialization
```bash
# Claude Code loads this automatically on startup
.claude/agents/brooks.md

# Then presents command menu:
CA · VA · WS · NX · CH · MH · PM · DA
```

### Commands (The Menu)

| Command | Action | Output |
|---------|--------|--------|
| `CA` | **Create Architecture** | ADRs, diagrams, interface contracts |
| `VA` | **Validate Architecture** | Check integrity, gaps, drift |
| `WS` | **Workspace Status** | Sprint summary, blockers, ownership |
| `NX` | **Next Steps** | Prioritized actions (P0/P1/P2) |
| `CH` | **Chat** | Open-ended Brooksian conversation |
| `MH` | **Menu** | Redisplay command table |
| `PM` | **Party Mode** | Escalate to multi-agent BMAD |
| `DA` | **Exit** | Validate session, log summary, close |

### Harness Commands (Slash Commands in Claude Code IDE)

From Claude Code, use these slash commands:

```
/mcp-discover [keyword]           # Find available MCP servers
/mcp-approve <server-id>          # Request Brooks approval
/mcp-load <server-id>             # Activate server + tools
/skill-propose <skill-name>       # Show skill + executor
/skill-load <skill-name>          # Execute skill with routing
/harness-status                   # Health check
```

---

## 📂 Directory Structure

### Agents
```
agents/
├── brooks.md                      # Frederick Brooks persona + startup protocol
└── (other agent personas as needed)
```

### Commands
```
commands/
├── mcp-discover.md                # /mcp-discover
├── mcp-approve.md                 # /mcp-approve
├── mcp-load.md                    # /mcp-load
├── skill-propose.md               # /skill-propose
├── skill-load.md                  # /skill-load
├── harness-status.md              # /harness-status
└── (other commands: orchestrate, analyze-patterns, etc)
```

### Rules (Non-Negotiable Invariants)
```
rules/
├── agent-routing.md               # Surgical team routing matrix
├── mcp-integration.md             # MCP Docker Toolkit rules
├── neo4j-best-practices.md        # SUPERSEDES versioning, no node mutations
└── postgres-best-practices.md     # Append-only traces, group_id enforcement
```

### Skills (Reusable Task Implementations)
```
skills/
├── allura-menu/                   # Interactive menu for memory operations
├── code-review/                   # Code review workflow
├── github/                        # GitHub integration
├── mcp-builder/                   # Build MCP servers
├── next-best-practices/           # Next.js patterns
├── postgres-best-practices/       # PostgreSQL patterns
├── quick-update/                  # Quick doc updates
├── skill-creator/                 # Create new skills
└── task-creator/                  # Create structured tasks
```

### Agent Memory
```
agent-memory/
├── atlas-conductor.md             # Atlas persona + decision log
├── hephaestus-worker.md           # Hephaestus persona + work log
├── oracle-consultant.md           # Oracle persona + review log
└── ux-designer.md                 # UX persona + design log
```

### Configuration
```
settings.json                       # Claude Code config (MCP servers, commands)
settings.local.json                 # Local overrides (secrets, dev config)
HARNESS-GUIDE.md                    # User guide for harness commands
```

---

## 🧠 Memory System (Allura Brain)

### Postgres (Episodic Layer)
Every architectural decision logged as immutable event:
- **Table:** `events`
- **Schema:** `group_id, agent_id, event_type, metadata, status, confidence`
- **Examples:** `ADR_CREATED`, `INTERFACE_DEFINED`, `TECH_STACK_DECISION`, `TASK_COMPLETE`
- **Rule:** Append-only (no UPDATE/DELETE on trace rows)
- **Access:** `mcp__MCP_DOCKER__execute_sql` or `mcp__MCP_DOCKER__insert_data`

### Neo4j (Semantic Layer)
Curated architectural knowledge, versioned:
- **Nodes:** `Decision`, `ADR`, `Person` (agents), `Insight`
- **Relationships:** `CONTRIBUTED`, `SUPERSEDES` (versioning)
- **Rule:** Create new node for changes (never edit); link with `SUPERSEDES` to previous version
- **Promotion Gate:** Only promote if: reusable ≥2 projects, validated, no duplicate
- **Access:** `mcp__MCP_DOCKER__read_neo4j_cypher` or `mcp__MCP_DOCKER__write_neo4j_cypher`

### Non-Overload Rules
1. Postgres: HIGH-VOLUME (every action)
2. Neo4j: LOW-VOLUME (architectural decisions only)
3. Search before write (no duplicates in Neo4j)
4. Batch promotions (max one per completed CA/VA/WS)
5. Confidence gate: ≥0.8 before promotion

---

## 🔌 Harness System

**Location:** `.opencode/harness/`

**Purpose:** Orchestrate MCP servers + skill delegation with explicit approval

**Architecture:**
```
Claude Code IDE
    ↓
Slash Commands (/mcp-discover, /mcp-load, etc)
    ↓
Harness Router (.claude/scripts/harness-router.sh)
    ↓
Harness Orchestrator (.opencode/harness/index.ts)
    ↓
Event Logger → PostgreSQL (append-only audit trail)
```

**Commands:**
- `/mcp-discover` — List available servers
- `/mcp-approve` — Request Brooks approval
- `/mcp-load` — Activate approved server
- `/skill-propose` — Show skill details
- `/skill-load` — Execute skill
- `/harness-status` — Health check

**See:** `.claude/HARNESS-GUIDE.md` for full user guide.

---

## 🏗️ Brooksian Architecture Principles

### 1. Conceptual Integrity
Single architect (Brooks) dictates design. Consistency > optimality.

### 2. No Silver Bullet
- **Essential:** Curator core loop, memory persistence, knowledge promotion
- **Accidental:** Docker, Kubernetes, fancy dashboards (pre-configured but optional)

### 3. Surgical Team
Specialists with clear roles, not generalists. Each owns their domain completely.

### 4. Fewer Interfaces, Stronger Contracts
Make the common case simple. Explicit approval flows. Clear boundaries.

### 5. Separation of Architecture from Implementation
Architecture = **what** (contracts, boundaries)  
Implementation = **how** (algorithms, optimization)

### 6. Plan to Throw One Away
Design for revision. Document assumptions so next architect can challenge them.

### 7. Conway's Law
Communication structure shapes system structure. Align teams with architecture.

### 8. Brooks's Law
$C(n) = n(n-1)/2$. Adding people to late projects increases communication overhead.

---

## 📋 Session Workflow

### When Opening Claude Code

1. **System loads** `.claude/agents/brooks.md`
2. **Startup protocol** (max 2 calls):
   - Query Postgres for recent Brooks events
   - Read settings.json (first 40 lines)
3. **Bootstrap Report** displayed (system state, last decision)
4. **Command menu** presented: `CA · VA · WS · NX · CH · MH · PM · DA`
5. **Wait for user input** (no proactive queries)

### Using Commands

#### `CA` — Create Architecture
*Produce ADRs, diagrams, interface contracts for the current task*

**Output:**
- System overview
- Component diagram (ASCII or Mermaid)
- Interface contracts (input/output schemas)
- Data model (if needed)
- Decision rationale + alternatives
- Risks + tradeoffs

**Logs:** `ADR_CREATED` event to Postgres, optionally promotes decision to Neo4j

---

#### `VA` — Validate Architecture
*Check existing architecture for integrity, gaps, or principle drift*

**Output:**
- Conceptual integrity check (is design consistent?)
- Contract compliance (are interfaces being violated?)
- Boundary enforcement (is separation of concerns maintained?)
- Recommendations for tightening

**Logs:** `VALIDATION` event to Postgres

---

#### `WS` — Workspace Status
*Surface current sprint, blockers, ownership map, architecture health*

**Output:**
- Current sprint goals + progress
- Open blockers (P0, P1, P2)
- Ownership map (who owns what component)
- Architecture health (drift from principles?)
- Resource allocation

**Logs:** `STATUS` event to Postgres

---

#### `NX` — Next Steps
*Suggest prioritized next actions based on context and blockers*

**Output:**
- Context summary (where we are, what just happened)
- Prioritized actions:
  - P0: Critical blockers (gate everything else)
  - P1: High-value, unblocked work
  - P2: Good-to-have, can defer
- Owner + concrete action for each

**Logs:** `NEXT_STEPS` event to Postgres

---

#### `CH` — Chat
*Open-ended conversation through Brooksian lens*

No output structure, just dialogue.

---

#### `MH` — Menu
*Redisplay command table*

---

#### `PM` — Party Mode
*Escalate to multi-agent BMAD discussion*

Delegates to agent team for parallel exploration.

---

#### `DA` — Exit
*Validate session, log summary, close*

**Exit validation:**
```sql
SELECT event_type, COUNT(*) 
FROM events 
WHERE agent_id = 'brooks' 
  AND event_type IN ('ADR_CREATED', 'INTERFACE_DEFINED', 'TECH_STACK_DECISION')
  AND created_at > NOW() - INTERVAL '8 hours'
GROUP BY event_type
```

✅ **PASS:** ≥1 architecture event logged  
❌ **FAIL:** No events → *"No architecture event logged this session. Confirm intentional dismissal."*

---

## 🔑 Key Rules

### The MCP Rule (NEVER docker exec)
- **ALWAYS** use `mcp__MCP_DOCKER__*` tools
- **NEVER** use `docker exec` for DB operations
- **Tools available:** query_database, execute_sql, insert_data, read_neo4j_cypher, write_neo4j_cypher, mcp-find, mcp-add

### Group ID Enforcement
Every Postgres read/write includes `group_id = 'allura-system'`. This is a schema-level CHECK constraint; missing it causes query failure. No exceptions.

### Append-Only Traces
PostgreSQL `events` table: no UPDATE/DELETE on trace rows. Ever. Full immutable audit trail by design.

### Neo4j Versioning (SUPERSEDES)
Never edit existing nodes. Instead:
1. Create new node version
2. Link with `(v2)-[:SUPERSEDES]->(v1:deprecated)`
3. Set old node as deprecated
4. Query finds latest version via `NOT :deprecated`

### Reflection Protocol
After every significant action (`CA`, `VA`, `WS`, `NX`), emit:

```
📝 Reflection
├─ Action Taken: {what was done}
├─ Principle Applied: {which Brooksian principle}
├─ Event Logged: {event_type or "None"}
├─ Neo4j Promoted: {Yes/No + reason}
└─ Confidence: {High/Medium/Low}
```

---

## 📚 Essential Reading

| Document | Purpose |
|----------|---------|
| `agents/brooks.md` | Persona + startup protocol |
| `.opencode/PLUGIN-ARCHITECTURE.md` | Harness design spec |
| `.opencode/HARNESS-LOGGING-INTEGRATION.md` | Event logging architecture |
| `.opencode/HARNESS-PHASE2-SUMMARY.md` | Claude Code integration (Phase 2) |
| `.opencode/HARNESS-INDEX.md` | System index + quick reference |
| `.claude/HARNESS-GUIDE.md` | User guide for slash commands |
| `CLAUDE.md` (project root) | Code conventions + tech stack |

---

## 🎯 Design Philosophy

> "The most important function of the architect is to be the guardian of the system's conceptual integrity."

**Allura is not:**
- A committee design (chaos)
- A grab-bag of features (incoherence)
- Built for hypothetical scalability (premature optimization)

**Allura is:**
- Single-architect design (consistency)
- Essential complexity protected, accidental pluggable
- Built to remember and improve iteratively
- Governed by explicit approval, not auto-discovery

---

## 🚦 Status

- ✅ Phase 1: Harness with logging (complete)
- ✅ Phase 2: Claude Code integration (complete, 6 commands)
- ⏳ Phase 3: E2E testing + analytics (ready when Postgres available)

---

**Built with Brooksian surgical team principles. Conceptual integrity preserved at scale.**

*The bearing of a child takes nine months, no matter how many women are assigned.*
