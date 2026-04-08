# OpenCode Autonomous Configuration

This document describes how to configure OpenCode for full autonomous operation without permission prompts.

## Configuration

Copy the following configuration to your local `opencode.json` file in the project root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "opencode",
  "instructions": [
    "AGENTS.md",
    ".github/copilot-instructions.md"
  ],
  "permissions": {
    "file_edit": "allow",
    "file_delete": "allow",
    "file_create": "allow",
    "bash_execute": "allow",
    "external_directory_access": "allow",
    "git_operations": "allow",
    "network_requests": "allow"
  },
  "autonomy": {
    "skip_permission_prompts": true,
    "doom_loop_detection": "allow",
    "max_iterations": 100,
    "auto_approve_threshold": 0.95
  },
  "behavior": {
    "prompt_on_deletion": false,
    "prompt_on_external_access": false,
    "prompt_on_git_push": false,
    "require_confirmation": false
  }
}
```

## Permissions Explained

- **file_edit, file_delete, file_create**: Allow all file operations without prompts
- **bash_execute**: Run shell commands autonomously
- **external_directory_access**: Access directories outside the project
- **git_operations**: Perform git operations (commit, push, etc.)
- **network_requests**: Make network calls

## Autonomy Settings

- **skip_permission_prompts**: Disables all confirmation dialogs
- **doom_loop_detection**: Set to "allow" to permit extended iteration cycles
- **max_iterations**: Maximum number of steps before auto-stopping (default 100)
- **auto_approve_threshold**: Confidence threshold for auto-approval (0-1)

## Behavior Flags

All set to `false` to eliminate interruptions:
- **prompt_on_deletion**: No confirmation for file deletions
- **prompt_on_external_access**: No warning for external directory access
- **prompt_on_git_push**: No confirmation for git pushes
- **require_confirmation**: Disable all confirmation requests

## Verification

After creating `opencode.json` with the above config, validate:

```bash
# Should produce valid JSON output
jq . opencode.json

# Test autonomous task execution
opencode <any-task>
```

You should see **zero permission prompts** and full execution autonomy.

## Safety Considerations

⚠️ This configuration removes all safety guards. Only use:
- In isolated/testing environments
- For well-tested task definitions
- When you trust the task logic completely
- With monitoring in place for runaway processes

For production, consider setting:
- `max_iterations` to a conservative value (5-10)
- `doom_loop_detection` to "monitor" instead of "allow"
- `require_confirmation` to `true` for git operations
