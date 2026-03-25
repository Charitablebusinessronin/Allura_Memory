# Docker Cleanup for Single-Memory Architecture — Implementation Tasks

> Status: Ready for execution — migrated from standalone document  
> Estimated Effort: Short  
> Parallel Execution: YES — 3 waves + final verification  
> Critical Path: Inventory/guardrails → Supabase removal → verification + docs

---

## Overview

This document tracks the implementation tasks for removing Supabase artifacts and consolidating the Docker runtime around Ronin Memory + Mission Control + Stirling-PDF, without touching OpenClaw desktop.

**Quick Summary:**
- **Supabase containers/services:** To be removed (confirmed empty, 0 tables/0 rows)
- **Kept services:** knowledge-postgres, knowledge-neo4j, knowledge-dozzle, mission-control, stirling-pdf
- **Out of scope:** OpenClaw desktop, gateway, researcher, dashboard, mcp services

---

## Execution Waves

| Wave | Tasks | Execution |
|------|-------|-----------|
| Wave 1 | T1–T5 | Parallel (no dependencies) |
| Wave 2 | T6–T10 | Sequential (see dependency matrix) |
| Wave 3 | T11–T14 | Parallel documentation tasks |
| Final | F1–F4 | Parallel verification reviews |

---

## Wave 1: Foundation + Safety Baseline

### T1: Baseline Container + Port Inventory Snapshot

**What to do:**
- Capture full pre-cleanup inventory: running/all containers, volumes, networks, and mapped ports.
- Save outputs to evidence files as baseline for rollback/comparison.

**Must NOT do:**
- Do not stop/remove any container in this task.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** T3, T9
- **Blocked By:** None

**References:**
- `docker-compose.yml:1-229` — Canonical service definitions to compare with live runtime.

**Acceptance Criteria:**
- [ ] Evidence files created for containers/ports/volumes/networks snapshots.

**QA Scenarios:**
```
Scenario: Capture full baseline
  Tool: Bash
  Steps:
    1. Run docker ps and docker ps -a with formatted names/status/ports.
    2. Run docker volume ls and docker network ls.
    3. Save outputs to docs/evidence/task-1-baseline.txt.
  Expected Result: Evidence file exists and lists current runtime state.
  Evidence: docs/evidence/task-1-baseline.txt

Scenario: Baseline includes required keep-services
  Tool: Bash
  Steps:
    1. Search baseline file for knowledge-postgres/knowledge-neo4j/knowledge-dozzle.
    2. Assert each appears at least once.
  Expected Result: All required keep-services present in baseline.
  Evidence: docs/evidence/task-1-baseline-assert.txt
```

**Commit:** NO

---

### T2: Supabase Artifact Discovery

**What to do:**
- Enumerate all Supabase-related containers, networks, volumes, images by name labels/prefix.
- Produce exact deletion targets list.

**Must NOT do:**
- Do not include non-Supabase resources in removal list.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** T6, T7
- **Blocked By:** None

**References:**
- Original doc Context → Interview Summary — Confirmed keep/remove policy from user decisions.

**Acceptance Criteria:**
- [ ] A scoped list of Supabase-only artifacts is captured in evidence.

**QA Scenarios:**
```
Scenario: Build Supabase artifact list
  Tool: Bash
  Steps:
    1. Query docker ps -a, docker volume ls, docker network ls for supabase-prefixed names.
    2. Save normalized list to docs/evidence/task-2-supabase-artifacts.txt.
  Expected Result: File contains only Supabase-related identifiers.
  Evidence: docs/evidence/task-2-supabase-artifacts.txt

Scenario: Validate list excludes keep-services
  Tool: Bash
  Steps:
    1. Check artifact list does not include knowledge-* / mission-control / stirling-pdf.
  Expected Result: No false-positive non-Supabase identifiers.
  Evidence: docs/evidence/task-2-exclusion-check.txt
```

**Commit:** NO

---

### T3: Create Guardrail Matrix

**What to do:**
- Produce explicit matrix mapping each discovered resource to action: KEEP/REMOVE/DO-NOT-TOUCH.
- Include rationale column tied to user decisions.

**Must NOT do:**
- Do not assign REMOVE to ambiguous services (gateway/researcher/dashboard/mcp) without explicit approval.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** T6, T7, T8
- **Blocked By:** T1

**References:**
- Original doc Work Objectives → Must Have / Must NOT Have — Scope boundaries and confirmed keep/remove intent.
- `docker-compose.yml:55-217` — Services likely to be confused with cleanup scope.

**Acceptance Criteria:**
- [ ] Matrix exists and every discovered resource has explicit action.

**QA Scenarios:**
```
Scenario: Generate complete action matrix
  Tool: Bash
  Steps:
    1. Combine baseline + supabase artifacts list.
    2. Generate matrix in docs/evidence/task-3-guardrail-matrix.md.
  Expected Result: No resource left unclassified.
  Evidence: docs/evidence/task-3-guardrail-matrix.md

Scenario: Validate required keeps are protected
  Tool: Bash
  Steps:
    1. Assert matrix marks knowledge-postgres/neo4j/dozzle, mission-control, stirling-pdf as KEEP.
  Expected Result: All user-required services protected from deletion.
  Evidence: docs/evidence/task-3-protection-check.txt
```

**Commit:** NO

---

### T4: Prepare Rollback Checkpoints

**What to do:**
- Define rollback commands and checkpoints for each retained service.
- Capture pre-cleanup health endpoint/status for quick recovery diff.

**Must NOT do:**
- Do not alter running config; this is checkpointing only.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** T6
- **Blocked By:** None

**References:**
- `docs/DEPLOYMENT.md:124-143` — Existing health-check style and command conventions.

**Acceptance Criteria:**
- [ ] Rollback checklist saved with service-specific restart/health commands.

**QA Scenarios:**
```
Scenario: Create rollback checklist
  Tool: Bash
  Steps:
    1. Draft command list for restart + health verification per kept service.
    2. Save to docs/evidence/task-4-rollback-checklist.md.
  Expected Result: Checklist includes all required keep-services.
  Evidence: docs/evidence/task-4-rollback-checklist.md

Scenario: Dry-run syntax validation
  Tool: Bash
  Steps:
    1. Validate command syntax (no destructive execution) where possible.
  Expected Result: No malformed rollback commands.
  Evidence: docs/evidence/task-4-syntax-check.txt
```

**Commit:** NO

---

### T5: Pre-Cleanup Health Verification

**What to do:**
- Verify health/status for PostgreSQL, Neo4j, Dozzle, Mission Control endpoints, Stirling-PDF endpoint.
- Record exact response codes and statuses before any removals.

**Must NOT do:**
- Do not restart containers during this verification unless service is already unhealthy.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** T10
- **Blocked By:** None

**References:**
- `docs/DEPLOYMENT.md:124-141` — Existing health-check commands and expectations.

**Acceptance Criteria:**
- [ ] Evidence includes pre-cleanup health for every keep-service.

**QA Scenarios:**
```
Scenario: Validate keep-services are healthy pre-cleanup
  Tool: Bash
  Steps:
    1. Run pg_isready for knowledge-postgres.
    2. Run Neo4j HTTP check on localhost:7474.
    3. Run HTTP checks for Mission Control + Stirling-PDF + Dozzle.
    4. Save results to docs/evidence/task-5-prehealth.txt.
  Expected Result: Required services return healthy status/200 where applicable.
  Evidence: docs/evidence/task-5-prehealth.txt

Scenario: Handle failing service gracefully
  Tool: Bash
  Steps:
    1. If any check fails, log service name + failure output and stop cleanup progression.
  Expected Result: Failure captured and cleanup not executed blindly.
  Evidence: docs/evidence/task-5-prehealth-failures.txt
```

**Commit:** NO

---

## Wave 2: Removal + Environment Alignment

### T6: Stop Supabase Services Cleanly

**What to do:**
- Stop Supabase stack using official command path first, then stop any residual Supabase containers by exact identifier.

**Must NOT do:**
- Do not stop non-Supabase containers.

**Parallelization:**
- **Can Run In Parallel:** NO
- **Blocks:** T7
- **Blocked By:** T2, T3, T4

**References:**
- `docs/evidence/task-2-supabase-artifacts.txt` — Authoritative stop targets.

**Acceptance Criteria:**
- [ ] All Supabase containers show stopped/exited state before removal.

**QA Scenarios:**
```
Scenario: Clean stop of Supabase runtime
  Tool: Bash
  Steps:
    1. Execute supabase stop in its project dir (if applicable).
    2. Stop remaining Supabase containers from scoped list.
    3. Save output to docs/evidence/task-6-stop-supabase.txt.
  Expected Result: No targeted Supabase container remains in running state.
  Evidence: docs/evidence/task-6-stop-supabase.txt

Scenario: Protection check for keep-services
  Tool: Bash
  Steps:
    1. Immediately list keep-services status after stop action.
  Expected Result: Keep-services remain running.
  Evidence: docs/evidence/task-6-keep-services-intact.txt
```

**Commit:** NO

---

### T7: Remove Supabase Containers, Networks, and Scoped Volumes

**What to do:**
- Remove all Supabase containers and associated networks/volumes identified in scoped artifact list.
- Preserve non-Supabase shared resources.

**Must NOT do:**
- Do not run broad destructive commands (`docker system prune -a`).

**Parallelization:**
- **Can Run In Parallel:** NO
- **Blocks:** T8, T10
- **Blocked By:** T2, T3, T6

**References:**
- `docs/evidence/task-2-supabase-artifacts.txt` — Exact deletion targets.
- `docs/evidence/task-3-guardrail-matrix.md` — Keep/remove policy.

**Acceptance Criteria:**
- [ ] No Supabase container/network/volume remains.
- [ ] Keep-services still present.

**QA Scenarios:**
```
Scenario: Remove only scoped Supabase artifacts
  Tool: Bash
  Steps:
    1. Remove each Supabase target by explicit identifier.
    2. Re-list containers/networks/volumes filtered by supabase.
    3. Save to docs/evidence/task-7-removal-results.txt.
  Expected Result: Supabase filters return empty results.
  Evidence: docs/evidence/task-7-removal-results.txt

Scenario: Negative guardrail check
  Tool: Bash
  Steps:
    1. Compare keep-services presence before/after removal.
  Expected Result: No keep-service removed or stopped unexpectedly.
  Evidence: docs/evidence/task-7-guardrail-check.txt
```

**Commit:** YES  
**Message:** `chore(docker): remove supabase runtime artifacts`

---

### T8: Validate Runtime No Longer References Supabase

**What to do:**
- Search operational scripts/docs/config references that imply active Supabase runtime dependency.
- Remove or mark obsolete references that contradict target architecture.

**Must NOT do:**
- Do not rewrite unrelated documentation sections.

**Parallelization:**
- **Can Run In Parallel:** YES (parallel with T9)
- **Blocks:** T11
- **Blocked By:** T3, T7

**References:**
- `docs/DEPLOYMENT.md:94-123` — Current Docker service documentation to align.

**Acceptance Criteria:**
- [ ] No active runbook instruction relies on Supabase runtime.

**QA Scenarios:**
```
Scenario: Identify and resolve Supabase runtime references
  Tool: Grep + Edit
  Steps:
    1. Search for 'supabase' references in docs/scripts.
    2. Remove or annotate only runtime-related obsolete references.
    3. Save diff summary to docs/evidence/task-8-reference-cleanup.txt.
  Expected Result: No contradictory active runtime instructions remain.
  Evidence: docs/evidence/task-8-reference-cleanup.txt

Scenario: Negative check for accidental broad edits
  Tool: Bash
  Steps:
    1. Review changed-file list; assert only scoped docs/scripts touched.
  Expected Result: No unrelated files changed.
  Evidence: docs/evidence/task-8-scope-check.txt
```

**Commit:** NO

---

### T9: Reconcile and Document Actual Ports

**What to do:**
- Detect actual bound ports from live runtime.
- Update plan docs/runbook with factual values (no assumptions).

**Must NOT do:**
- Do not change service port mappings in this task; documentation-only reconciliation.

**Parallelization:**
- **Can Run In Parallel:** YES (parallel with T8)
- **Blocks:** T11
- **Blocked By:** T1

**References:**
- `docker-compose.yml:117-166` — Declared mission-control ports.
- Original doc Context → Interview Summary — User-confirmed expected ports and keep list.

**Acceptance Criteria:**
- [ ] Runbook contains verified live ports and notes any compose-vs-runtime discrepancy.

**QA Scenarios:**
```
Scenario: Detect live port bindings
  Tool: Bash
  Steps:
    1. Inspect docker port mappings for mission-control and stirling-pdf.
    2. Test candidate endpoints with curl.
    3. Save to docs/evidence/task-9-port-reconcile.txt.
  Expected Result: A single documented source of truth for active ports.
  Evidence: docs/evidence/task-9-port-reconcile.txt

Scenario: Negative mismatch handling
  Tool: Bash
  Steps:
    1. If mismatch found, record discrepancy and recommended follow-up.
  Expected Result: No silent assumptions about ports remain.
  Evidence: docs/evidence/task-9-mismatch-note.txt
```

**Commit:** NO

---

### T10: Post-Removal Health Verification

**What to do:**
- Re-run health checks from T5 after Supabase removal.
- Compare pre/post results and flag regressions.

**Must NOT do:**
- Do not mark cleanup complete if any keep-service regressed.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** T13
- **Blocked By:** T5, T7

**References:**
- `docs/evidence/task-5-prehealth.txt` — Baseline for before/after comparison.

**Acceptance Criteria:**
- [ ] All keep-services are healthy post-cleanup.
- [ ] Pre/post comparison report exists.

**QA Scenarios:**
```
Scenario: Verify post-cleanup service health
  Tool: Bash
  Steps:
    1. Execute same checks as pre-cleanup baseline.
    2. Save to docs/evidence/task-10-posthealth.txt.
    3. Diff against task-5 baseline.
  Expected Result: No health regression in retained stack.
  Evidence: docs/evidence/task-10-posthealth.txt

Scenario: Regression path
  Tool: Bash
  Steps:
    1. If regression detected, log rollback action from task-4 checklist.
  Expected Result: Regression is captured with actionable rollback step.
  Evidence: docs/evidence/task-10-regression-handling.txt
```

**Commit:** NO

---

## Wave 3: Documentation + Operational Handoff

### T11: Update Deployment Documentation

**What to do:**
- Update `docs/DEPLOYMENT.md` service table, health checks, and architecture section.
- Reflect "single memory system" posture and retained service set.

**Must NOT do:**
- Do not introduce implementation changes in docs task.

**Parallelization:**
- **Can Run In Parallel:** NO
- **Blocks:** T12, T14
- **Blocked By:** T8, T9

**References:**
- `docs/DEPLOYMENT.md:94-104` — Existing services table to replace with current reality.
- `docs/DEPLOYMENT.md:347-370` — Existing architecture diagram section.

**Acceptance Criteria:**
- [ ] Docs explicitly list kept services and removed Supabase.
- [ ] Documented ports match task-9 verified values.

**QA Scenarios:**
```
Scenario: Validate docs reflect runtime
  Tool: Bash + Read
  Steps:
    1. Read updated deployment sections.
    2. Compare against task-1 and task-9 evidence files.
  Expected Result: No mismatch between docs and runtime facts.
  Evidence: docs/evidence/task-11-doc-consistency.txt

Scenario: Negative consistency check
  Tool: Grep
  Steps:
    1. Search docs for stale Supabase runtime instructions.
  Expected Result: No stale operational Supabase instructions remain.
  Evidence: docs/evidence/task-11-stale-reference-check.txt
```

**Commit:** YES  
**Message:** `docs(deployment): align to single-memory docker architecture`

---

### T12: Add Repeatable Cleanup Runbook Section

**What to do:**
- Add concise "cleanup procedure" with scoped commands and safety checks.
- Include "must-not-remove" reminders and post-cleanup verification steps.

**Must NOT do:**
- Do not include broad prune commands.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** F1-F4
- **Blocked By:** T11

**References:**
- `docs/DEPLOYMENT.md:105-123` — Existing operations section where runbook steps fit.
- `docs/evidence/task-3-guardrail-matrix.md` — Keep/remove rules to codify.

**Acceptance Criteria:**
- [ ] Runbook includes step-by-step cleanup + validation + rollback pointers.

**QA Scenarios:**
```
Scenario: Validate cleanup runbook executability
  Tool: Bash + Read
  Steps:
    1. Walk through runbook commands in dry-run/read-only mode where applicable.
    2. Confirm no ambiguous placeholders remain.
  Expected Result: Runbook can be followed deterministically.
  Evidence: docs/evidence/task-12-runbook-validation.txt

Scenario: Negative guardrail verification
  Tool: Grep
  Steps:
    1. Ensure runbook does not contain docker system prune -a or wildcard delete patterns.
  Expected Result: No dangerous broad-delete commands present.
  Evidence: docs/evidence/task-12-dangerous-command-check.txt
```

**Commit:** YES  
**Message:** `docs(runbook): add scoped docker cleanup procedure`

---

### T13: Build Evidence Index

**What to do:**
- Create a single index mapping each task to evidence files + expected signals.
- Include before/after comparison pointers.

**Must NOT do:**
- Do not leave orphan evidence files undocumented.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** F1-F4
- **Blocked By:** T10

**References:**
- `docs/evidence/` — Required target directory for all QA artifacts.

**Acceptance Criteria:**
- [ ] Evidence index exists and references all task artifacts.

**QA Scenarios:**
```
Scenario: Build complete evidence manifest
  Tool: Bash + Read
  Steps:
    1. Enumerate all task evidence files.
    2. Generate docs/evidence/task-13-evidence-index.md with task-to-file mapping.
  Expected Result: Every completed task has discoverable evidence links.
  Evidence: docs/evidence/task-13-evidence-index.md

Scenario: Negative completeness check
  Tool: Bash
  Steps:
    1. Compare expected evidence list from plan vs actual files.
  Expected Result: Missing evidence count is zero or explicitly reported.
  Evidence: docs/evidence/task-13-missing-evidence-check.txt
```

**Commit:** NO

---

### T14: Create Operator Handoff Note

**What to do:**
- Write concise note listing what was intentionally retained and why.
- Include explicit "not in scope" statement for OpenClaw desktop.

**Must NOT do:**
- Do not imply additional removals beyond approved scope.

**Parallelization:**
- **Can Run In Parallel:** YES
- **Blocks:** F1-F4
- **Blocked By:** T11

**References:**
- Original doc Work Objectives → Must Have / Must NOT Have — Confirmed keep/exclude boundaries.

**Acceptance Criteria:**
- [ ] Handoff note clearly states retained services + exclusions.

**QA Scenarios:**
```
Scenario: Validate operator handoff clarity
  Tool: Read
  Steps:
    1. Review handoff note for explicit keep/remove/exclude sections.
  Expected Result: Operator can answer "what remains" and "what was removed" unambiguously.
  Evidence: docs/evidence/task-14-handoff-check.txt

Scenario: Negative ambiguity check
  Tool: Grep
  Steps:
    1. Search note for ambiguous terms like "maybe", "optional" in scope statements.
  Expected Result: Scope statements are explicit and binary.
  Evidence: docs/evidence/task-14-ambiguity-check.txt
```

**Commit:** YES  
**Message:** `docs(ops): add retained-services handoff note`

---

## Dependency Matrix

| Task | Blocked By | Blocks |
|------|-----------|--------|
| T1 | — | T3, T9 |
| T2 | — | T6, T7 |
| T3 | T1 | T6, T7, T8 |
| T4 | — | T6 |
| T5 | — | T10 |
| T6 | T2, T3, T4 | T7 |
| T7 | T2, T3, T6 | T8, T10 |
| T8 | T3, T7 | T11 |
| T9 | T1 | T11 |
| T10 | T5, T7 | T13 |
| T11 | T8, T9 | T12, T14 |
| T12 | T11 | F1-F4 |
| T13 | T10 | F1-F4 |
| T14 | T11 | F1-F4 |

**Critical Path:** T1 → T3 → T6 → T7 → T10 → T11 → F1-F4

---

## Final Verification Wave (MANDATORY)

### F1: Plan Compliance Audit

**Role:** oracle

**What to verify:**
- Each Must Have/Must NOT Have satisfied with file+runtime evidence.
- All guardrails respected during execution.

**Acceptance Criteria:**
- [ ] All Must Have conditions verified.
- [ ] All Must NOT Have conditions verified.
- [ ] Evidence files support every claim.

---

### F2: Infrastructure Quality Review

**Role:** Infrastructure reviewer

**What to verify:**
- Docker state cleanliness after cleanup.
- No accidental removals.
- Command reproducibility.

**Acceptance Criteria:**
- [ ] No orphaned containers/volumes/networks.
- [ ] Kept services healthy.
- [ ] Commands can be replayed from evidence.

---

### F3: Real QA Replay

**Role:** QA reviewer

**What to verify:**
- Re-run all task QA scenarios.
- Confirm evidence exists and matches expected output.

**Acceptance Criteria:**
- [ ] All QA scenarios executable.
- [ ] Evidence matches expected patterns.
- [ ] No missing evidence files.

---

### F4: Scope Fidelity Check

**Role:** Deep review

**What to verify:**
- Changes limited to approved cleanup/documentation scope.
- No scope creep into unapproved areas.

**Acceptance Criteria:**
- [ ] Only Supabase artifacts removed.
- [ ] OpenClaw desktop untouched.
- [ ] Gateway/researcher/dashboard/mcp unmodified.

---

## Commit Strategy

| Commit | Message | Tasks Included |
|--------|---------|----------------|
| 1 | `chore(docker): remove supabase runtime artifacts` | T7 |
| 2 | `docs(deployment): align to single-memory docker architecture` | T11 |
| 3 | `docs(runbook): add scoped docker cleanup procedure` | T12 |
| 4 | `docs(ops): add retained-services handoff note` | T14 |

---

## Verification Commands

```bash
# Verify Supabase removal
docker ps --format '{{.Names}}' | grep -i supabase

# Check all service status
docker ps --format '{{.Names}}\t{{.Status}}'

# Neo4j health
curl -s -o /dev/null -w '%{http_code}' http://localhost:7474

# PostgreSQL health
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
```

---

## Success Criteria

### Final Checklist
- [ ] All "Must Have" conditions satisfied
- [ ] All "Must NOT Have" conditions satisfied
- [ ] Retained services healthy post-cleanup
- [ ] Documentation matches actual runtime
- [ ] Evidence index complete and verified
- [ ] Operator handoff note delivered

### Definition of Done
- All 14 tasks (T1–T14) completed with evidence
- All 4 final verification reviews (F1–F4) passed
- Commits made for T7, T11, T12, T14
- Original standalone document can be removed

---

**See also:**
- [BLUEPRINT.md](./BLUEPRINT.md) — System design and requirements
- [SOLUTION-ARCHITECTURE.md](./SOLUTION-ARCHITECTURE.md) — Topology and interaction patterns
- [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md) — Guardrails and risk mitigations
- [REQUIREMENTS-MATRIX.md](./REQUIREMENTS-MATRIX.md) — Requirement traceability
- [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) — Field-level definitions
