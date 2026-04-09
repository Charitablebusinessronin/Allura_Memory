# Draft: OpenCode Skill + Context + Config

## Requirements (confirmed)
- Create a skill under `.opencode`
- Add it to context and config
- Add a README
- Follow `AI-GUIDELINES.md`

## Technical Decisions
- Planning mode only: no source implementation outside `.sisyphus/*`
- Repository conventions must defer to `AI-GUIDELINES.md`, `AGENTS.md`, `.opencode/config.json`, and existing `.opencode` layout

## Research Findings
- `.opencode/config.json` already loads `AGENTS.md`, `.github/copilot-instructions.md`, and `AI-GUIDELINES.md` as instructions
- `.opencode/config.json` and `opencode.json` both enable plugin `oh-my-openagent`
- Existing OpenCode packaging in repo uses `.opencode/agent/**`, `.opencode/command/*.md`, and plugin/config JSON files

## Open Questions
- What is the exact purpose of the new skill?
- Should it be packaged as an OpenCode command, agent prompt, plugin doc, or a new documented convention under `.opencode`?
- What README scope is wanted: the new skill only, or the whole `.opencode` folder?

## Scope Boundaries
- INCLUDE: planning the new `.opencode` skill/config/context/readme work
- EXCLUDE: implementing repository code outside `.sisyphus/*` in this mode
