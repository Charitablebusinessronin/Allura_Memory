# Cross-Tool Agent Template Starter

## Purpose

Create one canonical source of truth for shared agent behavior, then adapt it to:
- Claude Code project skills
- OpenCode / Oh My OpenAgent agents and commands
- GitHub Copilot prompts

This avoids duplicated intent while accepting that each tool has different packaging.

## What Is Shared vs Different

### Semantically Shared
- persona / role
- responsibilities
- operating rules
- workflows
- command patterns
- safety constraints
- MCP/tool preferences

### Structurally Different
- **Claude Code** packages project skills as `.claude/skills/<name>/SKILL.md` plus `metadata.json`
- **OpenCode / Oh My OpenAgent** packages runtime behavior through `opencode.json` or `.opencode/config.json`, plus `.opencode/agent/*.md`, `.opencode/command/*.md`, and plugin config
- **GitHub Copilot** in this repo packages reusable behavior as `.github/prompts/*.prompt.md`

## Recommended Canonical Layout

Use a neutral spec outside any one tool format.

```text
shared/
  agents/
    brooks.md
  skills/
    github-workflow.md
  mappings/
    claude.md
    opencode.md
    copilot.md
```

In this planning artifact, the canonical example is `github-workflow`.

## Canonical Shared Spec Template

```md
# Skill: <skill-name>

## Intent
<What this skill is for>

## Use When
- <trigger 1>
- <trigger 2>

## Persona / Owner
- Default persona: <brooks | turing | knuth | hopper | etc.>

## Inputs
- <input 1>
- <input 2>

## Steps
1. <step 1>
2. <step 2>
3. <step 3>

## Commands / Tools
- <command or tool>

## Constraints
- <constraint 1>
- <constraint 2>

## Output Contract
- <what must be returned>
```

## Example Canonical Spec: `github-workflow`

```md
# Skill: github-workflow

## Intent
Standardize GitHub review, PR, and merge workflow across tools.

## Use When
- Creating or reviewing pull requests
- Triaging issue-driven work
- Applying repo GitHub conventions

## Persona / Owner
- Default persona: brooks
- Specialist routing: dijkstra for review, knuth for deep change analysis, hopper for discovery

## Inputs
- branch name
- PR purpose
- related issue

## Steps
1. Inspect current branch and working tree.
2. Summarize the change in repo language.
3. Create or review PR with linked issue context.
4. Apply merge strategy consistent with repository norms.

## Commands / Tools
- `gh pr create`
- `gh pr review`
- `gh pr merge --squash`

## Constraints
- Use conventional commits.
- Link issues in PR description.
- Route review to the appropriate specialist.

## Output Contract
- concise workflow summary
- exact command examples
- reviewer routing guidance
```

## Adapter: Claude Code

### Target Shape
- Skill doc: `.claude/skills/<name>/SKILL.md`
- Metadata: `.claude/skills/<name>/metadata.json`

### Adapter Notes
- Put the shared semantic content in `SKILL.md`
- Keep platform metadata thin and mechanical in `metadata.json`
- Good local reference: `.claude/skills/github/SKILL.md`

### Example Adaptation

```text
.claude/skills/github-workflow/
  SKILL.md
  metadata.json
```

`SKILL.md` should carry:
- workflow summary
- commands
- best practices

`metadata.json` should carry:
- id
- name
- description
- agents
- platforms
- tier

## Adapter: OpenCode / Oh My OpenAgent

### Target Shape
- Global/project config: `opencode.json` or `.opencode/config.json`
- Agent persona files: `.opencode/agent/**`
- Commands: `.opencode/command/*.md`
- Plugin config: `.opencode/oh-my-openagent.json`

### Adapter Notes
- Shared skill intent becomes either:
  - an agent responsibility, or
  - a command document, or
  - a config/plugin routing rule
- Good local references:
  - `.opencode/config.json`
  - `.opencode/agent/core/brooks.md`
  - `.opencode/command/curator-team-promote.md`

### Example Adaptation

For `github-workflow`, map the canonical spec into:
- an agent responsibility note under the relevant persona
- a command file such as `.opencode/command/github-workflow.md`
- optional category/agent routing in `.opencode/oh-my-openagent.json`

## Adapter: GitHub Copilot

### Target Shape
- Prompt doc: `.github/prompts/<name>.prompt.md`

### Adapter Notes
- Copilot in this repo uses prompt files, not Claude-style project skill folders
- Shared content must be flattened into:
  - frontmatter
  - explicit instructions
  - output format
- Good local reference: `.github/prompts/goal-success-agent.prompt.md`

### Example Adaptation

```md
---
description: "Use when: handling standardized GitHub PR and review workflows"
name: "GitHub Workflow Agent"
argument-hint: "Describe the branch, PR goal, or review task..."
agent: "agent"
---

# GitHub Workflow Agent

You are responsible for standardizing GitHub workflow behavior.

## Steps
1. Summarize the branch purpose.
2. Identify related issues.
3. Produce PR or review guidance.
4. Recommend merge strategy.
```

## Mapping Table

| Canonical Field | Claude Code | OpenCode / Oh My OpenAgent | GitHub Copilot |
|---|---|---|---|
| Intent | `SKILL.md` intro | command/agent purpose | prompt description + intro |
| Persona | metadata + doc text | agent file / plugin agent | prompt body |
| Steps | `SKILL.md` sections | command steps / agent instructions | prompt steps |
| Commands | `SKILL.md` code blocks | command doc / agent tool guidance | prompt instructions |
| Constraints | `SKILL.md` rules | config + prompt rules | prompt rules |
| Output Contract | `SKILL.md` expected outcome | command output expectations | output format section |

## Recommended Brooksian Team Mapping

If you want one famous-person layer over the tooling, keep the mapping stable across tools:

| Role | Recommended Persona |
|---|---|
| Default architect/orchestrator | Brooks |
| Debugging / logic | Turing |
| Deep implementation | Knuth |
| Exploration | Hopper |
| Documentation / knowledge | Berners-Lee |
| GitHub review | Dijkstra |

This preserves conceptual integrity even when the packaging changes.

## Decision

Best practical strategy:
1. Author one canonical shared spec per skill/agent concept.
2. Generate or manually adapt thin wrappers for each tool.
3. Keep semantics centralized; keep packaging local.

That is the smallest system that avoids drift without pretending all three tools support the same file model.
