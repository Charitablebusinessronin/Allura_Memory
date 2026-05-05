# PRD: Allura Surgical Harness

> AI-Assisted Documentation: This document was drafted with AI assistance and must be reviewed against `guidelines/AI-GUIDELINES.md` before merge.

## Goal

Adopt selected Oh My OpenAgent harness patterns while preserving Allura's canonical architecture: Brooks orchestrates, Scout runs first, Woz builds, Allura Brain governs memory, and Allura skills/config remain source of truth.

## Required Invariants

- Brooks remains the architecture owner.
- Scout remains the first gate before implementation.
- Woz remains the default builder.
- `guidelines/AI-GUIDELINES.md` is required context for architecture, implementation, and documentation work.
- Skills may declare MCP requirements, but MCP activation requires Brooks/mcp-harness approval.
- Ralph and `ulw` execution must pass the ContextScout + skill + validation gate before writing.

## User-Facing Command Surface

```text
WS      Status
ST      Start
CH      Chat
DG      Define Goal
SK      Skill Create
VA      Validate Architecture
CA      Create Architecture
NX      Next Steps
NX→R    Ralph Loop
NX→S    Structure Intent
PM      Party Mode
GO      Execute
DA      Exit
MH      Menu
```

## Feature Requirements

### IntentGate

Classify requests before routing:

```text
chat | status | research | architecture | implementation | debugging | frontend-design | documentation | skill-creation | mcp-configuration | ralph-loop | party-mode | exit | needs-clarification
```

Routing must preserve Allura ownership:

- research → Scout
- architecture → Brooks
- implementation → Scout → Woz
- debugging → systematic-debugging → Bellard/Carmack/Woz
- frontend-design → frontend-design/allura-design → Woz
- documentation → quick-update/readme-memory
- skill-creation → Brooks → skill-creator
- mcp-configuration → Brooks/Hightower → mcp-harness

### Governed `ulw` / `ultrawork`

`ulw` means governed persistence, not blind agent swarm:

```text
IntentGate → Scout recon → Brain search → skill resolver → Brooks route → Team RAM execution → validation → memory write-back
```

### `NX→R` Ralph Loop

`NX→R` means Ralph Loop execution path. If only drafting a command, label the result **Ralph Preview**.

### Skill-Embedded MCPs

Skills may include MCP manifests or allowed MCP tools. MCPs are activated only when relevant and approved.

## Acceptance Criteria

- Menu is vertical.
- `NX→R` points to Ralph Loop, not only prompt generation.
- IntentGate command exists and documents routing.
- `ulw` command exists and enforces Scout-first execution.
- Penpot, Perplexica, and MCP Docker are represented as skills.
- Validation includes typecheck or an explicit documented fallback.
