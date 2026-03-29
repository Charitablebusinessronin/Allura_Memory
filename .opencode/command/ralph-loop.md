---
description: "Start Ralph Wiggum iterative loop for persistent task execution"
argument-hint: "PROMPT [--max-iterations N] [--completion-promise TEXT]"
allowed-tools: ["Bash(.opencode/scripts/ralph-loop.sh:*)"]
hide-from-slash-command-tool: "true"
---

# Ralph Loop Command

Execute the setup script to initialize the Ralph loop:

```!
".opencode/scripts/ralph-loop.sh" $ARGUMENTS
```

Please work on the task. When you try to exit, the Ralph loop will feed the SAME PROMPT back to you for the next iteration. You'll see your previous work in files and git history, allowing you to iterate and improve.

## How It Works

1. **Initialization**: Creates state file at `.opencode/state/ralph-loop.json`
2. **Iteration**: On each session end, the loop feeds the prompt back
3. **Tracking**: Maintains iteration count and progress
4. **Completion**: Stops when completion promise is fulfilled or max iterations reached

## Examples

```bash
# Infinite loop (manual stop)
/ralph-loop "Refactor the authentication system"

# Max 10 iterations
/ralph-loop "Optimize database queries" --max-iterations 10

# With completion promise
/ralph-loop "Add user dashboard" --completion-promise "Dashboard is fully functional"
```

## State Management

- State file: `.opencode/state/ralph-loop.json`
- Contains: iteration, max_iterations, completion_promise, prompt, created_at
- Updated: After each iteration
- Cleanup: Auto-removed on completion or via `/cancel-ralph`

## Integration with Memory System

The Ralph loop is designed to work with roninmemory's memory system:
- Each iteration can log progress to PostgreSQL traces
- Neo4j can store iteration insights
- HITL gates can approve major transitions

CRITICAL RULE: If a completion promise is set, you may ONLY output it when the statement is completely and unequivocally TRUE. Do not output false promises to escape the loop, even if you think you're stuck or should exit for other reasons. The loop is designed to continue until genuine completion.
