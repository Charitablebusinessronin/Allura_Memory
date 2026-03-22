# Story 2.2: execute-meta-agent-search-loop

Status: complete

## Story

As an AI engineering team,
I want a meta agent to iteratively program new agent designs in code,
so that we can discover novel architectures that outperform baseline prompts.

## Acceptance Criteria

1. Given a domain-specific `search.py` script exists, when the search is executed, then the meta agent produces multiple candidate AgentDesign iterations.
2. Given candidate designs are generated, when iterations complete, then each iteration is logged as raw evidence in PostgreSQL with references available for promoted knowledge.
3. Given the search loop runs, when evaluating candidates, then it uses the evaluation harness from Story 2.1 to score each design.

## Tasks / Subtasks

- [x] Task 1: Design meta agent search algorithm (AC: 1)
  - [x] Define search space: agent configurations, prompts, tool selections.
  - [x] Design mutation operators: modify prompts, add/remove tools, adjust parameters.
  - [x] Implement search strategy: evolutionary, beam search, or similar.
- [x] Task 2: Implement agent design representation (AC: 1)
  - [x] Add `src/lib/adas/agent-design.ts` for design data structures.
  - [x] Support code generation: agent designs as executable code.
  - [x] Version control for generated designs (link to trace_ref).
- [x] Task 3: Implement meta agent search loop (AC: 1, 3)
  - [x] Add `src/lib/adas/search-loop.ts` with iterative search implementation.
  - [x] Generate initial population of candidate designs.
  - [x] Evaluate candidates using Story 2.1 harness.
  - [x] Select best candidates and mutate for next generation.
- [x] Task 4: Integrate with PostgreSQL trace layer (AC: 2)
  - [x] Log each iteration as `adas_runs` record.
  - [x] Store candidate designs and their scores.
  - [x] Link successful designs to `AgentDesign` nodes (preparation for promotion).
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test search loop generates multiple candidate designs.
  - [x] Test evaluation harness is called for each candidate.
  - [x] Test iterations are logged to PostgreSQL.
  - [x] Test search converges on better designs over time.

## Dev Notes

- This is the core ADAS discovery process - the "search.py" style loop.
- The meta agent needs to generate actual executable code, not just configs.
- Search strategy can start simple (random mutations) and evolve to more sophisticated (genetic algorithms).
- Consider parallel evaluation of candidates for speed.
- The loop should respect Kmax (max iterations) from NFR7.

### Project Structure Notes

- Extend `src/lib/adas/` with search loop implementation.
- Agent designs should be serializable to code and back.
- Integration with evaluation harness is critical.

### References

- Evaluation harness: Story 2.1
- PostgreSQL adas_runs table: `src/lib/postgres/schema/traces.sql:138`
- FR1: Meta agent: `epics.md:20`
- FR23: search.py process: `epics.md:64`
- Epic 2 context: `_bmad-output/planning-artifacts/epics.md:282`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL), Story 2.1 (Evaluation Harness)
- PostgreSQL container: `knowledge-postgres`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Meta agent search algorithm designed
- [x] Agent design representation implemented
- [x] Search loop working with evaluation harness
- [x] PostgreSQL integration complete
- [x] All tests passing

### File List

- `src/lib/adas/agent-design.ts` - Agent design data structures and code generation
- `src/lib/adas/agent-design.test.ts` - Design tests (29 tests passing)
- `src/lib/adas/search-loop.ts` - Meta agent search implementation
- `src/lib/adas/search-loop.test.ts` - Search loop tests (16 tests passing)
- `src/lib/adas/mutations.ts` - Mutation operators for evolutionary search
- `src/lib/adas/mutations.test.ts` - Mutation tests (21 tests passing)
- `src/lib/adas/index.ts` - Updated exports for all ADAS modules

### Implementation Summary

The meta agent search loop implements an evolutionary algorithm:

1. **Search Space (agent-design.ts)**
   - `SearchSpace` interface defines available tools, models, reasoning strategies
   - `DEFAULT_SEARCH_SPACE` with 8 tools, 6 model configs, 4 reasoning strategies
   - `PROMPT_TEMPLATES` for each reasoning strategy (CoT, ReAct, Plan-Execute, Reflexion)

2. **Agent Design Representation**
   - `AgentDesign` type with config, metadata, and version tracking
   - `generateRandomDesign()` creates diverse initial population
   - `generateAgentCode()` produces executable TypeScript code
   - `cloneDesign()` for parent-child relationships

3. **Mutation Operators (mutations.ts)**
   - `mutatePrompt()` - modifies system prompts with patterns
   - `addTool()` / `removeTool()` - tool selection mutations
   - `changeModel()` / `changeStrategy()` - architecture changes
   - `mutateTemperature()` / `mutateMaxTokens()` - parameter tuning
   - `crossoverDesigns()` - combines traits from two parents

4. **Search Loop (search-loop.ts)**
   - `MetaAgentSearch` class orchestrates evolutionary search
   - Generates initial population, evaluates with harness, selects elites
   - Applies mutations and crossovers to create next generation
   - Logs all iterations to PostgreSQL via events
   - Early stopping on success threshold or no improvement

5. **PostgreSQL Integration**
   - Uses `adas_runs` table for search runs
   - `events` table for iteration logging
   - Tracks mutations, designs, and scores via metadata

All 66 tests passing across agent-design, mutations, and search-loop modules.