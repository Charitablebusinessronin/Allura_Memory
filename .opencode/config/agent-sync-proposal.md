# Agent Synchronization Proposal

## Current State

### BMad Persona Agents (12 agents)
Source: `_bmad/_config/agent-manifest.csv`

| BMad Name | Persona | Role | Module |
|-----------|---------|------|--------|
| bmad-agent-analyst | Mary | Strategic Business Analyst | bmm/1-analysis |
| bmad-agent-architect | Winston | System Architect | bmm/3-solutioning |
| bmad-agent-pm | John | Product Manager | bmm/2-plan-workflows |
| bmad-agent-ux-designer | Sally | UX Designer | bmm/2-plan-workflows |
| bmad-agent-dev | Amelia | Developer Agent | bmm/4-implementation |
| bmad-agent-qa | Quinn | QA Engineer | bmm/4-implementation |
| bmad-agent-quick-flow-solo-dev | Barry | Quick Flow Solo Dev | bmm/4-implementation |
| bmad-agent-sm | Bob | Scrum Master | bmm/4-implementation |
| bmad-agent-tech-writer | Paige | Technical Writer | bmm/1-analysis |
| bmad-tea | Murat | Master Test Architect | tea |
| wds-agent-freya-ux | Freya | WDS Designer | wds |
| wds-agent-saga-analyst | Saga | WDS Analyst | wds |

### OpenCode Memory Agents
Source: `.opencode/config/agent-metadata.json`

| Memory Name | Category | Persona |
|-------------|----------|---------|
| memory-orchestrator | core | Frederick P. Brooks Jr. |
| memory-architect | core | (maps to Winston) |
| memory-scout | subagents/core | Context Scout |
| memory-archivist | subagents/core | External Scout |
| memory-curator | subagents/core | Task Manager |
| memory-chronicler | subagents/core | Documentation |
| memory-builder | subagents/code | Coder Agent |
| memory-tester | subagents/code | Test Engineer |
| memory-guardian | subagents/code | Reviewer |
| memory-validator | subagents/code | Build Agent |
| memory-organizer | subagents/system-builder | Context Organizer |
| memory-interface | subagents/development | Frontend Specialist |
| memory-infrastructure | subagents/development | DevOps Specialist |

## Proposed Synchronization

### Option 1: Dual System (Recommended)

Keep both systems with explicit mapping:

**BMad Skills** invoke BMad persona agents for:
- Planning workflows (PRD, architecture, UX design)
- BMad party mode collaboration
- BMad-specific processes (create-prd, create-architecture, etc.)

**OpenCode Memory Agents** handle:
- Runtime orchestration
- Code implementation
- Testing and validation
- Day-to-day development tasks

**Mapping Layer**: Add `persona_mapping` to `agent-metadata.json`:

```json
{
  "memory-architect": {
    "persona_mapping": {
      "bmad_equivalent": "bmad-agent-architect",
      "persona_name": "Winston",
      "use_bmad_for": ["planning", "architecture-design"],
      "use_memory_for": ["implementation", "code-review"]
    }
  }
}
```

### Option 2: Unified Persona

Add Brooks persona to BMad manifest and unify naming:

**New BMad Entry**:
```csv
"memory-orchestrator","Frederick P. Brooks Jr.","Memory Orchestrator","🏗️","planning, governance, conceptual integrity","Brooks-bound primary orchestrator","Direct, pragmatic, conceptually-integrated","conceptual_integrity_above_all, data_dominates, minimize_communication_overhead","core",".opencode/agent/core/openagent.md"
```

**Update bmad-integration.md** with explicit skill-to-agent routing:

```markdown
### Skill-to-Agent Routing

| Skill | BMad Agent | OpenCode Agent |
|-------|------------|----------------|
| bmad-create-prd | John (PM) | memory-architect |
| bmad-create-architecture | Winston (Architect) | memory-architect |
| bmad-dev-story | Amelia (Dev) | memory-builder |
| bmad-quick-dev | Barry (Quick Flow) | memory-builder |
| bmad-testarch-* | Murat (TEA) | memory-tester |
```

### Option 3: Hybrid Registry

Create a unified registry that both systems reference:

**New File**: `_bmad/_config/unified-agent-registry.yaml`

```yaml
agents:
  orchestrator:
    bmad_id: null  # No BMad equivalent
    opencode_id: memory-orchestrator
    persona: Frederick P. Brooks Jr.
    
  architect:
    bmad_id: bmad-agent-architect
    opencode_id: memory-architect
    persona: Winston
    
  # ... etc
```

## Recommendation

**Option 1 (Dual System with Mapping)** is recommended because:

1. BMad agents are **workflow-specific** skills invoked through BMad workflows
2. Memory agents are **runtime agents** for OpenCode orchestration
3. They serve different purposes and shouldn't be merged
4. Clear mapping enables cross-reference when needed

## Implementation Steps

1. Add `persona_mapping` to `agent-metadata.json` for relevant agents
2. Update `bmad-integration.md` with explicit skill-to-agent routing table
3. Create a NOTION sync for both agent registries
4. Document when to use BMad agents vs memory agents

## Files to Update

- `.opencode/config/agent-metadata.json` — Add persona_mapping
- `.opencode/context/project/bmad-integration.md` — Add skill-to-agent routing
- `_bmad/_config/agent-manifest.csv` — Keep as-is (BMad source of truth)
- Notion Frameworks database — Sync both registries

## Questions for Clarification

1. Should BMad agents be invocable directly from OpenCode, or only through BMad skills?
2. Should memory-* agents be exposed in the BMad manifest for party mode use?
3. Is the Brooks persona for the orchestrator sufficient, or should each memory-* agent have its own persona?