# /skill-propose

**Propose a skill to Brooks for execution.**

Show skill details and ask Brooks which agent should execute it.

## Usage

```bash
/skill-propose <skill-name>
```

## Examples

```bash
/skill-propose code-review
/skill-propose task-creator
/skill-propose quick-update
```

## Workflow

```
User invokes skill
  ↓
skill-propose <skill-name>
  ↓
Show skill details + preferred executor
  ↓
Brooks decides: "I'll have @oracle do this"
  ↓
skill-load code-review --executor oracle
  ↓
@oracle executes the skill
```

## Example Proposal

```
🎯 Skill Proposal

Skill: code-review
Description: Review code for architecture, patterns, edge cases
Location: .opencode/skills/code-review/SKILL.md
Suggested executor: @oracle

Brooks, who should execute this?
→ skill-load code-review --executor oracle
```

## Available Skills

Run `/list-skills` to see all available skills.

| Skill | Preferred Executor | Description |
|-------|-------------------|-------------|
| `code-review` | @oracle | Architecture + pattern review |
| `task-creator` | — | Create structured tasks |
| `task-update` | @atlas | Update task status |
| `quick-update` | @scribe | Documentation updates |
| `allura-menu` | @atlas | Interactive menu |
| `validate` | — | Repo validation |
| `optimize` | — | Performance analysis |
| `debug` | — | Systematic debugging |

## Surgical Team

The executor is determined by Brooks, not auto-selected. This preserves the **surgical team model**:

- **@oracle** — Read-only consultant (code review)
- **@atlas** — Conductor (orchestration)
- **@scribe** — Documentation specialist
- **@brooks** — Surgeon (orchestrator)
- **@hephaestus** — Deep worker (implementation)

## Next Step

After Brooks decides the executor:

```bash
/skill-load code-review --executor oracle
```

## Implementation

Handler: `.opencode/harness/skill-loader.ts::proposeSkill()`

Registry: `_bmad-output/AGENT-SKILLS-REGISTRY.md`

Routing: `.claude/rules/agent-routing.md`
