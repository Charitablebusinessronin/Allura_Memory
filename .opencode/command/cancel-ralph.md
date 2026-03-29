---
description: "Cancel active Ralph Wiggum loop"
allowed-tools: ["Bash(test -f .opencode/state/ralph-loop.json:*)", "Bash(rm .opencode/state/ralph-loop.json)", "Read(.opencode/state/ralph-loop.json)"]
hide-from-slash-command-tool: "true"
---

# Cancel Ralph

To cancel the Ralph loop:

1. Check if `.opencode/state/ralph-loop.json` exists using Bash: `test -f .opencode/state/ralph-loop.json && echo "EXISTS" || echo "NOT_FOUND"`

2. **If NOT_FOUND**: Say "No active Ralph loop found."

3. **If EXISTS**:
   - Read `.opencode/state/ralph-loop.json` to get the current iteration number from the `iteration` field
   - Remove the file using Bash: `rm .opencode/state/ralph-loop.json`
   - Report: "Cancelled Ralph loop (was at iteration N)" where N is the iteration value
