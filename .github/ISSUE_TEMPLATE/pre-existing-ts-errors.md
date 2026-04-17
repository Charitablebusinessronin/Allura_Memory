## Summary

TypeScript errors exist in two files that are unrelated to recent work (Issue #15). These errors block `bun run typecheck` and should be fixed to maintain clean CI.

## Affected Files

### 1. src/app/memory/page.tsx (Lines 25-32)

**Error:** AlertDialog components not exported from `@/components/ui/dialog`

- Module '"@/components/ui/dialog"' has no exported member 'AlertDialog'
- Module '"@/components/ui/dialog"' has no exported member 'AlertDialogAction'
- (and 6 more similar errors)

**Likely cause:** Using AlertDialog components from a dialog module that only exports Dialog components. May need to import from `@/components/ui/alert-dialog` instead, or rename AlertDialog* to Dialog* equivalents.

### 2. src/lib/session/state-hydrator.test.ts (Lines 25, 291)

**Error:** `memoryBankDir` does not exist in type `Partial<StateHydratorConfig>`

**Likely cause:** Test fixtures use deprecated/removed config property. Need to check `StateHydratorConfig` interface for correct property name or update tests to match current config schema.

## Verification

```bash
bun run typecheck
# Should show 0 errors after fix
```

## Notes

- These errors are pre-existing and NOT caused by Issue #15
- Flagged during systematic debugging of mutate-events test failures
- Low priority but blocks clean typecheck in CI

## Acceptance Criteria

- [ ] `bun run typecheck` passes with 0 errors
- [ ] No functional changes to runtime behavior
- [ ] Tests pass after fixes

---

**Priority:** Low (does not block current work)
**Labels:** pre-existing-debt, build, good-first-issue
