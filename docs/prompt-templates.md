# Allura Memory-Backed Prompt Templates

> [!NOTE]
> **AI-Assisted Documentation**
> This file contains prompt templates optimized based on Claude Code leak analysis (12 critical primitives).

## How to Use Memory Agent Tools

### 1. Store Knowledge
```javascript
// Create entities with observations
mcp__MCP_DOCKER__create_entities({
  entities: [{
    name: "Your Concept",
    entityType: "Category",
    observations: ["Fact 1", "Fact 2", "Fact 3"]
  }]
})

// Link related concepts
mcp__MCP_DOCKER__create_relations({
  relations: [{
    from: "Concept A",
    to: "Concept B",
    relationType: "depends_on"
  }]
})
```

### 2. Retrieve Context
```javascript
// Search for relevant knowledge
mcp__MCP_DOCKER__search_nodes({ query: "your search term" })

// Get specific entities
mcp__MCP_DOCKER__open_nodes({ names: ["Entity Name"] })

// View entire graph
mcp__MCP_DOCKER__read_graph()
```

---

## Session Start Prompt Template

```markdown
## Memory Hydration Protocol

**ALWAYS run first:**
1. Invoke `allura-memory-context` skill
2. Read memory-bank/activeContext.md
3. Read memory-bank/progress.md
4. Read memory-bank/systemPatterns.md
5. Read _bmad-output/planning-artifacts/source-of-truth.md

**Retrieve from MCP memory:**
{{mcp__MCP_DOCKER__search_nodes:{"query":"current focus"}}}

## Context Loaded
- Project: {{projectName}}
- Current Sprint: {{sprintStatus}}
- Blockers: {{activeBlockers}}

## Invariants to Maintain
- ✅ group_id on every DB operation
- ✅ PostgreSQL append-only (no UPDATE/DELETE on traces)
- ✅ Neo4j SUPERSEDES versioning (never edit nodes)
- ✅ HITL required for promotion to Neo4j/Notion
- ✅ Bun only (never npm/npx)

## Ready to Proceed
What would you like to work on?
```

---

## Systematic Debugging Prompt Template

```markdown
## Debugging Protocol (5 Phases)

**STOP** - Before any fix, complete all phases.

### Phase 0: Memory Hydration
{{mcp__MCP_DOCKER__search_nodes:{"query":"previous debugging"}}}

### Phase 1: Root Cause Investigation
- [ ] Read error messages carefully
- [ ] Reproduce consistently
- [ ] Check recent changes (git log --oneline -10)
- [ ] Gather evidence

### Phase 2: Pattern Analysis
- [ ] Find working examples in codebase
- [ ] Compare failing vs working patterns
- [ ] Check memory-bank/systemPatterns.md

### Phase 3: Hypothesis & Testing
- [ ] Form ONE hypothesis
- [ ] Test hypothesis in isolation
- [ ] Document results

### Phase 4: Implementation
- [ ] Create failing test FIRST
- [ ] Implement fix
- [ ] Verify test passes

### Phase 5: Persistence
- [ ] Log to memory: {{mcp__MCP_DOCKER__add_observations}}
- [ ] Update memory-bank/progress.md
- [ ] Document fix for future sessions

## Red Flags (STOP if present)
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "I see the problem, let me fix it" (without investigation)
- 3+ failed fixes → Question architecture
```

---

## Code Review Prompt Template

```markdown
## Review Checklist

### TypeScript Standards
- [ ] Explicit return types on exported functions
- [ ] Prefer `unknown` over `any`
- [ ] `import type` for type-only imports
- [ ] Zod validation at boundaries

### Architecture Compliance
- [ ] group_id included in all DB queries
- [ ] Append-only for PostgreSQL traces
- [ ] SUPERSEDES for Neo4j versioning
- [ ] Server guards on DB modules

### Testing
- [ ] Unit tests for new logic
- [ ] Integration tests for DB operations
- [ ] Error handling tested

### Security
- [ ] No secrets in code
- [ ] Permission checks for mutating operations
- [ ] Input validation

## Memory Update
After review, update:
{{mcp__MCP_DOCKER__add_observations:{"observations":[{"entityName":"Code Review","contents":["Reviewed PR #X: findings..."]}]}}}
```

---

## Feature Implementation Prompt Template

```markdown
## Before Writing Code

### 1. Architecture Check
- [ ] Read _bmad-output/planning-artifacts/source-of-truth.md
- [ ] Verify feature aligns with systemPatterns.md
- [ ] Check for existing similar implementations

### 2. Memory Retrieval
{{mcp__MCP_DOCKER__search_nodes:{"query":"similar feature"}}}

### 3. Design Decisions
- [ ] Essential vs accidental complexity identified
- [ ] Tradeoffs documented
- [ ] Invariants defined

### 4. Implementation Plan
- [ ] Smallest decision that validates concept
- [ ] Test strategy defined
- [ ] Rollback plan ready

## During Implementation

### Code Standards
- Files: `kebab-case`
- Components: `PascalCase`
- Hooks: `camelCase` with `use` prefix
- DB identifiers: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`

### Import Order
1. External packages
2. `@/` aliases
3. Relative imports

### Error Handling
- Fail fast on missing env vars
- Typed domain errors
- Preserve causal info
- Log with context

## After Implementation

### Verification
```bash
bun run typecheck
bun run lint
bun test
```

### Memory Persistence
{{mcp__MCP_DOCKER__create_entities:{"entities":[{"name":"Feature X Implementation","entityType":"Implementation","observations":["Completed Y","Used pattern Z","Challenges: ..."]}]}}}

### Documentation Update
- [ ] Update memory-bank/progress.md
- [ ] Update memory-bank/activeContext.md
- [ ] Add to techContext.md if new dependencies
```

---

## Quick Reference: Memory Tool Patterns

### Store a Lesson Learned
```javascript
mcp__MCP_DOCKER__create_entities({
  entities: [{
    name: "Bug: Race Condition in X",
    entityType: "Lesson Learned",
    observations: [
      "Occurred when Y happened",
      "Fixed by doing Z",
      "Prevention: always check W"
    ]
  }]
})
```

### Link to Related Code
```javascript
mcp__MCP_DOCKER__create_relations({
  relations: [{
    from: "Bug: Race Condition in X",
    to: "src/lib/x.ts",
    relationType: "located_in"
  }]
})
```

### Query for Context
```javascript
// Before fixing similar bug
mcp__MCP_DOCKER__search_nodes({ query: "race condition" })
```

---

## Brooksian Principles in Prompts

1. **Conceptual Integrity**: One clear architecture per prompt
2. **No Silver Bullet**: Distinguish essential vs accidental complexity
3. **Second-System Effect**: Resist adding every cut feature
4. **Surgical Team**: Clear roles (orchestrator vs implementer)
5. **Plan to Throw One Away**: First version is a prototype

## Prompt Engineering Best Practices

1. **Be Specific**: "Improve performance" → "Reduce API calls from 10 to 2"
2. **Provide Context**: Include relevant memory, files, constraints
3. **Define Success**: Clear acceptance criteria
4. **Include Failure Modes**: What should happen when things go wrong
5. **Request Structure**: JSON, markdown, or specific format
6. **Set Constraints**: Token limits, time bounds, scope boundaries

---

*Generated based on Claude Code leak analysis - 12 critical primitives for agentic systems*
