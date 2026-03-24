# Story 6.1: Create Agent Generation Template

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** ready-for-dev
**Created:** 2026-03-17
**Dependencies:** Epics 1-5 (COMPLETE)

## User Story

As an AI engineer,
I want a BMAD template that generates new agent files in 10 minutes,
So that I can rapidly create agents without boilerplate.

## Acceptance Criteria

### Given I need a new agent
When I run the agent generation command
Then it creates:
- `agents/{agent-name}.md` (persona definition)
- `skills/{agent-name}/SKILL.md` (trigger conditions)
- `skills/{agent-name}/workflow.md` (execution steps)
- `references/{agent-name}/` folder (knowledge base)

### And all files follow BMAD naming conventions
### And the agent is registered in the local agent-manifest.csv

## Technical Specification

### Generator Script Location
`/home/ronin704/dev/projects/memory/scripts/generate-agent.ts`

### Template Files

#### Agent Definition Template (`agents/{name}.md`)
```markdown
---
name: {agent-name}
description: {description}
version: 1.0.0
status: Draft
confidence: 0.0
created: {timestamp}
module: {module}
platform: {platform}
---

# {agent-name}

## Persona
{persona-description}

## Expertise
- {expertise-1}
- {expertise-2}
- {expertise-3}

## Activation
1. {step-1}
2. {step-2}
3. {step-3}

## Tools
- {tool-1}
- {tool-2}

## Memory Access
- PostgreSQL: {level}
- Neo4j: {level}
- Notion: {level}

## Examples
{example-usage}
```

#### SKILL.md Template
```markdown
---
name: {agent-name}
description: {description}
---

# {agent-name}

Use when: {trigger-conditions}

## Workflow
Follow instructions in [workflow.md](workflow.md).

## References
- {reference-1}
- {reference-2}
```

#### Workflow Template (`workflow.md`)
```markdown
# {agent-name} Workflow

## Steps
1. {step-1}
2. {step-2}
3. {step-3}

## Inputs
- {input-1}: {description}
- {input-2}: {description}

## Outputs
- {output-1}: {description}
- {output-2}: {description}

## Validation
- {validation-criteria-1}
- {validation-criteria-2}
```

### Agent Manifest Update
Append to `~/.openclaw/workspace/projects/sabir-ai-os/_bmad/_config/agent-manifest.csv`:
```csv
{agent-name},{module},{platform},Draft,0.0,{timestamp}
```

### Command Interface
```bash
npm run agent:create -- --name="grant-researcher" --module="BMM" --platform="OpenCode"
```

## Definition of Done

- [ ] Generator script exists at `scripts/generate-agent.ts`
- [ ] Running `npm run agent:create --name="test-agent"` creates all required files
- [ ] Generated files follow BMAD naming conventions
- [ ] Agent is registered in agent-manifest.csv
- [ ] Generator completes in <10 seconds
- [ ] Tests pass: `npm test -- generate-agent`
- [ ] Code review approved
- [ ] Memory log updated

## Test Cases

### Test 1: Basic Agent Creation
```bash
npm run agent:create -- --name="test-agent" --module="BMM" --platform="OpenCode"
# Expected: 4 files created, manifest updated
```

### Test 2: Module Validation
```bash
npm run agent:create -- --name="bad-agent" --module="INVALID" --platform="OpenCode"
# Expected: Error, invalid module
```

### Test 3: Platform Validation
```bash
npm run agent:create -- --name="bad-agent" --module="BMM" --platform="INVALID"
# Expected: Error, invalid platform
```

### Test 4: Duplicate Prevention
```bash
npm run agent:create -- --name="existing-agent" --module="BMM" --platform="OpenCode"
npm run agent:create -- --name="existing-agent" --module="BMM" --platform="OpenCode"
# Expected: Error, agent already exists
```

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/generate-agent.ts` | Generator script |
| `scripts/templates/agent.md` | Agent definition template |
| `scripts/templates/skill.md` | SKILL.md template |
| `scripts/templates/workflow.md` | Workflow template |
| `scripts/templates/manifest-row.csv` | Manifest row template |

## Estimated Effort
2-3 hours

## Notes
- This is the foundation for Epic 6
- Story 6.2 (PostgreSQL persistence) depends on this
- Story 6.3 (Neo4j promotion) depends on this
- Story 6.4 (Notion mirroring) depends on this

---

*Story 6.1 - Agent Generation Template*
*Epic 6 - Agent Persistence and Lifecycle Management*