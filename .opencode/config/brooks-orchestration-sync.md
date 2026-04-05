# Brooks Orchestration Sync

This document defines how the local OpenCode runtime, BMad manifests, and Notion catalog stay aligned.

## Primary Runtime Identity

- Runtime orchestrator id: `memory-orchestrator`
- Bound persona: `Frederick P. Brooks Jr.`
- Persona source: `https://www.notion.so/3181d9be65b3805da320eace4cd56d2b`
- Runtime architect id: `memory-architect`

## Operating Model

- **Orchestrator**: Brooks plans, routes, enforces conceptual integrity, and loads memory before acting.
- **Subagents**: `memory-*` subagents remain the execution layer.
- **Party mode**: `bmad-party-mode` remains an optional multi-agent collaboration path and does not replace subagents.

## Memory Policy

- Logging mode: **dual**
  - PostgreSQL: append-only operational events and audit evidence
  - Neo4j: semantic insights, patterns, lineage, and reusable lessons
- No claim of persistence without successful MCP responses and readback evidence.

## Tenant Boundary Policy

- `organization_id` = business boundary
- `group_id` = memory partition boundary
- `allura-roninmemory` = system agents partition (governed global)
- `global-coding-skills` = governed global pattern partition

Every workflow run, event, and memory write must carry both `organization_id` and `group_id`, unless explicitly promoted to a governed global partition.

## Source Of Truth Precedence

1. Runtime registry: `.opencode/config/agent-metadata.json`
2. AI-GUIDELINES.md: Documentation standards governing all project documentation
3. Memory contract: `.opencode/config/memory-contract.md`
4. BMad integration settings: `_bmad/_config/ides/opencode.yaml`
5. BMad manifests: `_bmad/_config/agent-manifest.csv`, `_bmad/_config/skill-manifest.csv`, `_bmad/_config/bmad-help.csv`
6. Notion catalog mirror: `collection://3371d9be-65b3-8182-bfb0-000baf828f22`

## Documentation Quality Gate

Before any doc-producing workflow completes, validate against AI-GUIDELINES.md Section 4 (Document Quality Standards):

- **Completeness checklist**: All required sections present
- **Traceability**: B# IDs trace to implementation artifacts
- **Decision status**: AD-## decisions have explicit status
- **Diagram rendering**: Mermaid diagrams render correctly
- **AI disclosure**: AI-assistance disclosure present where required
- **Secret hygiene**: No secrets in documentation or logs

Workflows that fail the quality gate must remediate before marking complete.

## Notion Sync Model

- Notion is the human-facing catalog and planning reference.
- Local config/manifests are execution truth.
- Sync policy is non-destructive upsert: create/update only, no deletes.

## Catalog Coverage

- Runtime primary agents
- Runtime subagents
- BMad persona agents
- Core orchestration workflows, especially `bmad-party-mode`
