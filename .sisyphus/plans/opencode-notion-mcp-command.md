# Plan: OpenCode Notion MCP Command

> [!NOTE]
> **AI-Assisted Planning Artifact**
> Portions of this plan were drafted with the assistance of an AI language model.
> Content should be reviewed against `AI-GUIDELINES.md`, `AGENTS.md`, `.opencode/config.json`, and team intent before implementation.
> When in doubt, defer to code, schemas, and team consensus.

## Goal

Create a new `.opencode` command that standardizes **Notion automation through MCP tools** without hand-written API integration, adds the necessary command-level context/config references, and documents usage in a focused README.

## Interpretation Locked In

- Packaging: **OpenCode command** under `.opencode/command/*.md`
- README scope: **skill/command only**
- Integration style: **MCP-first**, especially Notion/MCP_DOCKER-oriented workflows
- Constraint: **no custom raw API integration**; use MCP surfaces instead

## Requirements

1. The new command must live in `.opencode/command/`.
2. The command must explain how Notion work is performed through MCP tools, not direct API code.
3. Relevant context/instruction files must reference the new command if needed.
4. Relevant OpenCode config must include or preserve the context needed to make the command discoverable.
5. A focused README must explain the command purpose, invocation, MCP expectations, and limits.
6. All new documentation must follow `AI-GUIDELINES.md` disclosure and source-of-truth rules.

## Out of Scope

- Building a full Notion integration service
- Adding direct Notion HTTP/API client code
- Reorganizing the entire `.opencode` architecture
- Creating a new cross-tool framework beyond what this command needs

## Implementation Strategy

Use the smallest coherent change set:
- one new OpenCode command doc
- one focused README for that command/capability
- minimal updates to `.opencode/config.json` or adjacent instruction wiring only if necessary
- optional supporting context note if command discoverability otherwise depends on undocumented knowledge

## TODOs

- [ ] Inspect existing `.opencode/command/*.md` files to copy command structure and tone.
- [ ] Inspect existing `.opencode/plugin/*.md` and config files to determine the correct place to document MCP-first Notion behavior.
- [ ] Define the command contract: name, invocation syntax, inputs, expected output, and explicit MCP-only constraints.
- [ ] Create the new `.opencode/command/*.md` file with AI disclosure block and clear instructions.
- [ ] Create a focused README describing the command, MCP tool expectations, configuration assumptions, and examples.
- [ ] Update `.opencode/config.json` and/or nearby context files only if needed so the command is discoverable and aligned with existing instructions.
- [ ] Verify the changed docs reference real repo paths and do not claim unsupported raw-API behavior.

## Acceptance Criteria

- The command file exists under `.opencode/command/`.
- The command clearly instructs MCP-first Notion automation and explicitly avoids hand-written API integration.
- The README exists and is limited to the new command/capability.
- Any config/context changes are minimal and consistent with `.opencode/config.json` and `opencode.json`.
- Documentation includes the required AI-assisted disclosure block where applicable.
- The final wording does not claim capabilities beyond the available MCP/tool surfaces.

## Risks / Decisions

### Decision
Prefer a command document over inventing a new `.opencode/skills/` convention, because the repository already uses `.opencode/command/` as the nearest matching pattern.

### Risk
The exact MCP tool inventory for Notion may vary by session/runtime.

### Mitigation
Document the command in terms of MCP-backed Notion workflows and clearly state assumptions/required MCP availability instead of hard-coding unsupported guarantees.

## Final Verification Wave

- [ ] F1: Command file follows existing `.opencode/command/*.md` conventions and includes disclosure.
- [ ] F2: README is focused, accurate, and consistent with `AI-GUIDELINES.md`.
- [ ] F3: Config/context updates are minimal, necessary, and consistent with existing OpenCode config.
- [ ] F4: No documentation claims direct API integration; MCP-first constraint is explicit throughout.
