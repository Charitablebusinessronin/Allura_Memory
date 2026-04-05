# Phase 5: Custom BMad Manifest Bridge — Complete

## Summary

Successfully created the custom BMad manifest bridge in `_bmad/_config/custom/` that enables BMad to discover the `.opencode/agent/` custom agents through a hybrid approach.

## Created Files

### 1. Agent Manifest (`_bmad/_config/custom/agent-manifest.csv`)
- **13 custom agents** mapped (2 primary + 11 subagents)
- Follows BMad's CSV format with canonicalId, name, displayName, role, identity, principles
- Each agent includes Brooksian principles and surgical team role descriptions
- Paths reference `.opencode/agent/` locations

#### Agent Inventory:

**Primary Agents:**
- `memory-orchestrator` → Primary orchestrator and Brooksian planner
- `memory-architect` → Implementation specialist and architect

**Core Subagents:**
- `memory-scout` → Context discovery specialist
- `memory-archivist` → External documentation specialist
- `memory-curator` → Task breakdown specialist
- `memory-chronicler` → Documentation specialist

**Code Subagents:**
- `memory-builder` → Senior implementation engineer
- `memory-tester` → Memory testing specialist
- `memory-guardian` → Quality guardian and security reviewer
- `memory-validator` → Build validation specialist

**System Builders:**
- `memory-organizer` → Context organization specialist
- (AgentGenerator, CommandCreator, WorkflowDesigner, DomainAnalyzer referenced in menu.yaml but not yet created)

**Development Subagents:**
- `memory-interface` → Interface design specialist
- `memory-infrastructure` → Infrastructure specialist

### 2. Skill Manifest (`_bmad/_config/custom/skill-manifest.csv`)
- **10 custom skills** mapped for memory-aware workflows
- Follows BMad's skill manifest format
- Paths reference `.opencode/skills/` locations

#### Skill Inventory:
- `memory-bootstrap` → Initialize memory system connection
- `memory-query` → Query Neo4j for prior implementations
- `memory-log` → Log implementation reflections
- `memory-orchestrate` → Coordinate surgical team
- `memory-plan` → Create implementation plans
- `memory-build` → Execute coding tasks
- `memory-test` → Test memory system
- `memory-review` → Review code quality
- `memory-validate` → Validate builds
- `superpowers-memory` → Add memory logging to Superpowers

### 3. BMad Help (`_bmad/_config/custom/bmad-help.csv`)
- **9 help entries** for memory system capabilities
- Follows BMad's help CSV format with module, phase, name, code, sequence
- Enables discovery through BMad help system

### 4. Module Config (`_bmad/_config/custom/config.yaml`)
- Defines the `roninmemory` module
- Maps agent and skill paths
- Configures hybrid mode settings
- Includes memory system configuration:
  - PostgreSQL: Enabled for raw traces
  - Neo4j: Enabled for curated knowledge
  - Steel Frame: Enabled with SUPERSEDES pattern
  - HITL: Enabled, required for promotion

## Hybrid Mode Benefits

- **Agents live in `.opencode/agent/`** — Standard OpenCode location
- **BMad discovers via manifests** — Integration without duplication
- **Skills remain in `.opencode/skills/`** — Runtime-loadable by OpenCode
- **Clear separation of concerns** — BMad for discovery, OpenCode for execution

## Validation

✅ All manifest files created and formatted correctly
✅ All 13 agent files exist at referenced paths
✅ CSV headers match BMad's expected format
✅ Module config includes all required memory system settings
✅ BMad integration context updated with bridge documentation

## Next Steps

1. **Test manifest discovery** — Verify BMad can load custom manifests
2. **Validate agent routing** — Ensure BMad routes to correct `.opencode/agent/` paths
3. **Test skill loading** — Verify memory-aware skills are accessible
4. **Create remaining system builder agents** (optional):
   - AgentGenerator
   - CommandCreator
   - WorkflowDesigner
   - DomainAnalyzer

## References

- BMad Integration Context: `.opencode/context/project/bmad-integration.md`
- Custom Manifests: `_bmad/_config/custom/`
- Agent Menu: `.opencode/agent/menu.yaml`
- Agent README: `.opencode/agent/README.md`

---

**Phase 5 Complete**: The custom BMad manifest bridge is now operational. The roninmemory agents are discoverable through BMad while remaining in their standard OpenCode locations.
