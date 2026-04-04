# Config & Context Audit Change List

Generated: 2026-04-04
Auditor: memory-architect

---

## Summary

| File | Priority | Changes Needed |
|------|----------|----------------|
| `.opencode/context/navigation.md` | P0 | Fix path, add registry + Notion |
| `.opencode/config/memory-contract.md` | P0 | Remove organization_id, add registry + Notion |
| `.opencode/context/project/roninmemory-intelligence.md` | P0 | Add registry + Notion, fix T30 |
| `.opencode/config/agent-metadata.json` | P1 | Remove organization_id from tenant_boundary |
| `.opencode/context/system-builder-templates/orchestrator-template.md` | P1 | Add Brooks + dual logging + HITL |
| `.opencode/context/system-builder-templates/subagent-template.md` | P1 | Add tenant boundary + validation |
| `.opencode/config/registry-databases.json` | P2 | Add comment + CLI ref |

---

## 1. navigation.md (P0)

**Path:** `.opencode/context/navigation.md`

### Issue
- References `project-intelligence/` folder that doesn't exist
- Missing OpenAgents Control Registry
- Missing Notion surface clarification

### Changes

**Remove:**
```markdown
| **Choose agent** | `../agent/README.md` ⭐ |
| **Add agent** | `openagents-repo/guides/adding-agent.md` |
```

**Replace with:**
```markdown
| **Choose agent** | `project/roninmemory-intelligence.md` |
| **OpenAgents Registry** | `../config/registry-databases.json` |
| **Sync Notion** | `bun run registry:sync` |
```

**Add new section after line 38:**
```markdown
## Notion Surfaces

| Surface | Notion URL | Role |
|---------|-----------|------|
| Backend Hub | `6581d9be65b38262a2218102c1e6dd1d` | Structural governance — templates, registries, migrations |
| OpenAgents Control | `3371d9be65b38041bc59fd5cf966ff98` | CLI team registry — agent roster, skills, commands |
| Allura Memory Control Center | `3371d9be65b381a9b3bec24275444b68` | HITL oversight — approvals, sync model |
```

**Update Quick Routes table (lines 26-38):**
- Line 27: Change `core/standards/code-quality.md` → `core/standards/quality.md` (verify path exists)
- Line 35: Change `../agent/README.md` → `project/roninmemory-intelligence.md`

---

## 2. memory-contract.md (P0)

**Path:** `.opencode/config/memory-contract.md`

### Issue
- Claims `organization_id` enforcement but PostgreSQL schema only has `group_id`
- Missing OpenAgents Control Registry reference
- Missing Notion surface clarification

### Changes

**Line 7-9 - Replace:**
```markdown
- **Business boundary:** `organization_id`
- **Relational (PostgreSQL):** `organization_id` + `group_id`
- **Graph (Neo4j):** `organization_id` + `group_id` (preferred), tolerate legacy `groupId` only when integrating older nodes
```

**With:**
```markdown
- **Memory partition:** `group_id`
- **Relational (PostgreSQL):** `group_id`
- **Graph (Neo4j):** `group_id` (preferred), tolerate legacy `groupId` only when integrating older nodes
```

**Line 23-27 - Replace:**
```markdown
- `organization_id` (string)
- `group_id` (string)
```

**With:**
```markdown
- `group_id` (string)
```

**Line 34-38 - Replace:**
```markdown
- `organization_id`
- `group_id`
```

**With:**
```markdown
- `group_id`
```

**Add new section after line 40:**
```markdown
## 3.2) OpenAgents Control Registry

The OpenAgents Control Registry (`3371d9be65b38041bc59fd5cf966ff98`) is the canonical operational registry for:
- Agents (`.opencode/config/agent-metadata.json`)
- Skills (`.opencode/skills/*/SKILL.md`)
- Commands (`.opencode/command/**/*.md`)
- Workflows (`_bmad/*/module-help.csv`)
- Sync state (drift detection and sync runs)

Sync via: `bun run registry:sync` or `bun run registry:dry-run`

## 3.3) Notion Surfaces

| Surface | ID | Role |
|---------|-----|------|
| Backend Hub | `6581d9be65b38262a2218102c1e6dd1d` | Structural governance |
| OpenAgents Control | `3371d9be65b38041bc59fd5cf966ff98` | CLI team registry |
| Allura Memory Control Center | `3371d9be65b381a9b3bec24275444b68` | HITL oversight |
```

---

## 3. roninmemory-intelligence.md (P0)

**Path:** `.opencode/context/project/roninmemory-intelligence.md`

### Issue
- Missing OpenAgents Control Registry
- Missing Notion surface clarification
- Missing T30/T31 clarification

### Changes

**After line 22 (after "Human Workspace (Notion)" line), add:**
```markdown

### OpenAgents Control Registry

The OpenAgents Control Registry provides 5 canonical Notion databases:
- **Agents** — Track OpenCode agents, statuses, roles
- **Skills** — Reusable skills and usage notes
- **Commands** — Commands and their intent
- **Workflows** — BMad/WDS workflow definitions
- **Sync Registry** — Drift detection and sync runs

**Sync**: `bun run registry:sync`
**Dry-run**: `bun run registry:dry-run`

### Notion Surfaces

| Surface | ID | Role |
|---------|-----|------|
| Backend Hub | `6581d9be65b38262a2218102c1e6dd1d` | Structural governance — templates, registries, migrations |
| OpenAgents Control | `3371d9be65b38041bc59fd5cf966ff98` | CLI team registry — agent roster, skills, commands |
| Allura Memory Control Center | `3371d9be65b381a9b3bec24275444b68` | HITL oversight — approvals, sync model |
```

**After line 56 (after ADR 5-Layer Framework), add:**
```markdown

### Task Status Clarification

- **T30**: MemFS Reflection Layer (P1, In Progress)
- **T31**: Sandbox Docker Execution (P2, Backlog)
- Tasks T31-T40 re-sequenced (see PROJECT.md Backlog)
```

---

## 4. agent-metadata.json (P1)

**Path:** `.opencode/config/agent-metadata.json`

### Issue
- `tenant_boundary.organization_key` references non-existent `organization_id`
- Some dependency refs may be stale

### Changes

**Lines 31-34 - Replace:**
```json
"tenant_boundary": {
  "organization_key": "organization_id",
  "memory_partition_key": "group_id",
  "global_partition_key": "global-coding-skills"
}
```

**With:**
```json
"tenant_boundary": {
  "memory_partition_key": "group_id",
  "global_partition_key": "global-coding-skills"
}
```

**Lines 103-106 - Replace:**
```json
"tenant_boundary": {
  "organization_key": "organization_id",
  "memory_partition_key": "group_id"
}
```

**With:**
```json
"tenant_boundary": {
  "memory_partition_key": "group_id"
}
```

---

## 5. orchestrator-template.md (P1)

**Path:** `.opencode/context/system-builder-templates/orchestrator-template.md`

### Issue
- Missing Brooks-bound governance pattern
- Missing dual logging policy
- Missing HITL governance workflow stage

### Changes

**After line 42 (after `<execution_context>`), add:**
```markdown
  <governance_context>
    <brooks_persona>This orchestrator is bound to the Frederick P. Brooks Jr. persona — emphasizing conceptual integrity, plan-and-document discipline, and the surgical team model.</brooks_persona>
    <dual_logging>All significant writes go to PostgreSQL (raw events) and Neo4j (curated knowledge) where available.</dual_logging>
    <hitl_gate>Behavior-changing promotions require human-in-the-loop approval.</hitl_gate>
  </governance_context>
```

**In `<workflow_execution>` section, add new stage after stage 4 (ValidateResults):**
```markdown
  <stage id="5" name="HumanApproval">
    <action>Present to human for HITL approval if behavior-changing</action>
    <prerequisites>Results validated</prerequisites>
    <trigger_conditions>
      - Agent configuration changes
      - Insight promotions to Neo4j
      - Workflow modifications
      - Architectural decisions
    </trigger_conditions>
    <process>
      1. Detect if change requires approval
      2. Package change with impact summary
      3. Submit to Notion Approval Queue
      4. Await human decision
      5. Process approval/rejection
    </process>
    <decision>
      <if test="approved">Proceed to finalize</if>
      <if test="rejected">Return to appropriate stage with feedback</if>
    </decision>
    <checkpoint>Human approval obtained or not required</checkpoint>
  </stage>
```

---

## 6. subagent-template.md (P1)

**Path:** `.opencode/context/system-builder-templates/subagent-template.md`

### Issue
- Missing tenant boundary awareness
- Missing `group_id` validation checks

### Changes

**After line 92 (after `<constraints>`), add:**
```markdown
<tenant_awareness>
  <boundary_rule>All reads/writes MUST include `group_id` for tenant isolation.</boundary_rule>
  <forbidden>Never proceed if `group_id` is missing or empty.</forbidden>
  <evidence_rule>Log to PostgreSQL for audit; promote to Neo4j only on approval.</evidence_rule>
</tenant_awareness>
```

**In `<validation_checks>` section, add to `<pre_execution>:**
```markdown
    - Verify `group_id` is present and valid
    - Check tenant isolation boundaries
    - Ensure no cross-tenant data access
```

**Add to `<post_execution>:**
```markdown
    - Confirm `group_id` was preserved in all outputs
    - Verify tenant isolation maintained
```

---

## 7. registry-databases.json (P2)

**Path:** `.opencode/config/registry-databases.json`

### Issue
- Missing documentation comment
- Missing CLI command reference

### Changes

**Add at top (before line 1):**
```json
{
  "$comment": "OpenAgents Control Registry database IDs. Sync via: bun run registry:sync. See docs/superpowers/specs/2026-04-03-openagents-control-registry-design.md",
```

---

## Execution Order

1. **navigation.md** (P0) — fixes path references immediately
2. **memory-contract.md** (P0) — aligns contract with schema reality
3. **roninmemory-intelligence.md** (P0) — adds critical registry context
4. **agent-metadata.json** (P1) — removes organization_id
5. **orchestrator-template.md** (P1) — adds governance patterns
6. **subagent-template.md** (P1) — adds tenant awareness
7. **registry-databases.json** (P2) — documentation only

---

## Verification

After changes:
```bash
# Verify no organization_id references remain in contract
grep -r "organization_id" .opencode/config/memory-contract.md

# Verify navigation paths exist
ls -la .opencode/context/project/

# Validate JSON
bun run typecheck
bun test
```

---

## Files Not Changed

- `.opencode/context/project/project-context.md` — already deprecated
- `.opencode/context/core/config/paths.json` — still correct
- `.opencode/skills/**` — no stale references found in audit