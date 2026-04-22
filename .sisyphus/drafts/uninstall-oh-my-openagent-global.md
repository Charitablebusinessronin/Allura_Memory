# Draft: Uninstall Oh My OpenAgent Global Plugin

## Requirements (confirmed)
- uninstall oh my opencode/openagent plugin from global install
- target reference: https://github.com/code-yeongyu/oh-my-openagent

## Technical Decisions
- planning only; no uninstall commands will be executed in this session
- upstream uninstall path is config cleanup, not package-manager global uninstall

## Research Findings
- upstream CLI is invoked via `bunx oh-my-opencode`; it is not installed as a persistent global package
- plugin registration lives in `~/.config/opencode/opencode.json` under `plugin`
- both `oh-my-openagent` and legacy `oh-my-opencode` entries should be removed during uninstall
- optional cleanup targets: `~/.config/opencode/oh-my-openagent*.json[c]`, `~/.config/opencode/oh-my-opencode*.json[c]`, and project `.opencode/` equivalents
- verification is by ensuring the plugin no longer loads after `opencode` starts

## Open Questions
- Should the plan remove only the globally installed package, or also shell/profile/config leftovers?

## Scope Boundaries
- INCLUDE: global uninstall procedure, cleanup checks, verification steps
- EXCLUDE: executing uninstall commands unless user later switches to an implementation agent
