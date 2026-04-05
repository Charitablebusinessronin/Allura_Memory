# Memory Quality Checklist

Use this before claiming memory-related work is complete.

## Session Reliability

- [ ] `/start-session` hydration succeeded
- [ ] Memory read query returned expected tenant-scoped results
- [ ] `/end-session` reflection write succeeded
- [ ] Readback verified the latest reflection

## Data Integrity

- [ ] All writes include `group_id`
- [ ] Neo4j updates use immutable versioning (`:SUPERSEDES`)
- [ ] No direct `docker exec` DB operations used
- [ ] Cross-tenant leakage checks passed

## Tooling Consistency

- [ ] MCP command/tool names are current and valid
- [ ] Connection URI follows runtime strategy (`host.docker.internal` primary)
- [ ] Smoke test command passes

## Documentation Quality

- [ ] Epic/story statuses use canonical taxonomy
- [ ] No `TBD` placeholders remain in production docs
- [ ] Delivery log contains date, owner, evidence
- [ ] Last updated date refreshed

## Operational Readiness

- [ ] SLO metrics reviewed
- [ ] Restore runbook still accurate
- [ ] Recent restore drill evidence exists
