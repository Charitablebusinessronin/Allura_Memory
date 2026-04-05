# Agent Taxonomy - Two Separate Worlds

## The Crystal Clear Distinction

Your system has **two completely different agent runtimes** that should never be confused.

---

## World 1: OpenCode CLI Agents (Winston's Hands)

**Purpose**: How YOU work  
**Runtime**: Terminal / OpenCode  
**Lives in**: `.opencode/agent/`  
**Naming**: `Memory{Role}`  
**Memory**: roninmemory (shared brain)

These are **your personal coding workforce** - memory-themed agents that run when YOU are working in OpenCode.

### The 7 Memory CLI Agents (Week 1 Complete)

```
.opencode/agent/
├── MemoryOrchestrator.md     # BMAD workflow coordinator
├── MemoryArchitect.md         # System design lead
├── MemoryBuilder.md          # Docker/Payload implementation
├── MemoryAnalyst.md          # Memory system metrics
├── MemoryCopywriter.md       # Agent prompt writing
├── MemoryRepoManager.md      # Git operations
└── MemoryScribe.md           # Documentation/specs
```

**What They Do**:
- `MemoryOrchestrator` → Runs BMAD workflows when you say "lets create architecture"
- `MemoryArchitect` → Designs systems when you're building
- `MemoryBuilder` → Builds Docker containers when you say "memory-builder"
- `MemoryAnalyst` → Analyzes memory system performance
- `MemoryCopywriter` → Writes agent prompts and system docs
- `MemoryRepoManager` → Manages git when you're committing
- `MemoryScribe` → Writes specs when you say "lets create PRD"

---

## World 2: Org/Business Agents (Digital Employees)

**Purpose**: What works FOR clients/orgs  
**Runtime**: Paperclip / OpenClaw  
**Lives in**: Paperclip dashboard  
**Naming**: `{org}-coder`, `{org}-agent`  
**Memory**: roninmemory (scoped by `group_id`)

These are **agents that work FOR your organizations** - the products you deliver.

### Org Agents (Created in Paperclip - After groupIdEnforcer fix)

```
Paperclip Dashboard:
├── faithmeats-agent         → Runs Faith Meats product ops
├── faithmeats-coder         → Builds Faith Meats Payload site
├── audits-agent             → Runs mortgage audit checks
├── crm-agent                → Manages CRM workflows
└── nonprofit-agent          → Handles grant/donor comms
```

**What They Do**:
- `faithmeats-agent` → Process Faith Meats product data
- `audits-agent` → Run GLBA-compliant mortgage audits
- `crm-agent` → Manage lead capture sequences
- `nonprofit-agent` → Research grants and donor comms

---

## The Rule of Thumb

> **OpenCode agents = Winston's hands** (how YOU work)
> **Org agents = Digital employees** (what works FOR clients/orgs)

---

## Current Status

### ✅ Week 1 Complete: OpenCode CLI Agents
All 7 `Memory*` agents created with:
- Unified `Memory{Role}` naming
- YAML frontmatter with `behavior_lock: "UNPROMOTED"`
- Memory Bootstrap Protocol headers
- Clear Brooksian principles
- 630 lines of agent definitions

### ⏳ Week 2+: Org Agents (Blocked)
**Blocked on**: `groupIdEnforcer.ts` fix
**Reason**: Org agents touch real client data (GLBA, mortgage, CRM)
**Created in**: Paperclip dashboard (not `.opencode/`)

---

## Never Confuse These

| Scenario | OpenCode Agent | Org Agent |
|----------|---------------|-----------|
| "Write agent prompts" | `MemoryCopywriter` | N/A |
| "Process Faith Meats orders" | N/A | `faithmeats-agent` |
| "Run mortgage audit" | N/A | `audits-agent` |
| "Analyze memory performance" | `MemoryAnalyst` | N/A |
| "Build Docker container" | `MemoryBuilder` | N/A |
| "Manage CRM leads" | N/A | `crm-agent` |

---

## Next Steps

### Immediate (No Blockers)
1. Use all 7 Memory CLI agents in OpenCode
2. Test memory bootstrap protocol
3. Validate agent routing

### Week 2 (After groupIdEnforcer fix)
1. Create org agents in Paperclip
2. Enable `group_id` enforcement
3. Deploy org agents to production dashboards

---

*"The bearing of a child takes nine months, no matter how many women are assigned."* — Frederick P. Brooks Jr.

**Two worlds. Two purposes. Crystal clear.**