# ⚠️ DEPRECATED — Agents Have Moved

This directory (`.opencode/agent/`) uses the **singular, backwards-compatible** form and a **nested subdirectory structure** that OpenCode does **not** discover for project-local configs.

## Canonical Location

All agent files now live in the **flat, canonical** directory:

```
.opencode/agents/           ← PLURAL (canonical, auto-discovered)
├── brooks-architect.md     ← mode: primary
├── jobs-intent-gate.md     ← mode: primary
├── scout-recon.md           ← mode: subagent
├── fowler-refactor-gate.md ← mode: subagent
├── pike-interface-review.md ← mode: subagent
├── ralph-loop.md            ← mode: subagent
├── bellard-diagnostics-perf.md ← mode: subagent
├── dijkstra-review.md       ← mode: subagent
├── knuth-analyze.md         ← mode: subagent
└── woz-builder.md           ← mode: subagent
```

Plus explicit registration in `opencode.json` at project root.

## Why This Changed

Per the [OpenCode Agent documentation](https://opencode.ai/docs/agents/):

1. **`.opencode/agents/`** (plural) is the canonical directory name
2. **Flat files only** — OpenCode discovers agents by scanning `*.md` files, not subdirectories
3. The **filename** (minus `.md`) becomes the agent name
4. The **`mode`** field in YAML frontmatter (`primary` or `subagent`) distinguishes agent types

Issue [#2369](https://github.com/anomalyco/opencode/issues/2369) confirmed that subdirectories inside `agent/` are NOT picked up for project-local configs.

## Migration

Files in this directory are kept for reference only. **Do not edit them.** Edit the canonical copies in `.opencode/agents/` instead.