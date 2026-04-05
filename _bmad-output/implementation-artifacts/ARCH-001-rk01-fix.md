---
story_id: ARCH-001
epic: Architecture Foundation
status: ready-for-dev
priority: critical
risk_level: high
---

# Story ARCH-001: Fix groupIdEnforcer.ts Multi-Tenant Validation (RK-01)

**Status:** ready-for-dev  
**Priority:** 🔴 Critical (Blocks all multi-tenant features)  
**Risk Level:** High (Security boundary)  
**Estimated Complexity:** Medium  
**Target Files:** `src/lib/runtime/groupIdEnforcer.ts` (primary), `src/lib/policy/engine.ts` (integration)

---

## Story

As a system architect,  
I want the `groupIdEnforcer` to validate `group_id` on every database operation,  
so that multi-tenant isolation is enforced and cross-workspace data access is prevented.

---

## Problem Statement

The `groupIdEnforcer.ts` module is currently non-functional. This breaks the fundamental tenant isolation guarantee required by the Allura architecture. Without this enforcement:

- Any agent could potentially access data from other workspaces
- The `group_id` tenant boundary is not enforced
- Multi-tenant safety is compromised
- Compliance requirements (GLBA, HACCP) cannot be met

**Architecture Reference:** AD-015 (group_id as Tenant Boundary) - Status: ❌ Blocker

---

## Acceptance Criteria

### AC-1: Validation Logic
**Given** any database query operation  
**When** the operation is executed  
**Then** the `group_id` parameter must be present and valid

- [ ] Enforcer validates `group_id` is provided (not null, undefined, or empty string)
- [ ] Enforcer validates `group_id` format matches expected pattern (e.g., `roninclaw-{project}`)
- [ ] Enforcer rejects queries with missing or invalid `group_id`

### AC-2: Tenant Isolation
**Given** a query with a valid `group_id`  
**When** the query is executed  
**Then** only data for that specific tenant is returned

- [ ] PostgreSQL queries include `WHERE group_id = $1` clause
- [ ] Neo4j queries filter by `group_id` property
- [ ] Cross-tenant data access returns empty results (not other tenant's data)

### AC-3: Policy Engine Integration
**Given** the policy engine validates a data access request  
**When** `groupIdEnforcer` is invoked  
**Then** it integrates seamlessly with RuVix kernel validation

- [ ] Enforcer is called BEFORE any database operation
- [ ] Policy engine receives validation result
- [ ] Failed validations trigger appropriate error response

### AC-4: Error Handling
**Given** a validation failure  
**When** the error is thrown  
**Then** it provides actionable context for debugging

- [ ] Error includes specific code: `RK-01`
- [ ] Error message: "Cross-tenant access blocked"
- [ ] Error includes requested `group_id` and allowed `group_id` list
- [ ] Error is logged to audit trail with full context

### AC-5: MCP Server Enforcement
**Given** an MCP server request  
**When** data is accessed via `memory-server.ts` or `openclaw-gateway.ts`  
**Then** `group_id` enforcement is applied at the MCP boundary

- [ ] Memory server validates `group_id` on all queries
- [ ] OpenClaw gateway validates `group_id` on all message routing
- [ ] MCP tools reject requests without valid `group_id`

---

## Test Requirements

### Unit Tests (Co-located: `src/lib/runtime/groupIdEnforcer.test.ts`)

```typescript
// Test Case 1: Valid group_id passes
describe('validateGroupId', () => {
  it('should allow valid group_id', () => {
    const result = validateGroupId('roninclaw-faithmeats');
    expect(result.valid).toBe(true);
  });

  // Test Case 2: Missing group_id fails
  it('should reject missing group_id', () => {
    expect(() => validateGroupId(null)).toThrow(GroupIdViolationError);
    expect(() => validateGroupId(undefined)).toThrow(GroupIdViolationError);
    expect(() => validateGroupId('')).toThrow(GroupIdViolationError);
  });

  // Test Case 3: Invalid format fails
  it('should reject invalid group_id format', () => {
    expect(() => validateGroupId('invalid')).toThrow(GroupIdViolationError);
    expect(() => validateGroupId('123')).toThrow(GroupIdViolationError);
  });

  // Test Case 4: Cross-tenant access blocked
  it('should block cross-tenant access', () => {
    const allowedGroups = ['roninclaw-faithmeats'];
    expect(() => 
      validateGroupId('roninclaw-audits', allowedGroups)
    ).toThrow(GroupIdViolationError);
  });
});
```

### Integration Tests (`src/__tests__/group-id-enforcement.test.ts`)

- [ ] Test PostgreSQL queries enforce `group_id`
- [ ] Test Neo4j queries enforce `group_id`
- [ ] Test MCP server endpoints enforce `group_id`
- [ ] Test policy engine integration
- [ ] Test audit logging on violations

### Security Tests

- [ ] Attempt to query without `group_id` (should fail)
- [ ] Attempt to query with other tenant's `group_id` (should return empty)
- [ ] Attempt to bypass enforcer via direct DB access (should not be possible)
- [ ] Verify error messages don't leak sensitive data

---

## Dev Notes

### Implementation Guidance

**Architecture Pattern:** MCP-First Access
- Dashboard acts as MCP client (not direct DB access)
- Policy engine (RuVix kernel) validates at boundary
- `groupIdEnforcer` is the final validation layer before data access

**Code Pattern - Fail Fast:**
```typescript
// At the entry point of every data operation
export async function queryWithValidation<T>(
  groupId: string,
  queryFn: () => Promise<T>
): Promise<T> {
  // 1. Validate group_id exists
  if (!groupId || groupId.trim() === '') {
    throw new GroupIdViolationError(
      'group_id is required',
      'RK-01',
      groupId,
      []
    );
  }

  // 2. Validate format
  if (!isValidGroupIdFormat(groupId)) {
    throw new GroupIdViolationError(
      'Invalid group_id format',
      'RK-01',
      groupId,
      []
    );
  }

  // 3. Execute query
  return queryFn();
}
```

### Project Structure Alignment

**Target Location:** `src/lib/runtime/groupIdEnforcer.ts`
- Follow existing patterns in `src/lib/policy/` for error types
- Co-locate tests: `src/lib/runtime/groupIdEnforcer.test.ts`
- Export from `src/lib/runtime/index.ts` if exists, or create

**Integration Points:**
- `src/mcp/memory-server.ts` - Call enforcer before DB queries
- `src/mcp/openclaw-gateway.ts` - Call enforcer before message routing
- `src/lib/policy/engine.ts` - Enforcer is final validation step

### References

- **AD-015**: group_id as Tenant Boundary [Source: `_bmad-output/planning-artifacts/architecture.md`#Core Architectural Decisions]
- **Pattern**: MCP-First Access [Source: `_bmad-output/planning-artifacts/architecture.md`#API and Server Action Boundaries]
- **Error Pattern**: Typed domain errors with context [Source: `_bmad-output/planning-artifacts/architecture.md`#Error Handling]
- **Validation Pattern**: Zod at boundaries [Source: `_bmad-output/planning-artifacts/architecture.md`#Validation Patterns]

### Security Considerations

**OWASP Top 10:** A01:2021 – Broken Access Control
- This fix addresses broken tenant isolation
- Principle: Fail closed (deny access if validation unclear)

**Defense in Depth:**
1. API route validation (first layer)
2. Policy engine validation (second layer)
3. groupIdEnforcer (final layer)
4. Database constraints (database layer)

---

## Dev Agent Record

### Agent Model Used
_(To be filled during implementation)_

### Debug Log References
_(To be filled during implementation)_

### Completion Notes List
- [ ] Implementation complete
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Security tests passing
- [ ] Documentation updated
- [ ] Architecture decision status updated (AD-015: ✅)

### File List
_(To be filled during implementation)_

---

## Security Impact Assessment

**Risk:** HIGH - Without this fix, multi-tenant data isolation is compromised

**Mitigation:** This story implements the core security boundary

**Verification:**
- [ ] All database queries require valid `group_id`
- [ ] Cross-tenant queries return empty results (not other tenant's data)
- [ ] Audit trail logs all validation failures
- [ ] Error messages don't expose sensitive tenant information

**Post-Implementation:**
Once RK-01 is fixed:
1. Update AD-015 status from ❌ to ✅
2. Verify all data access paths use enforcer (audit)
3. Enable org agents in Paperclip (currently blocked)

---

## Definition of Done

- [ ] `groupIdEnforcer.ts` validates `group_id` on every operation
- [ ] Unit tests cover all validation scenarios (100% branch coverage)
- [ ] Integration tests verify end-to-end enforcement
- [ ] Security tests confirm tenant isolation
- [ ] MCP servers updated to use enforcer
- [ ] Documentation updated (AD-015 status, implementation notes)
- [ ] Code review approved by MemoryGuardian
- [ ] No regressions in existing functionality

---

**Next Step:** After approval, use `bmad-dev-story` to implement this story.
