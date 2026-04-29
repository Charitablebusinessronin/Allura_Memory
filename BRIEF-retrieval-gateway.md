# BRIEF: Wire Retrieval Gateway Tests into Vitest Config

## Objective
The retrieval gateway implementation (contract, gateway, policy, startup-validator) is complete but its test file `src/__tests__/retrieval-gateway.test.ts` is not included in `vitest.config.ts`. Tests can't run, so we can't verify the gateway works.

## Task
Add `src/__tests__/retrieval-gateway.test.ts` to the `include` array in `vitest.config.ts`, then run the test suite and fix any failures.

## Constraints
- Do NOT change any implementation logic — only fix tests to match existing code
- The vitest config has a specific lane architecture (unit, curator, integration, e2e, mcp) — add the test to the appropriate lane (integration, since it uses mocked Neo4j driver)
- Keep the existing test patterns (vi.mock, beforeEach, etc.)

## Verification Steps
1. `cd "/home/ronin704/Projects/allura memory" && npx vitest run src/__tests__/retrieval-gateway.test.ts` — all tests pass
2. `cd "/home/ronin704/Projects/allura memory" && pnpm test` — no regressions
3. `cd "/home/ronin704/Projects/allura memory" && npx tsc --noEmit` — zero type errors

## Definition of Done
- Test file included in vitest config
- All retrieval gateway tests pass
- No regressions in existing test suite
- Zero TypeScript errors