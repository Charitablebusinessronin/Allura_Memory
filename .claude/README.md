# OpenCode Config

This directory stores the repo-local OpenCode configuration for Allura Memory.

## Source of truth

- `opencode.json` holds the session model and top-level config.
- `.opencode/agent/` holds the Team RAM agent definitions.
- `.opencode/config/` holds supplemental registry data for local tooling.

## Current model

- `ollama-cloud/glm-5.1`

## Notes

- Team RAM is the active agent set.
- Avoid reintroducing legacy OAC agent names.
- Keep agent permissions in the agent markdown frontmatter.
