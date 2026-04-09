## 2026-04-09

- OpenCode config is split across `.opencode/config.json`, `opencode.json`, and `.opencode/oh-my-openagent.json`.
- Claude workflows repeat the same surgical-team model in `.claude/commands/*`, `.claude/skills/*`, `.claude/agents/*`, and `.claude/agent-memory/*`.
- The same personas often have different model names, permissions, and team membership depending on the file.
