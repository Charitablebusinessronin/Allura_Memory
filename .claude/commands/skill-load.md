# /skill-load

Execute a skill by routing it to a specialist agent executor.

## Usage

```
/skill-load <skill-name> [--executor <executor-name>]
```

## Examples

```
/skill-load code-review                       # Use default executor (@oracle)
/skill-load code-review --executor oracle     # Explicit routing
/skill-load postgres-optimization --executor hephaestus
```

## How It Works

1. Validates skill exists and is available
2. Routes to preferred executor (or specified override)
3. Executor receives skill context + permissions
4. Logs `SKILL_LOADED` event to PostgreSQL
5. Executor begins work

## Surgical Team Executors

| Executor | Specialty | Permissions |
|----------|-----------|-------------|
| `oracle` | Architecture review | Read-only (no writes) |
| `hephaestus` | Deep implementation | Full read/write |
| `prometheus` | Strategic planning | Read + planning tools |
| `ux` | Design + accessibility | Design tools only |
| `librarian` | Documentation search | Search tools only |
| `explore` | Codebase patterns | Read + grep tools |
| `atlas` | Todo coordination | Task + memory tools |
| `sisyphus` | Orchestration | All tools (planning only) |

## Result

```json
{
  "event": "SKILL_LOADED",
  "skill_name": "code-review",
  "executor": "oracle",
  "context": "project root directory",
  "permissions": ["read", "grep", "lsp"]
}
```

**Note:** Only Brooks can route to executors. See `/skill-propose` for skill details.
