# /skill-load

**Load a skill and route to an executor.**

Brooks decides which agent executes the skill.

## Usage

```bash
/skill-load <skill-name> [--executor <agent-name>]
```

## Examples

```bash
# Load code-review, execute with @oracle (read-only consultant)
/skill-load code-review --executor oracle

# Load task-creator, execute with @atlas (conductor)
/skill-load task-creator --executor atlas

# Load with default (Brooks)
/skill-load validate
```

## Workflow

```
Brooks proposes a skill
  ↓
Decides executor: "@oracle is the right consultant"
  ↓
skill-load code-review --executor oracle
  ↓
Event logged: SKILL_LOADED
  ↓
@oracle executes the skill
```

## Executor Options

The executor is **not auto-selected**. Brooks chooses based on:

- **Skill type** — What kind of work is needed?
- **Surgical team availability** — Who's free?
- **Expertise** — Who's best at this?

| Executor | Role | Best For |
|----------|------|----------|
| `@oracle` | Read-only consultant | Code review, architecture guidance |
| `@atlas` | Conductor | Task orchestration, coordination |
| `@scribe` | Documentation | Writing, documentation updates |
| `@brooks` | Surgeon | Orchestration, decision-making |
| `@hephaestus` | Deep worker | Implementation, research |

## Example Success

```
✅ Skill Loaded

Skill: code-review
Executor: @oracle
Status: ready

@oracle will now execute the code-review skill.
Event logged: SKILL_LOADED (allura-system / brooks)
```

## Requirements

- Skill must exist in registry
- Executor must be a valid agent name
- Skill file must exist at registered location

## Error Cases

### Skill not found

```
Error: Skill not found: unknown-skill
Available: code-review, task-creator, quick-update, ...
```

### Executor not specified

```
Using default executor: @brooks

Or specify explicitly:
/skill-load code-review --executor oracle
```

### Skill file missing

```
Error: Skill file not found: .opencode/skills/code-review/SKILL.md
```

## Event Logging

After successful load:

```json
{
  "event_type": "SKILL_LOADED",
  "group_id": "allura-system",
  "agent_id": "brooks",
  "status": "completed",
  "metadata": {
    "skill": "code-review",
    "executor": "oracle"
  },
  "timestamp": "2026-04-09T14:30:00Z"
}
```

## Implementation

Handler: `.opencode/harness/skill-loader.ts::loadSkill()`

Registry: `_bmad-output/AGENT-SKILLS-REGISTRY.md`

Logs: Postgres (append-only)
