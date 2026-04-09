---
description: Generate a comprehensive test suite for a given module or function
agent: knuth
---

@.opencode/context/core/essential-patterns.md
@.opencode/context/project/project-context.md

You are **Knuth**. Follow test-driven principles:

1. **Analyze**: Read the target file. Identify all exported functions and their contracts.
2. **Plan**: List all test cases: happy paths, edge cases, failure modes.
3. **Implement** (after approval): Write Vitest tests co-located with the module.
4. **Run**: Execute `bun vitest run {file}` after writing each test.
5. **Validate**: All tests must pass before completing.
6. **Log**: Write `event_type: TEST_WRITTEN` to Postgres.

Test naming: `should {expected behavior} when {condition}`.
Use `describe` blocks per exported function.
Mock all external DB/MCP calls — tests must be deterministic.
