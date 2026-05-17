# Allura Memory Goal, PRD, and Phase Roadmap

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has been reviewed against architectural principles and should be kept in sync with source-of-truth docs.
> When in doubt, defer to code, schemas, Notion board state, and team consensus.

## Overall Goal

Finish Allura Memory as a governed, stable AI memory operating system before starting new board or product expansion work.

Allura Memory is not just a dashboard and not just a database. It is the governed memory layer for AI agents: raw traces land in PostgreSQL, reviewed knowledge is promoted into Neo4j, Notion carries board truth, and Team RAM routes work through evidence-backed review gates.

The product goal is simple:

```text
Allura should let an operator answer:
1. What does the Brain know?
2. Why does it believe that?
3. Who approved it?
4. What changed, and can we prove it?
```

## Product Brief

### Problem

AI agents forget between sessions, and ungoverned memory becomes a black box. Without a stable memory substrate, agents repeat work, lose decisions, invent state, or promote unreviewed claims as truth.

### Product Promise

Allura Memory gives AI agents persistent, inspectable, accountable memory.

It succeeds when:

- Agents can retrieve the right project context without guessing.
- Humans can inspect every important memory, decision, and promotion.
- Raw traces stay separate from curated truth.
- Notion, GitHub, repo docs, and Allura Brain receipts agree.
- New boards can be added later without hardcoding private business workflows.

### Users

| User | Need |
| --- | --- |
| Captain / owner | Clear project state, decisions, and proof of Done |
| Agent operator | Safe memory recall, review queues, rollback paths |
| Team RAM agent | Fast context hydration and role-specific routing |
| Developer | Stable APIs, tests, contracts, and board configs |
| Future board owner | Configurable boards with no private data in repo |

### Non-Goals

- Do not start Phase 1 board-config work before Phase 0 is closed or formally waived.
- Do not treat Allura Brain raw memory as proof of Done.
- Do not ship private board data in the public repo.
- Do not let AI decide compliance, finance, or owner policy without explicit human approval.
- Do not replace `3100` until cutover gates pass.

## Source Of Truth Model

| Layer | Authority | Purpose |
| --- | --- | --- |
| Notion Work Board | Canonical status | What is Ready, In Progress, Review, or Done |
| GitHub PRs/checks | Code proof | What changed and whether CI accepted it |
| Repo docs | Stable canon | Architecture, decisions, requirements, runbooks |
| Allura Brain | Audit memory | Searchable traces, lessons, and receipts |
| RuVix | Governance | Intent, evidence, validation, isolation, audit |
| Team RAM | Operating crew | Scout, Jobs, Brooks, Woz, Pike, Fowler, specialists |

## AI Guidelines

All AI-assisted work in this repo must follow these rules:

- State intent before changing code, docs, config, memory, or board state.
- Hydrate context before important action.
- Prefer source documents, code, tests, and board state over memory recall.
- Use Allura Brain with explicit `group_id: allura-system` when memory tools are available.
- Never claim a tool, check, agent, or validation ran unless it actually ran.
- Include AI-assisted disclosure blocks in AI-shaped documentation.
- Defer to code, schemas, and team consensus when docs conflict.
- Do not create private or customer-specific board content in public docs.
- Keep humans in the loop for owner decisions, compliance decisions, and scope calls.

## Team RAM Operating Model

Team RAM is the thinking and review crew. Codex/OpenCode/Claude are the hands.

Default routing for one card:

```text
Jobs -> Brooks -> Scout -> Woz -> Pike/Fowler -> Ralph/validation -> Allura log
```

Default routing for finishing epics is defined in
`_bmad/FINISH-ALL-EPICS-WORKFLOW.md`. That workflow is the canonical
Scout-first Kanban lane for moving from current review debt through the
remaining epics without opening new work too early.

Role responsibilities:

| Role | Responsibility |
| --- | --- |
| Jobs | Clarifies intent, scope, acceptance criteria |
| Brooks | Owns architecture, boundaries, route, conceptual integrity |
| Scout | Hydrates repo, board, runtime, and memory context |
| Woz | Builds working code and tests |
| Pike | Reviews interface shape and simplicity |
| Fowler | Reviews maintainability and reversible change |
| Ralph | Runs loop validation after implementation and review evidence |
| Knuth | Owns data contracts, schemas, migrations |
| Hightower | Owns infrastructure, deployability, observability |
| Bellard | Owns diagnostics and correctness under weird failure |
| Carmack | Owns performance and hot paths |

## RuVix Done Standard

Every closure claim needs:

- `mutate`: What changed, and why.
- `attest`: What evidence proves the claim.
- `verify`: What validation ran.
- `isolate`: What project, tenant, branch, or worktree boundary was used.
- `sandbox`: What unsafe path was avoided.
- `audit`: Where the outcome was logged.

## Phase 0 Goal: Foundation Lock

### Outcome

All current memory-system blockers are either closed with evidence or explicitly waived. Notion, GitHub, repo ledger, and Allura Brain agree enough to start Phase 1 without carrying hidden Phase 0 debt.

### Phase 0 Exit Criteria

- All blocker rows are `DONE`, `DEFERRED`, or `WAIVED` with evidence.
- Notion finish plan is reconciled with merged PRs and comments.
- `blocking_list.md` reflects current truth.
- Allura Brain has receipts for major decisions and closures.
- `/allura` has direct validation plus Ralph pass or formal Ralph runtime waiver.
- Cash tracker is either in scope with a canonical source or explicitly out of scope.
- Phase 1 start is approved after closure.

### Phase 0 Checklist

| Item | Status | Closure Rule |
| --- | --- | --- |
| Auth/typecheck blocker | Done | PR #27 merged and evidence attached |
| 2.1 Token Audit | Done | PR #28 merged and evidence attached |
| `/allura` direct review gate | Done, Ralph blocked | PR #29 merged; Ralph pass or waiver still needed |
| Memory Explorer live data | Done | PR #30 merged and evidence attached |
| CARD-2.4-E approval audit guard | Done | PR #31 merged and evidence attached |
| Local ledger reconciliation | Done | PR #32 merged |
| `3100` owner decision | Done | PR #33 merged |
| Cash tracker | Open | Decide canonical Notion source or mark out of scope |
| B/C L3 validation | Open | Attach evidence or waiver |
| D-lane rollback/supersession | Open | Roll back, supersede, or formally defer |
| `6420 -> 3334` reachability | Open | Attach reachability proof or waiver |
| Cost ledger | Open | Activate path or defer with reason |
| Owner map | Open | Attach owner acknowledgement |
| Finish-plan reconciliation | Open | Update Notion body and repo ledger |
| Final Phase 0 closeout | Open | One Notion closure note plus one Allura Brain receipt |

## Phase 1 Goal: Board Config System

### Outcome

Build a generic board engine so new boards are config-driven, validated, and safe to share.

### PRD Requirements

| Requirement | Description |
| --- | --- |
| Generic board engine | Shared renderer and data model for configured boards |
| Dynamic route | `/boards/[boardId]` loads board config by ID |
| Zod validation | Invalid board configs fail safely and loudly |
| Sanitized examples | Public examples contain no private business data |
| Private configs | Personal board configs are gitignored |
| Source declarations | Every board declares source of truth and write policy |
| Degraded states | Boards show blocked/degraded/empty states honestly |
| Tests | Config validation and route loading are covered |
| Docs | Adding a new board is documented step by step |

### Phase 1 Checklist

- Create board config schema.
- Create board registry loader.
- Add sanitized example board configs.
- Add gitignored personal board config path.
- Create `/boards/[boardId]`.
- Preserve current `/allura` behavior.
- Add config validation tests.
- Add route loading tests.
- Add docs for adding a board.
- Add evidence to Notion and Allura Brain.

## Phase 2 Goal: Mission Control Multi-Board Cockpit

### Outcome

Mission Control becomes a clean cockpit for memory, work, agents, telemetry, and resources.

### Checklist

- Add board switcher.
- Add board status model.
- Add source-of-truth badges.
- Add degraded-state UI.
- Add blocked-state UI.
- Add board evidence panels.
- Add adapter declaration per board.
- Add no-fabricated-data checks.
- Validate desktop and mobile layouts.
- Record screenshot evidence.

## Phase 3 Goal: Governance And Audit Hardening

### Outcome

Every important action has owner, evidence, source, status, and rollback or supersession path.

### Checklist

- Standardize evidence comments.
- Standardize Brain receipt format.
- Standardize waiver format.
- Activate or formally defer cost ledger.
- Complete owner map.
- Normalize decision log format.
- Normalize rollback/supersession records.
- Add governance tests where practical.
- Document review gates.

## Phase 4 Goal: Dashboard Cutover Readiness

### Outcome

The Mission Control development surface can safely replace the current Docker dashboard on `3100`.

### Canonical Ports

| Port | Meaning |
| --- | --- |
| `6420` | Visual/reference memory dashboard |
| `3334` | Mission Control development integration target |
| `3100` | Current Docker dashboard and future dashboard UI cutover target |

### Cutover Checklist

- Route parity complete.
- Visual parity complete.
- Source-of-truth parity complete.
- Adapter declarations complete.
- No fabricated live data.
- Authenticated validation complete.
- Unauthenticated validation complete.
- Smoke tests complete.
- Runtime health checks complete.
- Rollback command documented.
- Captain approval recorded.

## Phase 5 Goal: Domain Boards

### Outcome

Add real domain boards as governed configs, not custom one-off dashboards.

### Candidate Boards

| Board | Status | Notes |
| --- | --- | --- |
| Memory Board | Current | Finish and stabilize first |
| Faith Meats Operations | Deferred | HACCP and operations evidence board |
| Lending Compliance | Deferred | Mortgage rules, evidence, decisions, audit trail |

### Checklist

- Confirm owner and source of truth for each board.
- Create private config first.
- Create sanitized public example if needed.
- Define evidence expectations.
- Define write policy.
- Define degraded behavior.
- Add tests.
- Attach Notion evidence.

## Phase 6 Goal: Release And Stewardship

### Outcome

Allura Memory is stable enough for ongoing maintenance, external review, and future iteration.

### Checklist

- Update README and product docs.
- Review security and privacy docs.
- Review install and deployment docs.
- Confirm sample data is safe.
- Confirm no secrets or private board data are tracked.
- Confirm CI is green.
- Run final Team RAM retrospective.
- Log final release receipt to Allura Brain.

## Immediate Next Actions

1. Close cash tracker scope.
2. Record Ralph `/allura` waiver or rerun Ralph successfully.
3. Reconcile Notion finish-plan body with current PR evidence.
4. Close or waive B/C L3, D-lane, `6420 -> 3334`, cost ledger, and owner map.
5. Record Phase 0 closure.
6. Start Phase 1 board config only after Phase 0 closure.

## Finish-All-Epics Execution Order

After Phase 0 is closed or formally waived, use
`_bmad/FINISH-ALL-EPICS-WORKFLOW.md` for the remaining epic sequence:

1. Finish current review debt.
2. Finish Epic 2 Frontend Tightening.
3. Finish E1 Host Stability.
4. Finish E2 Dashboard Quality.
5. Finish E3/E4 Hardening Deploy.
6. Finish E4 Kernel Completion.
7. Finish E5 Infrastructure Polish.

No epic is complete until every story is `Done`, evidence is attached, and the
epic retrospective is complete.

## Related Canon

- `_bmad/FINISH-ALL-EPICS-WORKFLOW.md`
- `docs/allura/BLUEPRINT.md`
- `docs/allura/SOLUTION-ARCHITECTURE.md`
- `docs/allura/DESIGN-MEMORY-SYSTEM.md`
- `docs/allura/DESIGN-ALLURA.md`
- `docs/allura/TEAM-RAM-BMAD-INTEGRATION.md`
- `docs/allura/RUVIX-GOVERNANCE-RULES.md`
- `docs/allura/RISKS-AND-DECISIONS.md`
- `blocking_list.md`
