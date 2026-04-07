# Verification Gate Skill

**WORKFLOW SKILL** — Enforce proof-of-completion before marking tasks done. Prevents agents from claiming completion without verification.

## When to Use

- Before marking any todo as "completed"
- Before claiming a feature is "done"
- Before moving to the next task in a plan
- When the agent says "this should work" or "tests pass"

## The Three Questions

Before marking complete, the agent MUST answer:

1. **Can I explain what every changed line does?**
   - If NO → Go back to Phase 1 (understanding)
   - If YES → Proceed to question 2

2. **Did I see it work with my own eyes?**
   - If NO → Run it. Show the output. Demonstrate the feature.
   - If YES → Proceed to question 3

3. **Am I confident this doesn't break existing functionality?**
   - If NO → Run broader tests. Check integration points.
   - If YES → Mark complete

**All 3 YES → Proceed. Any NO → Resume work.**

## Unacceptable QA Claims

These claims are NEVER acceptable without proof:

| Claim | Response |
|-------|----------|
| "This should work" | RUN IT. Show output. |
| "The types check out" | Types don't catch logic bugs. RUN IT. |
| "lsp_diagnostics is clean" | That's a TYPE check, not FUNCTIONAL. RUN IT. |
| "Tests pass" | Tests cover known cases. Does the ACTUAL FEATURE work? |
| "I implemented it" | Did you VERIFY it? Show me. |
| "The code looks correct" | Run it. Show me it working. |

## Verification Methods

### For Code Changes

```bash
# Run the specific test
npm test -- <test-file>

# Run the feature manually
npm run dev
# Then demonstrate the feature

# Check for regressions
npm run test:e2e
```

### For Configuration Changes

```bash
# Load the config and verify
node -e "const config = require('./config.json'); console.log(config);"

# Start the service and check logs
npm run start
# Verify config loaded correctly
```

### For API Changes

```bash
# Call the endpoint
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Show the response
```

### For UI Changes

```bash
# Start the dev server
npm run dev

# Open browser and demonstrate
# Take screenshot or describe what renders
```

## Integration with Continuation Harness

The verification gate integrates with the continuation harness plugin:

```javascript
// After successful verification
await verification_complete({
  sessionId: "current-session",
  proof: "Test output: ✓ All tests pass\nFeature demo: ✓ Login works\nRegression: ✓ No errors in console"
})
```

## Workflow

### Phase 1: Implementation

1. Write code
2. Write tests
3. Run tests locally
4. Fix failures

### Phase 2: Verification (MANDATORY)

1. **Explain changes**: Walk through each modified line
2. **Demonstrate working**: Run the feature, show output
3. **Check regressions**: Run broader test suite

### Phase 3: Gate Decision

```
┌─────────────────────────────────────────┐
│         VERIFICATION GATE               │
│                                         │
│  Q1: Explain every changed line?        │
│      NO → Return to Phase 1             │
│      YES ↓                               │
│                                         │
│  Q2: See it work with own eyes?          │
│      NO → Run it, show output           │
│      YES ↓                               │
│                                         │
│  Q3: Confident no breakage?              │
│      NO → Run broader tests             │
│      YES → Mark complete                 │
└─────────────────────────────────────────┘
```

## Examples

### Example 1: Feature Implementation

**Agent claims:** "I implemented the login feature."

**Verification gate response:**
```
## ⚠️ VERIFICATION REQUIRED

Before marking complete, demonstrate:

1. **Explain changes**: What files did you modify? What does each change do?

2. **Show it working**:
   ```bash
   npm run dev
   # Demonstrate login flow
   # Show successful authentication
   ```

3. **Check regressions**:
   ```bash
   npm test
   # Show all tests pass
   ```

**Do NOT mark complete until you show proof.**
```

### Example 2: Bug Fix

**Agent claims:** "Fixed the null pointer exception."

**Verification gate response:**
```
## ⚠️ VERIFICATION REQUIRED

1. **Explain the fix**: What was the root cause? What line changed?

2. **Reproduce the bug first**:
   ```bash
   # Show the bug exists before fix
   git checkout HEAD~1
   npm test -- bug-test.ts
   # Show failure
   ```

3. **Show the fix works**:
   ```bash
   git checkout -
   npm test -- bug-test.ts
   # Show pass
   ```

4. **Check for regressions**:
   ```bash
   npm test
   # All tests pass
   ```
```

## Manual QA Mandate

**You have Bash, you have tools. There is ZERO excuse for not running manual QA.**

Manual QA is the FINAL gate before reporting completion. Skip it and your work is INCOMPLETE.

| Change Type | Required Verification |
|-------------|----------------------|
| Code logic | Run tests, show output |
| API endpoint | Call endpoint, show response |
| UI component | Start app, describe render |
| Config change | Load config, verify values |
| Database migration | Run migration, check schema |
| Documentation | Build docs, verify links |

## Anti-Patterns

### Anti-Pattern 1: Claiming Without Showing

```
❌ "I implemented it, it should work."
✅ "I implemented it. Here's the test output showing it works:"
   [paste test output]
```

### Anti-Pattern 2: Type-Only Verification

```
❌ "The types check out, so it should be correct."
✅ "Types pass. Now running the actual feature:"
   [paste runtime output]
```

### Anti-Pattern 3: Test-Only Verification

```
❌ "Tests pass, so the feature works."
✅ "Tests pass. Now demonstrating the actual feature:"
   [paste feature demo]
```

## Skill Invocation

This skill is automatically invoked by the continuation harness when:

1. Agent attempts to mark todo as complete
2. Agent claims "done" without verification
3. Agent outputs completion promise without proof

The skill injects verification prompts that force the agent to demonstrate completion before proceeding.