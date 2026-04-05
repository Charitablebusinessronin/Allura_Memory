# Error Pattern: OpenCode Configuration Errors

> **Logged:** 2026-04-04
> **Event ID:** 27144 (PostgreSQL)
> **Agent:** MemoryOrchestrator
> **Status:** Resolved

---

## Error 1: Missing Agent Prompt Files

### Symptom
```
Configuration is invalid at /home/ronin704/Projects/roninmemory/opencode.json: 
bad file reference: "{file:.opencode/agent/core/coder.md}" 
/home/ronin704/Projects/roninmemory/.opencode/agent/core/coder.md does not exist
```

### Root Cause
The `opencode.json` referenced agent prompt files that didn't exist in `.opencode/agent/core/`.

### Missing Files
| Agent | File |
|-------|------|
| `memory-builder` | `.opencode/agent/core/coder.md` |
| `memory-guardian` | `.opencode/agent/core/reviewer.md` |
| `memory-scout` | `.opencode/agent/core/contextscout.md` |
| `memory-chronicler` | `.opencode/agent/core/documentation.md` |

### Fix
Created all 4 missing prompt files with appropriate Brooks-bound agent personas.

### Prevention
When adding agents to `opencode.json`, always:
1. Create the prompt file FIRST
2. Verify the file exists before referencing it
3. Run `opencode --help` to validate config

---

## Error 2: Invalid Theme Color

### Symptom
```
Configuration is invalid at /home/ronin704/Projects/roninmemory/opencode.json
↳ Invalid hex color format agent.memory-scout.color
```

### Root Cause
The `memory-scout` agent used `"color": "muted"` which is NOT a valid OpenCode theme color.

### Valid OpenCode Theme Colors
- `primary`
- `secondary`
- `accent`
- `success`
- `warning`
- `error`
- `info`
- **Or** a hex color like `#FF5733`

### Fix
Changed `"color": "muted"` → `"color": "secondary"` for `memory-scout` agent.

### Prevention
Only use the 7 valid theme colors or hex format (#RRGGBB) for agent colors.

---

## Current Agent Color Scheme

| Agent | Color |
|-------|-------|
| `memory-orchestrator` | `accent` |
| `memory-architect` | `info` |
| `memory-builder` | `success` |
| `memory-guardian` | `warning` |
| `memory-scout` | `secondary` |
| `memory-chronicler` | `info` |
| `roninmemory-project` | `accent` |

---

## Verification Command

```bash
# Quick config validation
opencode --help 2>&1 | head -5

# If it shows the ASCII art banner without errors, config is valid
```
