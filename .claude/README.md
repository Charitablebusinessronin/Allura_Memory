# OpenCode Config

This directory stores the repo-local OpenCode configuration for Allura Memory.

## Source of truth

- `opencode.json` holds the session model and top-level config.
- `.opencode/agent/` holds the Team RAM agent definitions.
- `.opencode/config/` holds supplemental registry data for local tooling.
- `.opencode/rules/` holds stable operational rules that agents load directly.
- `.opencode/docs/` holds supporting guides and historical tracking notes.
- `.opencode/tool/plugin-runtime/` holds the local OpenCode plugin package manifest and installed dependencies.

## Current model

- `ollama-cloud/glm-5.1`

## Root policy

- Only Markdown files should live at the `.opencode/` root.
- Non-Markdown operational files must live in nested folders.
- Current root Markdown files: `README.md`, `AI-GUIDELINES.md`, `AGENTS.md`, `MODEL_REGISTRY.md`.

## Documentation layout

- `AI-GUIDELINES.md` stays at the `.opencode/` root because scripts, contracts, and smoke tests load that exact path.
- `docs/guides/HARNESS-GUIDE.md` is the operator guide for harness slash commands.
- `docs/tracking/BROOKS-TRACKING.md` is retained as a historical tracking spec, not live config.
- `docs/archive/` and `docs/archive/handoffs/` are the right home for dated session handoffs and superseded planning notes.
- `config/env.example` now holds the local environment template.
- `tool/plugin-runtime/` now holds `package.json`, `package-lock.json`, `.gitignore`, and `node_modules/` so the root stays documentation-first.

## Notes

- Team RAM is the active agent set.
- Avoid reintroducing legacy OAC agent names.
- Keep agent permissions in the agent markdown frontmatter.
