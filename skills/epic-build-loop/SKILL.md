# Epic Build Loop

Execute autonomous epic development with quality gates and retrospectives.

## Purpose

This skill orchestrates the complete epic development workflow:
1. **Dev story** → Implement with BMad dev-story
2. **Code review** → Run BMad code-review
3. **Validation** → Test runtime, types, lint, behavior
4. **Human gate** → Verify UI loads, prompts work
5. **Retrospective** → Run BMad retrospective
6. **Loop** → Next story

## When to Use

Use this skill when:
- Executing an epic with multiple stories
- You want automated quality gates between stories
- You need systematic epic development
- Human validation is required before proceeding

## Workflow

### Phase 1: Story Discovery

1. **Load epic context**:
   ```yaml
   files:
     - _bmad-output/planning-artifacts/epics.md
     - _bmad-output/implementation-artifacts/sprint-status.yaml
     - memory-bank/activeContext.md
   ```

2. **Identify next story**:
   - Check sprint-status.yaml for status
   - Find first story not in 'done' status
   - Verify dependencies are complete

3. **Load story specification**:
   ```yaml
   files:
     - _bmad-output/implementation-artifacts/story-{id}.md
   ```

### Phase 2: Dev Story Execution

1. **Run BMad dev-story**:
   ```bash
   # Use BMad skill to execute the story
   bmad-dev-story --story story-{id}.md
   ```

2. **Monitor execution**:
   - Watch for errors
   - If stuck, invoke `systematic-debugging` skill
   - If quality gates fail, stop and report

### Phase 3: Automated Quality Gates

After implementation completes:

1. **Type checking**:
   ```bash
   npm run typecheck
   ```
   - Must pass with 0 errors
   - If fails, report error and stop

2. **Linting**:
   ```bash
   npm run lint
   ```
   - Must pass with 0 errors
   - If fails, report error and stop

3. **Tests**:
   ```bash
   npm test
   ```
   - Must pass with 0 failures
   - If fails, report error and stop

4. **Build**:
   ```bash
   npm run build
   ```
   - Must complete successfully
   - If fails, report error and stop

### Phase 4: Code Review

1. **Run BMad code-review**:
   ```bash
   # Review the changes made during dev-story
   bmad-code-review
   ```

2. **Process review findings**:
   - If critical issues → fix immediately
   - If suggestions → log for next iteration
   - If approved → proceed

### Phase 5: Human Validation Gate

**STOP**: Present summary and await human approval

**Validation Checklist**:
- [ ] No runtime errors
- [ ] No type errors (`npm run typecheck`)
- [ ] UI loads correctly
- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Configuration correct
- [ ] Behavioral prompts work
- [ ] Implementation is functional

**Prompt user**:
```
Story {id} implementation complete.

Summary:
- Files modified: {count}
- Tests added: {count}
- Type errors: 0
- Lint errors: 0

Please verify:
1. UI loads correctly
2. Feature functions as expected
3. No unexpected behavior

Approve to proceed to retrospective?
[Y/n]
```

### Phase 6: Retrospective

If approved by human:

1. **Run BMad retrospective**:
   ```bash
   bmad-retrospective --epic epic-{id}
   ```

2. **Capture learnings**:
   - What worked well
   - What could improve
   - Patterns discovered
   - Technical debt identified

### Phase 7: Loop

1. **Update sprint-status.yaml**:
   - Mark story as 'done'
   - Update epic status if complete

2. **Decide next action**:
   - If more stories → Loop to Phase 1
   - If epic complete → Final retrospective
   - If blocked → Report and wait

## Error Handling

### Systematic Debugging

If any phase fails:

1. **Invoke systematic-debugging skill**:
   ```
   Use systematic-debugging skill
   ```

2. **Follow debugging protocol**:
   - Phase 0: Memory hydration
   - Phase 1: Root cause investigation
   - Phase 2: Pattern analysis
   - Phase 3: Hypothesis and testing
   - Phase 4: Implementation
   - Phase 5: Persistence

3. **Never retry without investigation**:
   - If 3+ fixes fail → Question architecture
   - Report findings before attempting fix

### Quality Gate Failure

If quality gates fail:

1. **Report specific failure**:
   ```
   Quality Gate Failed: {gate_name}
   Error: {error_message}
   ```

2. **Propose fix**:
   ```
   Proposed Fix:
   - {description}
   - Estimated time: {duration}
   ```

3. **Await approval before fixing**:
   - Never auto-fix
   - Always get human confirmation

## Configuration

### Required Environment Variables

```bash
# For MCP operations
GROUP_ID=allura-default  # or specific workspace

# For testing
RUN_TESTS=true
TEST_TIMEOUT=30000

# For quality gates
STRICT_LINT=true
STRICT_TYPES=true
```

### Optional Configuration

```yaml
# .opencode/epic-build-loop.yaml
epic:
  auto_retry: false  # Never auto-retry failures
  require_human_approval: true  # Always stop at human gate
  
quality_gates:
  typecheck: required
  lint: required
  test: required
  build: required
  
retrospective:
  auto_generate: true
  include_metrics: true
```

## Output Format

After each story:

```markdown
## Story {id}: {title} — ✅ COMPLETE

### Implementation
- Files created: {n}
- Files modified: {n}
- Lines added: {n}

### Quality Gates
- ✅ Type checking: 0 errors
- ✅ Lint: 0 errors
- ✅ Tests: {n}/{n} passing
- ✅ Build: Success

### Code Review
- Status: Approved
- Issues found: {n} (all resolved)

### Human Validation
- Status: Approved by {user}
- Notes: {notes}

### Retrospective
- Key learnings: {bullet points}
- Technical debt: {items}
- Next story improvements: {suggestions}
```

## Dependencies

This skill requires:
- `bmad-dev-story` skill
- `bmad-code-review` skill
- `bmad-retrospective` skill
- `systematic-debugging` skill
- Access to sprint-status.yaml
- Access to story specification files

## Example Usage

### Starting an Epic Loop

```
Start epic build loop for Epic 1
```

This will:
1. Load epic context from epics.md
2. Check sprint-status.yaml for current state
3. Identify next story to implement
4. Begin dev-story execution
5. Run quality gates
6. Request human approval
7. Run retrospective
8. Loop to next story

### Running Specific Story

```
Execute story 1.1 with epic-build-loop
```

This will:
1. Load story 1.1 specification
2. Execute dev-story
3. Run all quality gates
4. Request human validation
5. Run retrospective if approved

### Handling Blockers

If a story is blocked:

```
Story 1.3 is blocked by ARCH-002 dependency
```

This will:
1. Log blocker to sprint-status.yaml
2. Move to next available story
3. Report blocker for prioritization

## Safety Rules

1. **Never skip quality gates**
2. **Never auto-fix without approval**
3. **Always stop at human validation gate**
4. **Log all actions to memory**
5. **If 3+ failures, question architecture**
6. **Preserve conceptual integrity**

## Success Criteria

Epic build loop succeeds when:
- All stories in epic marked 'done'
- All quality gates passed
- All retrospectives completed
- No critical technical debt
- Human satisfied with outcome

---

*This skill implements the Brooksian principle: "Plan to throw one away" — each story is a learning opportunity for the next.*
