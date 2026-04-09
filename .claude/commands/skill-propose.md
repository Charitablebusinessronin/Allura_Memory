# /skill-propose

Propose a skill and see which specialist agent handles it.

## Usage

```
/skill-propose <skill-name>
```

## Examples

```
/skill-propose code-review           # Code review specialist (@oracle)
/skill-propose postgres-optimization # Database specialist (@hephaestus)
/skill-propose system-design         # Architecture specialist (@prometheus)
```

## How It Works

1. Harness looks up skill in registry
2. Shows skill metadata: purpose, preferred executor, requirements
3. Logs `SKILL_PROPOSED` event to PostgreSQL
4. Shows next step: execute with `/skill-load`

## Surgical Team

| Skill | Executor | Specialty |
|-------|----------|-----------|
| `code-review` | `@oracle` | Read-only architecture review |
| `postgres-optimization` | `@hephaestus` | Deep database work |
| `system-design` | `@prometheus` | Strategic planning |
| `frontend-design` | `@ux` | Accessibility-first design |
| `deep-research` | `@librarian` | Documentation search |
| `codebase-search` | `@explore` | Pattern discovery |

## Result

```json
{
  "event": "SKILL_PROPOSED",
  "skill_name": "code-review",
  "executor": "oracle",
  "description": "Read-only code review and architecture feedback",
  "requirements": ["Can read source files", "Cannot write code"]
}
```

**Note:** Only Brooks routes to specific executors. See `/skill-load`.
