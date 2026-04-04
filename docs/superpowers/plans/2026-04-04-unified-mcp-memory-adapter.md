# Unified MCP Memory Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenCode and OpenClaw use the same validated MCP memory contract with enforced `group_id` handling.

**Architecture:** Add one shared runtime contract module for memory requests, then route both MCP servers through it. Replace the placeholder group-id middleware with a real server-side guard and keep the MCP server handlers thin so the contract stays the source of truth.

**Tech Stack:** TypeScript, Zod, MCP SDK, PostgreSQL (`pg`), Neo4j, Vitest, Bun.

---

### Task 1: Add the shared memory contract module

**Files:**
- Create: `src/lib/runtime/mcp-memory-contract.ts`
- Create: `src/lib/runtime/mcp-memory-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { memoryRequestSchema } from "./mcp-memory-contract";

describe("memoryRequestSchema", () => {
  it("rejects memory requests without group_id", () => {
    const result = memoryRequestSchema.safeParse({
      operation: "memory_search",
      query: "foo",
    });

    expect(result.success).toBe(false);
  });

  it("accepts memory requests with group_id", () => {
    const result = memoryRequestSchema.safeParse({
      operation: "memory_search",
      query: "foo",
      group_id: "roninmemory",
    });

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun vitest run src/lib/runtime/mcp-memory-contract.test.ts -v`

Expected: FAIL because `mcp-memory-contract.ts` does not exist yet.

- [ ] **Step 3: Write the contract module**

Create a Zod schema that defines:
- a `group_id` string
- an operation union for memory read/write calls
- shared payload shapes for search/store requests
- exported TypeScript types derived from the schema

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun vitest run src/lib/runtime/mcp-memory-contract.test.ts -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/runtime/mcp-memory-contract.ts src/lib/runtime/mcp-memory-contract.test.ts
git commit -m "feat: add shared MCP memory contract"
```

---

### Task 2: Replace the broken group-id middleware

**Files:**
- Modify: `src/lib/runtime/groupIdEnforcer.ts`
- Create: `src/lib/runtime/groupIdEnforcer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { enforceGroupId } from "./groupIdEnforcer";

describe("enforceGroupId", () => {
  it("throws when group_id is missing for writes", () => {
    expect(() => enforceGroupId({ method: "POST", body: {} })).toThrow(
      "Missing group_id for write operation"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun vitest run src/lib/runtime/groupIdEnforcer.test.ts -v`

Expected: FAIL because the file currently imports a placeholder middleware library.

- [ ] **Step 3: Replace the middleware implementation**

Implement a server-side utility that:
- checks `group_id` on POST/PUT/PATCH/DELETE
- rejects missing `group_id` with a hard error
- does not depend on any placeholder middleware package
- uses typed request input instead of implicit `any`

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun vitest run src/lib/runtime/groupIdEnforcer.test.ts -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/runtime/groupIdEnforcer.ts src/lib/runtime/groupIdEnforcer.test.ts
git commit -m "fix: implement real group id enforcement"
```

---

### Task 3: Thread the contract through both MCP servers

**Files:**
- Modify: `src/mcp/memory-server.ts`
- Modify: `src/mcp/openclaw-gateway.ts`

- [ ] **Step 1: Write the failing test**

Add a focused test for one MCP handler path that verifies the shared contract rejects missing `group_id` before the handler runs.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun vitest run src/mcp/memory-server.test.ts src/mcp/openclaw-gateway.test.ts -v`

Expected: FAIL because the shared contract is not wired into both handlers yet.

- [ ] **Step 3: Wire both servers to the shared contract**

Update both servers so they:
- parse inbound tool arguments with the shared schema
- reject requests that do not include `group_id`
- keep tool handlers thin and focused on storage/query execution
- preserve the existing tool names and responses

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun vitest run src/mcp/memory-server.test.ts src/mcp/openclaw-gateway.test.ts -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/memory-server.ts src/mcp/openclaw-gateway.ts
git commit -m "feat: route MCP servers through shared memory contract"
```

---

### Task 4: Verify the project baseline

**Files:**
- Review: `docs/roninmemory/PROJECT.md`
- Review: `docs/planning-artifacts/epics.md`
- Review: `docs/implementation-artifacts/sprint-status.yaml`
- Review: `docs/implementation-artifacts/1-1-unified-mcp-memory-contract.md`

- [ ] **Step 1: Run typecheck**

Run: `bun run typecheck`

Expected: Existing unrelated failures remain visible until the cleanup story is implemented.

- [ ] **Step 2: Run the focused tests**

Run:
```bash
bun vitest run src/lib/runtime/mcp-memory-contract.test.ts src/lib/runtime/groupIdEnforcer.test.ts -v
```

Expected: PASS.

- [ ] **Step 3: Confirm the initialization docs are aligned**

Check that the project doc, epics file, story artifact, and sprint status all describe the same first slice of work.

- [ ] **Step 4: Commit**

```bash
git add docs/roninmemory/PROJECT.md docs/planning-artifacts/epics.md docs/implementation-artifacts/1-1-unified-mcp-memory-contract.md docs/implementation-artifacts/sprint-status.yaml
git commit -m "docs: initialize brownfield planning artifacts"
```
