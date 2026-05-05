# Superpowers Workflow — Allura Memory

Execution lifecycle for turning ideas into shipped code with full AI-GUIDELINES compliance.

## The Flow

```
brainstorming → writing-plans → subagent-driven-development → validation → merge
```

## Directory Structure

```
docs/superpowers/
├── specs/          # Design specs (output of brainstorming)
├── plans/          # Implementation plans (output of writing-plans)
└── README.md       # This file
```

## How It Connects to AI-GUIDELINES

| Superpowers Step | AI-GUIDELINES Requirement |
|------------------|--------------------------|
| brainstorming | Spec must reference B#/F# from Blueprint |
| writing-plans | Final task always updates Requirements Matrix + Data Dictionary |
| executing-plans | Same-PR rule: code + doc updates in one commit sequence |
| validation | Completeness checklist runs before merge |

## Rules

1. **No code without a spec** — brainstorming skill is mandatory before implementation
2. **No spec without F# traceability** — every spec maps to Blueprint requirements
3. **No merge without doc updates** — every plan ends with a documentation task
4. **Brain logs decisions** — significant choices persist to Allura Brain for future sessions
5. **Bun only** — all commands use bun, never npm/npx

## Skills (installed in both .claude/ and .opencode/)

| Skill | Trigger |
|-------|---------|
| `brainstorming` | Before any creative/feature work |
| `writing-plans` | After spec is approved |
| `executing-plans` | Inline execution of a plan |
| `subagent-driven-development` | Parallel execution with review gates |
