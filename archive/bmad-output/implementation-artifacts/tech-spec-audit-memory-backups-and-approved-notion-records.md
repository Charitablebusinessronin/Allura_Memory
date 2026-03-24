---
title: 'Audit memory backups and approved Notion records'
slug: 'audit-memory-backups-and-approved-notion-records'
created: '2026-03-19'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'Next.js', 'PostgreSQL', 'Neo4j', 'Notion API', 'Smithery MCP', 'Docker', 'Vitest']
files_to_modify: ['docker-compose.yml', 'docs/DEPLOYMENT.md', 'memory-bank/production-ready.md', 'src/integrations/notion.client.ts', 'src/curator/approval-sync.service.ts', 'src/lib/agents/archive.ts', 'src/lib/agents/mirror.ts']
code_patterns: ['layered memory architecture', 'append-only PostgreSQL traces', 'Neo4j promoted knowledge with immutable versioning', 'Notion as approval mirror', 'MCP-backed Notion integration', 'archive-not-delete duplicate cleanup', 'manual verification gates for environment-dependent checks']
test_patterns: ['Vitest unit tests with mocked integrations', 'singleton client tests', 'Notion sync drift tests', 'approval workflow tests', 'archive/restore tests']
---

# Tech-Spec: Audit memory backups and approved Notion records

**Created:** 2026-03-19

## Overview

### Problem Statement

The memory system has documented storage layers and Notion approval records, but backup coverage is not operationalized in-repo, live storage locations are not fully auditable from the current environment, and approved Notion insights can drift or duplicate.

### Solution

Add a small audit-and-backup workflow that inventories live storage and backup locations, creates local backup artifacts suitable for committing to GitHub, and detects then cleans duplicate approved Notion insight records while preserving a canonical entry.

### Scope

**In Scope:**
- inspect and verify PostgreSQL and Neo4j storage and backup locations
- create local backup scripts and artifacts for PostgreSQL and Neo4j
- document restore drill steps
- audit approved Notion insights and learning-log records
- detect and clean duplicate approved insight pages in Notion

**Out of Scope:**
- cloud backup infrastructure
- cross-region replication
- fully managed production backup orchestration

## Context for Development

### Codebase Patterns

- `README.md` describes the project as a unified knowledge system with PostgreSQL raw memory, Neo4j semantic memory, governance controls, ADR auditability, and Docker-backed local databases.
- The memory architecture is explicitly layered: PostgreSQL for append-only traces, Neo4j for promoted knowledge, and Notion as the human-readable approval mirror.
- Backup strategy exists as manual documentation today; automated local backups are still an identified gap, and current disaster-recovery readiness still marks automated backups as incomplete.
- Notion integrations use two patterns in the codebase: a direct REST client for agent pages and a Smithery MCP-backed client for insight records.
- Notion approval semantics are schema-sensitive and must distinguish lifecycle state from approval state; approval checks must use `Review Status` plus `AI Accessible`, not `Status` alone.
- Duplicate Notion cleanup should prefer strong identity checks like `Source Insight ID` and `Canonical Tag`, then archive extras rather than deleting canonical records.
- Live Docker volume inspection is environment-dependent and should be treated as a manual verification gate if Docker access is unavailable.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `docker-compose.yml` | Named volumes and service storage locations for PostgreSQL and Neo4j |
| `docs/DEPLOYMENT.md` | Existing manual backup and restore commands |
| `memory-bank/systemPatterns.md` | Source-of-truth architecture for traces, promoted knowledge, and Notion mirroring |
| `memory-bank/production-ready.md` | Current backup/disaster-recovery gaps |
| `_bmad-output/project-context.md` | Notion approval schema and implementation rules |
| `README.md` | High-level product architecture, local setup expectations, and database roles |
| `src/integrations/notion.client.ts` | Existing Smithery-backed Notion integration entry points |
| `src/curator/approval-sync.service.ts` | Existing Notion approval, rejection, and supersede flows for insights |
| `src/lib/agents/notion-client.ts` | Direct REST Notion client pattern with archive support |
| `src/lib/agents/archive.ts` | Existing archive semantics that preserve records and archive Notion pages |
| `src/lib/agents/mirror.ts` | Existing mirroring pipeline and archive-on-status pattern |
| `src/lib/notion/client.test.ts` | Notion client test conventions and error-handling expectations |
| `src/lib/notion/sync-monitor.test.ts` | Drift/sync monitoring test pattern |
| `src/lib/notion/design-sync.test.ts` | Sync workflow testing and approval-threshold conventions |

### Technical Decisions

- Target local backup generation first; make outputs suitable for version control where practical.
- Recommend duplicate handling as detect + canonicalize + archive-extras when identity is unambiguous.
- Treat live Docker volume confirmation as a manual verification step if runtime Docker access remains unavailable.
- Prefer new work on insight-level Notion cleanup to extend the Smithery MCP-backed integration path in `src/integrations/notion.client.ts` rather than the agent-specific REST client.
- Keep backup implementation separated into inventory/audit, backup generation, and restore drill documentation so manual verification remains explicit.
- Preserve the existing system rule of archival over deletion for Notion cleanup unless a true hard-delete requirement emerges later.

## Implementation Plan

### Tasks

- [x] Task 1: Add a backup inventory and local backup artifact layout
  - File: `docs/DEPLOYMENT.md`
  - Action: Expand the existing backup section to define the local backup directory structure, naming convention, retention expectation, and the exact manual verification steps for PostgreSQL dumps, Neo4j dumps, and Docker volume inspection.
  - Notes: Keep the distinction clear between documented live storage locations and generated backup artifacts committed to the repo.

- [x] Task 2: Add repo-local backup scripts and destination folders
  - File: `scripts/backup-postgres.sh`
  - Action: Create a shell script that writes a PostgreSQL dump into a repo-local backup directory using the documented container name and database credentials expectations.
  - Notes: Script should fail clearly when Docker or the target container is unavailable.

- [x] Task 3: Add Neo4j local backup automation
  - File: `scripts/backup-neo4j.sh`
  - Action: Create a shell script that writes a Neo4j database dump into a repo-local backup directory using the local container runtime.
  - Notes: Mirror the error-handling pattern from the PostgreSQL script and make the output path deterministic.

- [x] Task 4: Add a unified audit command for storage and backup visibility
  - File: `scripts/audit-memory-storage.sh`
  - Action: Create a script that reports Docker container availability, expected named volumes, backup output directories, and whether the latest local backup artifacts exist.
  - Notes: This script should not mutate data; it is an audit-only command for operators.

- [x] Task 5: Add restore drill documentation aligned with the new backup outputs
  - File: `docs/DEPLOYMENT.md`
  - Action: Document restore drills that consume the new repo-local backup artifacts for both PostgreSQL and Neo4j, including prerequisite checks and expected results.
  - Notes: Include an explicit manual step for verifying Docker volume presence when the environment allows runtime access.

- [x] Task 6: Extend the Smithery-backed Notion insight client with duplicate-detection helpers
  - File: `src/integrations/notion.client.ts`
  - Action: Add methods to enumerate approved insight records, group them by strong identity signals such as `Source Insight ID` and `Canonical Tag`, select a canonical page, and archive or supersede duplicates.
  - Notes: Reuse the MCP-backed integration path already used for insights rather than the agent-specific Notion client.

- [x] Task 7: Add insight cleanup orchestration around approval semantics
  - File: `src/curator/approval-sync.service.ts`
  - Action: Add a focused cleanup flow that uses the extended Notion client helpers to detect approved duplicates, preserve one canonical record, and mark extras as archived or superseded without deleting data.
  - Notes: Approval logic must continue to respect `Review Status` and `AI Accessible` as the true approval gate.

- [x] Task 8: Update readiness tracking for backup coverage
  - File: `memory-bank/production-ready.md`
  - Action: Replace the current backup TODO items with explicit checklist items tied to the new local backup scripts, restore drill, and manual Docker verification gate.
  - Notes: Keep cloud backup work out of scope and clearly marked as future work.

- [x] Task 9: Add unit tests for backup/audit and Notion duplicate cleanup logic
  - File: `src/integrations/notion.client.test.ts`
  - Action: Add tests for approved-insight filtering, duplicate grouping, canonical-page selection, and archive/supersede request generation.
  - Notes: Mock Smithery/MCP tool responses and assert that ambiguous identities do not trigger mutation.

- [x] Task 10: Add tests for orchestration and operator-facing audit behavior
  - File: `src/curator/approval-sync.service.test.ts`
  - Action: Add tests covering duplicate cleanup orchestration, no-op behavior when no duplicates exist, and safe failure behavior when Notion or Docker prerequisites are missing.
  - Notes: If script behavior is not unit-tested directly, document the manual audit command and restore drill as required verification steps.

### Acceptance Criteria

- [ ] AC 1: Given the local memory stack is configured, when an operator runs the PostgreSQL backup script, then a repo-local PostgreSQL backup artifact is created in the documented location with a deterministic name.
- [ ] AC 2: Given the local memory stack is configured, when an operator runs the Neo4j backup script, then a repo-local Neo4j backup artifact is created in the documented location with a deterministic name.
- [ ] AC 3: Given Docker or the target containers are unavailable, when an operator runs any backup or audit script, then the command exits with a clear failure message and does not claim backup success.
- [ ] AC 4: Given a valid local backup artifact exists, when an operator follows the documented restore drill, then the documentation provides exact restore commands and expected verification outcomes for PostgreSQL and Neo4j.
- [ ] AC 5: Given approved insight records in Notion contain a single canonical record, when the duplicate-audit flow runs, then it reports no mutation and leaves the record unchanged.
- [ ] AC 6: Given approved insight records in Notion contain duplicates with the same strong identity signals, when the cleanup flow runs, then it preserves one canonical page and archives or supersedes the extras.
- [ ] AC 7: Given approved insight records are ambiguous and cannot be matched confidently, when the cleanup flow runs, then it reports the ambiguity and performs no destructive or archival mutation.
- [ ] AC 8: Given the approval-sync cleanup flow inspects insight records, when it determines approval state, then it uses `Review Status` and `AI Accessible` rather than `Status` alone.
- [ ] AC 9: Given the implementation is complete, when tests run, then Vitest covers duplicate detection, canonical selection, and archive-or-no-op behavior for the Notion cleanup path.
- [ ] AC 10: Given Docker access remains unavailable in the implementation environment, when the work is reviewed, then live volume confirmation is explicitly listed as a manual verification gate rather than silently assumed complete.

## Additional Context

### Dependencies

- Docker / local container runtime for live volume inspection and dump generation
- Smithery Notion MCP connection for approved-record audit and duplicate cleanup
- Existing Postgres and Neo4j local services defined by `docker-compose.yml`
- A repo-local backup directory convention that is safe to commit and review in GitHub

### Testing Strategy

- Add Vitest coverage for duplicate insight detection and canonical-page selection logic.
- Mock Smithery/MCP Notion responses for archive and supersede flows.
- Verify backup script behavior with command construction/unit assertions and documented manual restore drills.
- Treat live Docker volume verification as a manual check in acceptance, not a unit-test requirement.
- Manually run the new audit script to confirm it reports volume, container, and backup-artifact status coherently.

### Notes

- User confirmed combined scope across backup audit, Notion duplicate cleanup, and local backup planning.
- User prefers local backups over cloud backup infrastructure.
- README says the system is a local Docker-backed memory kernel with PostgreSQL raw memory and Neo4j semantic memory, which aligns with the audit/backup scope.
- High-risk item: committing backup artifacts to GitHub may be acceptable for local/state snapshots, but restore docs should warn against storing secrets or production-sensitive dumps in the repository.
- Known limitation: live container and volume verification cannot be considered complete in environments where Docker is unreachable.

## Review Notes

- Adversarial review completed
- Findings: 12 total, 11 fixed, 1 skipped
- Resolution approach: auto-fix
