# RalphLoop Validation Slice 1 — Calibration Report

**Date**: 2026-04-11
**Status**: Calibration Complete (Rate Limit Hit)

---

## Calibration Summary

### Three Sequential Failures

| Run | Issue | Fix Applied | Result |
|-----|-------|-------------|--------|
| 1 | Next.js server not running | Added server startup to wrapper script | ✅ Fixed |
| 2 | Model 'claude-sonnet-4' not available | Changed to 'sonnet' alias | ✅ Fixed |
| 3 | Claude API rate limit hit | Cannot fix - must wait for reset | ❌ Blocked |

---

## What Was Learned

### 1. Server Startup Required
**Issue**: Validation slice requires Next.js server running on port 3100
**Fix**: Added `bun run dev` to wrapper script with health check

```bash
# Start Next.js server in background
bun run dev &
SERVER_PID=$!

# Wait for server to be ready
for i in {1..30}; do
  if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
    echo "Server is ready!"
    break
  fi
  sleep 1
done
```

### 2. Model Aliases Work Better
**Issue**: Full model name 'claude-sonnet-4' not recognized
**Fix**: Use alias 'sonnet' instead

```bash
# Before
--model claude-sonnet-4

# After
--model sonnet
```

### 3. Rate Limits Are Real
**Issue**: Claude Code has usage limits that reset at 8pm ET
**Fix**: Cannot fix - must wait for reset or use alternative agent

---

## Brooksian Approach Applied

### ✅ Followed the Process
1. **Reviewed files** - Checked all 4 validation files before first run
2. **Ran calibration** - Executed slice as calibration, not certification
3. **Inspected evidence** - Checked RalphLoop status and terminal output
4. **Fixed smallest cause** - Applied minimal fixes for each failure
5. **Reran slice** - Attempted three runs with progressive fixes

### ✅ Preserved Conceptual Integrity
- **Bounded task** - Kept validation slice small and focused
- **Clear criteria** - 4 required checks remained unchanged
- **Small surface area** - Only fixed what was broken
- **Low risk** - No architectural changes

---

## 4 Required Checks (Not Yet Validated)

The validation slice was designed to check:

1. ✅ **Returned UUID matches metadata.memory_id**
2. ✅ **events.id is numeric (BIGSERIAL)**
3. ✅ **trace_ref is numeric in soc2 mode (BIGINT)**
4. ✅ **Evidence is complete and verifiable**

**Status**: Not yet validated due to rate limit

---

## Alternative Approaches

### Option 1: Wait for Rate Limit Reset
- **When**: Tonight at 8pm ET (America/New_York)
- **Action**: Rerun validation slice after reset
- **Pros**: Uses same agent (claude-code)
- **Cons**: Must wait

### Option 2: Use Different Agent
- **Agent**: opencode instead of claude-code
- **Action**: Update wrapper script to use `--agent opencode`
- **Pros**: Immediate execution
- **Cons**: Different agent behavior

### Option 3: Manual Validation
- **Action**: Run validation steps manually without RalphLoop
- **Pros**: Full control, no rate limit
- **Cons**: No autonomous retry

---

## Files Modified

| File | Change |
|------|--------|
| `ralph/validation-slice-1.json` | Added server startup step |
| `ralph/validation-slice-1-prompt.md` | Added server startup to approach |
| `ralph/run-validation-slice-1.sh` | Added server startup + model fix |

---

## Next Steps

### If Rate Limit Resets
1. Rerun: `./ralph/run-validation-slice-1.sh`
2. Inspect evidence against 4 required checks
3. If PASS → Begin P0-2 MCP isolation
4. If FAIL → Fix smallest cause and rerun

### If Using Alternative Agent
1. Update: `ralph/run-validation-slice-1.sh` to use `--agent opencode`
2. Rerun validation slice
3. Inspect evidence
4. Proceed based on results

---

## Key Insight

> **RalphLoop is a toolsmith's ratchet, not the architect.**

The calibration process revealed three issues, each fixed with minimal changes. The rate limit is an external constraint, not a design flaw. The validation slice is ready to run once the rate limit resets.

---

## Brooksian Reflection

**What Worked**:
- Bounded task (one endpoint, two modes)
- Clear success criteria (4 checks)
- Small surface area (validation only)
- Fast feedback (immediate failures)

**What Didn't Work**:
- External dependency (Claude API rate limit)
- Agent-specific configuration (model name)

**What Was Preserved**:
- Conceptual integrity (no architectural changes)
- Surgical team structure (toolsmith role)
- Separation of concerns (validation vs implementation)

---

## Recommendation

**Wait for rate limit reset tonight, then rerun validation slice.**

The calibration process successfully identified and fixed two configuration issues. The third issue (rate limit) is external and cannot be fixed immediately. The validation slice is ready to run once the rate limit resets.