<!-- Context: core/navigation | Priority: critical | Version: 2.0 | Updated: 2026-04-04 -->

# Context Navigation

**New here?** → `openagents-repo/quick-start.md`

---

## Two Worlds Model

> **Crystal Clear Distinction**
> - **OpenCode CLI Agents** = Winston's hands (how YOU work)
> - **Org/Business Agents** = Digital employees (what works FOR clients/orgs)

OpenCode agents live in `.opencode/agent/Memory*.md`  
Org agents live in Paperclip/OpenClaw dashboard (not `.opencode/`)

---

## Structure

```
.opencode/context/
├── core/                   # Universal standards & workflows
├── openagents-repo/        # OpenAgents Control repository work
├── development/            # Software development (all stacks)
├── ui/                     # Visual design & UX
├── project/                # Project-specific context
└── system-builder-templates/  # Agent generation templates
```

---

## Quick Routes

| Task | Path |
|------|------|
| **Write code** | `core/standards/code-quality.md` |
| **Write tests** | `core/standards/test-coverage.md` |
| **Write docs** | `core/standards/documentation.md` |
| **Review code** | `core/workflows/code-review.md` |
| **Delegate task** | `core/workflows/task-delegation-basics.md` |
| **Use BMad workflows** | `project/bmad-integration.md` |
| **Choose agent** | `project/roninmemory-intelligence.md` |

### ⭐ Agent Selection (OpenCode CLI Only)

**7 Memory Agents** (Winston's hands):
- `MemoryOrchestrator` - BMAD workflow coordination
- `MemoryArchitect` - System design lead
- `MemoryBuilder` - Infrastructure implementation
- `MemoryAnalyst` - Memory system metrics
- `MemoryCopywriter` - Agent prompt writing
- `MemoryRepoManager` - Git operations
- `MemoryScribe` - Documentation/specs

See `project/bmad-integration.md` for BMad persona mapping.

### Org Agents (Paperclip Dashboard)

**Not in `.opencode/`** - these are business domain agents:
- `faithmeats-agent` - Faith Meats product ops
- `audits-agent` - Mortgage audit checks
- `crm-agent` - CRM workflows
- `nonprofit-agent` - Grant/donor comms

**Blocked on**: `groupIdEnforcer.ts` fix

### Notion Surfaces

| Surface | ID | Role |
|---------|-----|------|
| Backend Hub | `6581d9be65b38262a2218102c1e6dd1d` | Structural governance |
| OpenAgents Control | `3371d9be65b38041bc59fd5cf966ff98` | CLI team registry |
| Allura Memory Control Center | `3371d9be65b381a9b3bec24275444b68` | HITL oversight |

---

## By Category

**core/** - Standards, workflows, patterns → `core/navigation.md`  
**openagents-repo/** - Repository-specific → `openagents-repo/navigation.md`  
**development/** - All development → `development/navigation.md`  
**ui/** - Design & UX → `ui/navigation.md`