---
name: opencode-session-optimization
description: Fix sluggish OpenCode sessions - clear tokens, reduce context bloat, optimize terminal performance
---

# OpenCode Session Optimization

## Overview

OpenCode sessions get sluggish when:
- Token count grows too high (>30k tokens)
- Too many modified files tracked
- Terminal buffer accumulates large output history
- Context window gets bloated with old conversation

**Core principle:** Clear before it slows, commit to reduce tracking, restart when needed.

## Quick Fixes (Do These First)

### 1. Clear OpenCode Session (Fastest - 5 seconds)

**Keyboard shortcut:**
```
Ctrl+Shift+P → "OpenCode: Clear Session" → Enter
```

**Or click:**
- Trash/reset icon in OpenCode panel (if visible)
- Right-click panel → "Clear Session"

**What this does:**
- Resets token count to ~0
- Keeps file changes intact
- Clears conversation context
- Preserves working directory state

**When to use:** Token count >25k, slow response times

---

### 2. Clear Terminal Buffer

```bash
# In terminal
clear

# Or in VS Code:
Ctrl+K then Ctrl+J  # Toggle terminal
# Then type "clear" or Ctrl+L
```

**Alternative:** Kill terminal and reopen:
```
Ctrl+Shift+P → "Terminal: Kill All Terminals"
Ctrl+Shift+P → "Terminal: Create New Terminal"
```

**When to use:** Terminal slow to render, large output history

---

### 3. Stage/Commit Files to Reduce Modified Tracking

```bash
# Check what's modified
git status

# Stage and commit to clear the list
git add .
git commit -m "checkpoint: [brief description]"
```

**When to use:** Modified files list >20 files, OpenCode panel sluggish

---

### 4. Full OpenCode Panel Reset

```
Ctrl+Shift+P → "OpenCode: Kill Agent"
# Wait 3 seconds
Ctrl+Shift+P → "OpenCode: Focus Agent Panel"
```

**When to use:** Panel completely frozen, no response to commands

---

## Prevention Schedule

| Action | Frequency | Trigger |
|--------|-----------|---------|
| Clear session | Every 30-45 min | Token count >20k |
| Commit changes | Every 15-20 min | >10 modified files |
| Clear terminal | Every 20 min | Large outputs |
| Restart VS Code | Every 2-3 hours | General slowdown |

---

## Token Management Best Practices

### Keep Messages Concise

**Instead of:**
```
Here is the complete output of the command that ran and produced many lines of text that I am now pasting into the conversation which uses many tokens...
```

**Do:**
```
Command succeeded. Key results:
- File created: src/example.ts
- 3 tests passed
- Output saved to: /tmp/output.log
```

### Use Files for Large Outputs

**Instead of:**
Pasting 500 lines of logs into chat

**Do:**
```bash
# Save to file
cat large-output.txt > /tmp/debug-output.log

# Then in chat:
# "See /tmp/debug-output.log for full output"
```

### Avoid Large Pastes

- Don't paste entire files unless necessary
- Use `read` tool to show specific sections
- Reference file paths instead of content

---

## Advanced Diagnostics

### Check Token Count

Look at OpenCode panel status bar:
```
Tokens: 34,133 (13% used)
```

**Thresholds:**
- <10k: Good
- 10k-25k: Watch
- 25k-40k: Clear soon
- >40k: Clear immediately

### Check Memory Usage

```bash
# VS Code process memory
ps aux | grep -i "code" | head -5

# System memory
free -h
```

### Profile Extension

```
Ctrl+Shift+P → "Developer: Show Running Extensions"
# Look for OpenCode extension memory/time usage
```

---

## Emergency Recovery

If OpenCode is completely frozen:

1. **Save your work**
   ```
   Ctrl+S  # Save all files
   ```

2. **Kill VS Code window**
   ```
   Ctrl+Shift+P → "Developer: Reload Window"
   ```

3. **Full restart if needed**
   ```
   Ctrl+Q  # Quit VS Code
   # Reopen project
   ```

4. **Check for updates**
   ```
   Click "Update Available" in bottom right
   # Or: Ctrl+Shift+P → "OpenCode: Check for Updates"
   ```

---

## Configuration Optimization

### Reduce Context Window Size

In `.opencode/opencode.json`:
```json
{
  "context": {
    "maxTokens": 40000,
    "trimThreshold": 35000
  }
}
```

### Disable Auto-Context for Large Files

Add to `.opencode/opencode.json`:
```json
{
  "context": {
    "excludePatterns": [
      "*.min.js",
      "*.lock",
      "node_modules/**",
      "dist/**",
      ".tmp/**"
    ]
  }
}
```

---

## Red Flags - Act Immediately

- Token count >40k
- Response time >10 seconds
- Terminal takes >3 seconds to show typed text
- Modified files list >50
- "Thinking..." indicator stuck >30 seconds

---

## Quick Reference Commands

| Command | Action | When |
|---------|--------|------|
| `Ctrl+Shift+P` → "Clear Session" | Reset tokens | Token bloat |
| `clear` | Terminal reset | Slow terminal |
| `git commit` | Reduce tracking | Many files |
| `Ctrl+Shift+K` | Kill agent | Frozen panel |
| `Ctrl+Shift+R` | Reload window | Emergency |

---

## Integration with Memory System

Log optimization events:

```javascript
// After clearing session
log_event({
  group_id: "roninmemory",
  event_type: "session_optimized",
  agent_id: "opencode-session-optimization",
  metadata: {
    action: "clear_session",
    tokens_before: 34133,
    tokens_after: 0,
    modified_files: 25
  }
});
```

---

## Success Criteria

- [ ] Token count stays below 30k during work session
- [ ] Response time <3 seconds for normal queries
- [ ] Terminal renders text immediately
- [ ] No session crashes or freezes
- [ ] Clear session at least every 45 minutes
