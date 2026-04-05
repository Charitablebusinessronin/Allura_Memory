# Design: /ralphloop — Autonomous Story Development Loop

**Created:** 2026-04-05  
**Author:** MemoryOrchestrator (with Sabir Asheed)  
**Status:** Approved  

---

## Overview

`/ralphloop` is an autonomous workflow that picks up `ready-for-dev` stories and executes them through a 7-phase loop: Bootstrap → Pick → Develop → Review → Commit → Sync → Loop. It runs continuously until no `ready-for-dev` stories remain.

---

## Goals

1. **Fully Autonomous:** No human checkpoints during execution
2. **Sprint Status Sync:** Automatic updates at each phase
3. **Code Review Gate:** Mandatory review with Critical threshold
4. **Memory Integration:** Log every action to PostgreSQL + Neo4j
5. **Research Integration:** Use Exa, Context7, MCP Docker as needed
6. **Smart Recovery:** 10 retries → Course Correct → Escalation chain

---

## Architecture

### Workflow Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    /ralphloop WORKFLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Phase 0  │───▶│ Phase 1  │───▶│ Phase 2  │              │
│  │ Bootstrap│    │ PickStory│    │  Develop │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                       │                     │
│                                       ▼                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Phase 6  │◀───│ Phase 5  │◀───│ Phase 3  │              │
│  │   Loop   │    │   Sync   │    │  Review  │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       │                                 │                   │
│       │                    ┌───────────┴───────────┐       │
│       │                    ▼                       ▼       │
│       │            ┌──────────┐          ┌──────────┐     │
│       │            │ Course   │          │ Commit   │     │
│       │            │ Correct  │          │ Phase 4  │     │
│       │            └──────────┘          └──────────┘     │
│       │                    │                               │
│       │                    ▼                               │
│       │            Re-run Review                           │
│       │           (Phase 3)                                 │
│       │                                                    │
│       └──▶ Check for ready-for-dev ──▶ [STOP if none]     │
│                    │                                        │
│                    ▼                                        │
│               [Phase 1] Pick next story                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
.opencode/skills/ralphloop/
├── SKILL.md              # Entry point + configuration
├── config.yaml           # Thresholds, recovery, logging config
├── workflow.md           # Phase orchestration
├── steps/
│   ├── step-00-bootstrap.md
│   ├── step-01-pick-story.md
│   ├── step-02-develop.md
│   ├── step-03-review.md
│   ├── step-04-commit.md
│   ├── step-05-sync.md
│   └── step-06-loop.md
├── data/
│   ├── thresholds.yaml   # Review severity config
│   ├── recovery.yaml     # Retry/escalation config
│   └── memory-events.yaml # Event type definitions
└── scripts/
    ├── sprint-updater.ts # Auto-update sprint-status.yaml
    ├── memory-logger.ts  # Unified Postgres + Neo4j logging
    └── research.ts       # Exa + Context7 + grep integration
```

---

## Configuration

### config.yaml

```yaml
name: ralphloop
version: 1.0.0
description: Autonomous story development loop through all epics

# Thresholds
review:
  critical_threshold: 1      # Any critical triggers course correct
  
# Recovery
recovery:
  max_retries: 10
  backoff_ms: 1000
  escalation_agents:
    - MemoryOrchestrator
    - MemoryArchitect
    - allura-brain

# Logging
memory:
  log_level: detailed         # Every action logged
  sync_to_notion: true

# Development
tdd:
  mode: recommended           # Required for features, skip for config

# Stopping
loop:
  stop_when_no_ready: true    # Halt when no ready-for-dev stories
```

### thresholds.yaml

```yaml
review:
  course_correct:
    critical: 1           # Any Critical finding
    high: null            # No high-only trigger
    
  halt:
    critical_after_retry: 1    # Still critical after course correct
    security_vulnerability: true  # Always halt on security issues
    
  auto_fix:
    medium_max: 5         # Auto-fix up to 5 medium findings
    low_max: 10           # Auto-fix up to 10 low findings
```

### recovery.yaml

```yaml
recovery:
  retry:
    max_attempts: 10
    backoff_ms: 1000      # 1 second initial
    backoff_multiplier: 2 # Exponential: 1s → 2s → 4s → ...
    
  escalation:
    chain:
      - agent: MemoryOrchestrator
        action: "Analyze and propose architecture fix"
        timeout_seconds: 60
      - agent: MemoryArchitect
        action: "Design structural solution"
        timeout_seconds: 120
      - agent: allura-brain
        action: "Human intervention required"
        timeout_seconds: null  # Infinite - wait for human
        halt: true
        
  errors:
    retryable:
      - "ECONNREFUSED"
      - "ETIMEDOUT"
      - "test_failure"
      - "typecheck_error"
    non_retryable:
      - "security_vulnerability"
      - "critical_architecture_issue"
      - "human_approval_required"
```

---

## Phase Details

### Phase 0: Bootstrap

**File:** `steps/step-00-bootstrap.md`

**Purpose:** Load all context, validate environment, check for resume.

**Actions:**
1. Load project config (`allura-memory-context` skill)
2. Validate PostgreSQL health
3. Validate Neo4j health
4. Read sprint-status.yaml
5. Check for `in-progress` stories (offer resume)
6. Log SessionBootstrap event

**Output:** Resolved config + environment status + resume decision

---

### Phase 1: Pick Story

**File:** `steps/step-01-pick-story.md`

**Purpose:** Find next `ready-for-dev` story, update sprint status.

**Actions:**
1. Parse sprint-status.yaml
2. Filter for `ready-for-dev`
3. Sort by epic order (1, 2, 3...)
4. Pick first story
5. Update sprint-status: `in-progress`
6. Read story spec file
7. Log StoryStarted event

**Output:** Story ID + Spec content + Sprint status updated

---

### Phase 2: Develop

**File:** `steps/step-02-develop.md`

**Purpose:** Implement story following TDD (if applicable).

**Actions:**
1. Analyze story type (feature vs config)
2. If feature → invoke `test-driven-development` skill
3. Research (Exa search, Context7 docs, MCP Docker grep)
4. Implement (`bmad-dev-story` or direct)
5. Run typecheck (`npm run typecheck`)
6. Run unit tests (`npm test`)
7. Run integration tests (`npm run test:e2e`) if applicable
8. If tests fail → retry (max 10x) with backoff
9. Log DevComplete event

**Output:** Implemented code + Tests passing

---

### Phase 3: Review

**File:** `steps/step-03-review.md`

**Purpose:** Code review with severity threshold check.

**Actions:**
1. Invoke `bmad-code-review` skill
2. Parse findings by severity
3. Log ReviewComplete event
4. For each finding, log ReviewFinding event
5. Check threshold (any Critical?)
6. If Critical ≥ 1 → Course Correct (`bmad-correct-course`)
7. Re-run tests after fixes
8. Re-run review
9. If still Critical → escalate

**Output:** Review findings + Pass/Fail decision

---

### Phase 4: Commit

**File:** `steps/step-04-commit.md`

**Purpose:** Final verification, commit, push.

**Actions:**
1. Invoke `verification-before-completion` skill
2. Stage changes (`git add -A`)
3. Commit with message (`feat({story}): {summary}`)
4. Get commit SHA (`git rev-parse HEAD`)
5. Push to remote (if configured)
6. Update sprint-status: `done`
7. Log CommitSHA event

**Output:** Commit SHA + Sprint status = done

---

### Phase 5: Sync

**File:** `steps/step-05-sync.md`

**Purpose:** Sync to brain (PostgreSQL + Neo4j) and Notion.

**Actions:**
1. Create PostgreSQL event (already logged during phases)
2. Create Neo4j insight (`MCP_DOCKER_create_entities`)
3. Link entities (`MCP_DOCKER_create_relations`)
4. Sync to Notion (if configured)
5. Update memory-bank files (progress.md, activeContext.md)
6. Log BrainSynced event
7. Log NotionSynced event

**Output:** Brain synced + Notion synced

---

### Phase 6: Loop

**File:** `steps/step-06-loop.md`

**Purpose:** Check for next story or stop.

**Actions:**
1. Log StoryCompleted event
2. Re-read sprint-status.yaml
3. Check for `ready-for-dev` stories
4. If found → goto Phase 1
5. If none → stop with summary

**Stop Summary:**
```
╔════════════════════════════════════════════╗
║       /ralphloop COMPLETED                 ║
╠════════════════════════════════════════════╣
║ Stories Completed: X                       ║
║ Sprint: Epic 1 - Phase X                   ║
║ Remaining: Y stories (need story files)    ║
║                                            ║
║ Memory Events: Z logged                     ║
║ Brain Sync: ✅ PostgreSQL + Neo4j          ║
║ Notion Sync: ✅ Knowledge Hub updated      ║
╚════════════════════════════════════════════╝
```

---

## Error Handling

### Retry Configuration

| Attempt | Backoff | Cumulative |
|---------|---------|------------|
| 1 | 1s | 1s |
| 2 | 2s | 3s |
| 3 | 4s | 7s |
| 4 | 8s | 15s |
| 5 | 16s | 31s |
| 6 | 32s | 63s |
| 7 | 64s | 127s |
| 8 | 128s | 255s (∼4m) |
| 9 | 256s | 511s (∼8.5m) |
| 10 | 512s | 1023s (∼17m) |

### Escalation Chain

```
Level 1: RECOVERY
└─ Retry (max 10, exponential backoff)
    ↓ (still failing)
Level 2: COURSE CORRECTION
└─ bmad-correct-course skill
    ↓ (still failing)
Level 3: ESCALATE TO ARCHITECT
└─ MemoryOrchestrator (you) reviews
    ↓ (still failing)
Level 4: ESCALATE TO SENIOR ARCHITECT
└─ MemoryArchitect reviews
    ↓ (still failing)
Level 5: ESCALATE TO BRAIN
└─ allura-brain provides context
    └─ Human intervention required → HALT
```

### Human Intervention Triggers

- Security vulnerability found
- Business logic clarification needed
- External API key required
- Infrastructure change needed
- Cost > $1 estimated
- Destructive operation required
- Data migration required
- Allura Brain escalation exhausted

---

## Memory Events

| Event Type | Phase | Logged | Neo4j Promoted |
|------------|-------|--------|----------------|
| SessionBootstrap | 0 | ✅ PostgreSQL | ❌ |
| StoryStarted | 1 | ✅ PostgreSQL | ❌ |
| DevComplete | 2 | ✅ PostgreSQL | ❌ |
| TestRun | 2 | ✅ PostgreSQL | ❌ |
| ReviewComplete | 3 | ✅ PostgreSQL | ❌ |
| ReviewFinding | 3 | ✅ PostgreSQL | ❌ |
| CourseCorrectApplied | 3 | ✅ PostgreSQL | ✅ Neo4j |
| Committed | 4 | ✅ PostgreSQL | ❌ |
| CommitSHA | 4 | ✅ PostgreSQL | ✅ Neo4j |
| BrainSynced | 5 | ✅ PostgreSQL | ✅ Neo4j |
| NotionSynced | 5 | ✅ PostgreSQL | ✅ Neo4j |
| StoryCompleted | 6 | ✅ PostgreSQL | ✅ Neo4j |
| RetryAttempted | Any | ✅ PostgreSQL | ❌ |
| EscalationTriggered | Any | ✅ PostgreSQL | ✅ Neo4j |
| HumanInterventionRequested | Any | ✅ PostgreSQL | ✅ Neo4j |

---

## Tool Integration

### Skills Used

| Skill | Phase(s) | Purpose |
|-------|----------|---------|
| `allura-memory-context` | 0 | Load project context |
| `test-driven-development` | 2 | TDD workflow (features) |
| `bmad-dev-story` | 2 | Story implementation |
| `bmad-code-review` | 3 | Systematic code review |
| `bmad-correct-course` | 3 | Fix critical issues |
| `verification-before-completion` | 4 | Final verification |

### MCP Docker Tools

| Tool | Purpose |
|------|---------|
| `MCP_DOCKER_insert_data` | Log events to PostgreSQL |
| `MCP_DOCKER_query_database` | Query existing events |
| `MCP_DOCKER_create_entities` | Create Neo4j insights |
| `MCP_DOCKER_create_relations` | Link entities |
| `MCP_DOCKER_tavily_search` | Web research |
| `MCP_DOCKER_mcp-find` | Find MCP servers |

### Research Tools

| Tool | Purpose |
|------|---------|
| `exa_web_search_exa` | Web search for patterns |
| `exa_get_code_context_exa` | Code examples |
| `exa_crawling_exa` | Full doc pages |
| Context7 skill | Library documentation |

---

## Output Artifacts

| Artifact | Location |
|----------|----------|
| Sprint status | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Memory bank | `memory-bank/progress.md`, `memory-bank/activeContext.md` |
| Story specs | `_bmad-output/implementation-artifacts/stories/tech-spec-{id}.md` |
| Review reports | `.opencode/skills/ralphloop/reviews/{story-id}-review.md` |
| Session logs | `.opencode/skills/ralphloop/logs/{session-id}.log` |

---

## Example Session Log

```
══════════════════════════════════════════════════════════════
RALPHLOOP SESSION LOG
══════════════════════════════════════════════════════════════
Session ID: abc123-def456
Started: 2026-04-05 10:00:00
User: Sabir Asheed

CONFIGURATION
────────────────────────────────────────────────────────────
Max Retries: 10
Backoff: 1000ms (exponential)
Escalation Chain: MemoryOrchestrator → MemoryArchitect → Allura Brain
Memory Level: Detailed
TDD Mode: Recommended

PHASE 0: BOOTSTRAP
────────────────────────────────────────────────────────────
[10:00:00] Loading project context...
[10:00:01] ✅ PostgreSQL connected
[10:00:01] ✅ Neo4j connected
[10:00:02] ✅ Sprint status loaded
[10:00:02] 📋 Found 3 ready-for-dev stories
EVENT: SessionBootstrap

PHASE 1: PICK STORY
────────────────────────────────────────────────────────────
[10:00:03] Selecting next story...
[10:00:03] → Story 1-2: Implement NOTION_SYNC
[10:00:04] Updated sprint-status.yaml: in-progress
EVENT: StoryStarted { story_id: 1-2 }

PHASE 2: DEVELOP
────────────────────────────────────────────────────────────
[10:00:05] Research: Notion API integration
[10:00:10] 📖 Context7: notion-sdk-js docs
[10:00:15] 🌐 Exa: Notion sync patterns
[10:00:20] Implementing...
[10:05:30] Running typecheck...
[10:05:32] ✅ Typecheck passed
[10:05:33] Running tests...
[10:05:45] ✅ 42/42 tests passed
EVENT: DevComplete
EVENT: TestRun { type: unit, result: pass, count: 42 }

PHASE 3: REVIEW
────────────────────────────────────────────────────────────
[10:05:46] Invoking bmad-code-review...
[10:06:00] 📊 Review complete: 2 Medium, 5 Low, 0 Critical
[10:06:01] ✅ No Critical findings, proceeding
EVENT: ReviewComplete { findings: 7, critical: 0 }

PHASE 4: COMMIT
────────────────────────────────────────────────────────────
[10:06:02] Running verification...
[10:06:05] ✅ Verification passed
[10:06:06] Staging changes...
[10:06:07] Committing: feat(1-2): implement Notion sync workflow
[10:06:08] ✅ Committed: abc123def456
[10:06:09] Updated sprint-status.yaml: done
EVENT: Committed
EVENT: CommitSHA { sha: "abc123def456" }

PHASE 5: SYNC
────────────────────────────────────────────────────────────
[10:06:10] Syncing to PostgreSQL...
[10:06:11] ✅ PostgreSQL event logged
[10:06:12] Syncing to Neo4j...
[10:06:13] ✅ Neo4j insight created
[10:06:14] Syncing to Notion...
[10:06:15] ✅ Notion page updated
EVENT: BrainSynced
EVENT: NotionSynced

PHASE 6: LOOP
────────────────────────────────────────────────────────────
[10:06:17] Checking for next story...
[10:06:18] 📋 Found 2 more ready-for-dev stories
EVENT: StoryCompleted { story_id: 1-2, duration: "6m18s" }
[10:06:19] → Looping to Phase 1...

══════════════════════════════════════════════════════════════
SUMMARY
══════════════════════════════════════════════════════════════
Stories Completed: 3
Total Duration: 18m 42s
Memory Events: 28 logged
Brain Sync: ✅ PostgreSQL + Neo4j
Notion Sync: ✅ Knowledge Hub updated
══════════════════════════════════════════════════════════════
```

---

## Future Enhancements

1. **Parallel Development:** Support running multiple stories concurrently
2. **Dependency Graph:** Auto-detect story dependencies and order
3. **Time Estimates:** Predict story duration based on complexity
4. **Rollback:** Automatic rollback on repeated failures
5. **Notifications:** Slack/Discord notifications on completion

---

## Success Criteria

- ✅ Single `/ralphloop` command triggers full story pipeline
- ✅ Sprint status updates without manual intervention
- ✅ Memory system stays in sync (PostgreSQL + Neo4j + Notion)
- ✅ All gates use appropriate skills (TDD, review, verification)
- ✅ 10 retry attempts with exponential backoff
- ✅ Course correction on any Critical finding
- ✅ Escalation chain: You → Architect → Allura Brain → Human
- ✅ Stops when no `ready-for-dev` stories remain

---

## References

- WDS Product Evolution Workflow: `.opencode/skills/wds-8-product-evolution/workflow.md`
- Go Mode Skill: `.opencode/skills/go-mode/go-mode/SKILL.md`
- BMad Dev Story: `.opencode/skills/bmad-dev-story/SKILL.md`
- BMad Code Review: `.opencode/skills/bmad-code-review/SKILL.md`
- Test-Driven Development: `.opencode/skills/test-driven-development/SKILL.md`