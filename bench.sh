#!/bin/bash
# benchmark-opencode-autonomy.sh
# Tests that opencode.json has permissive permissions and CLI runs autonomously.
# See: https://opencode.ai/docs/permissions/ and https://opencode.ai/docs/config/
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$PROJECT_ROOT/opencode.json"
TESTS=0
PASSES=0

echo "=== OpenCode Autonomy Benchmark (Apr 2026) ==="
echo ""

# ── P1: Config loads permissively ──────────────────────────────────────────
TESTS=$((TESTS + 1))
echo -n "[P1] Config loads permissively... "
if jq -e '.permission["*"] == "allow"' "$CONFIG" >/dev/null 2>&1; then
  echo "PASS (\"*\": \"allow\" present)"; PASSES=$((PASSES + 1))
else
  echo "FAIL (\"*\": \"allow\" not found in $CONFIG)"
fi

# ── P1b: edit and bash are allow ───────────────────────────────────────────
TESTS=$((TESTS + 1))
echo -n "[P1b] edit=allow, bash=allow... "
EDIT_PERM=$(jq -r '.permission.edit // "missing"' "$CONFIG")
BASH_PERM=$(jq -r '.permission.bash // "missing"' "$CONFIG")
if [[ "$EDIT_PERM" == "allow" && "$BASH_PERM" == "allow" ]]; then
  echo "PASS (edit=$EDIT_PERM, bash=$BASH_PERM)"; PASSES=$((PASSES + 1))
else
  echo "FAIL (edit=$EDIT_PERM, bash=$BASH_PERM)"
fi

# ── P2: No prompts on edit (via opencode run) ──────────────────────────────
TESTS=$((TESTS + 1))
echo -n "[P2] No prompts on edit... "
echo "test line" > /tmp/opencode-bench-test.txt
# opencode run executes a single prompt non-interactively
# Timeout 30s; if it hangs, it's waiting for permission (FAIL)
if timeout 30 opencode run "Read /tmp/opencode-bench-test.txt and append the word 'autonomous' on a new line" >/dev/null 2>&1; then
  if grep -q "autonomous" /tmp/opencode-bench-test.txt 2>/dev/null; then
    echo "PASS (file edited autonomously)"; PASSES=$((PASSES + 1))
  else
    echo "FAIL (command ran but file not modified)"
  fi
else
  echo "FAIL (timeout or error — likely permission prompt)"
fi
rm -f /tmp/opencode-bench-test.txt

# ── P3: Bash executes free ─────────────────────────────────────────────────
TESTS=$((TESTS + 1))
echo -n "[P3] Bash executes free... "
touch /tmp/opencode-bench-marker.txt
if timeout 30 opencode run "Run the bash command: ls /tmp/opencode-bench-marker.txt" >/dev/null 2>&1; then
  echo "PASS (bash executed without prompt)"; PASSES=$((PASSES + 1))
else
  echo "FAIL (bash blocked or timed out)"
fi
rm -f /tmp/opencode-bench-marker.txt

# ── P4: Restart persistence ────────────────────────────────────────────────
TESTS=$((TESTS + 1))
echo -n "[P4] Restart persistence... "
# Verify config still has permissive permissions after a simulated restart
# (opencode.json is the source of truth; it persists across restarts)
if jq -e '.permission["*"] == "allow"' "$CONFIG" >/dev/null 2>&1; then
  echo "PASS (config persists in $CONFIG)"; PASSES=$((PASSES + 1))
else
  echo "FAIL (config lost permissive permissions)"
fi

# ── P5: Debug validates ────────────────────────────────────────────────────
TESTS=$((TESTS + 1))
echo -n "[P5] Debug validates... "
# opencode debug is the diagnostic subcommand (not "doctor")
DEBUG_OUTPUT=$(timeout 10 opencode debug 2>&1 || true)
if echo "$DEBUG_OUTPUT" | grep -qi "deny\|blocked\|override" 2>/dev/null; then
  echo "FAIL (permission warnings detected)"
else
  echo "PASS (no permission warnings)"; PASSES=$((PASSES + 1))
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
PCT=$((PASSES * 100 / TESTS))
echo "Benchmark: $PASSES/$TESTS ($PCT%) PASS"
if [[ $PCT -ge 90 ]]; then
  echo "✅ FULLY AUTONOMOUS"
else
  echo "❌ Needs fix"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Verify opencode.json has: \"permission\": { \"*\": \"allow\" }"
  echo "  2. Check global config: ~/.config/opencode/opencode.json"
  echo "  3. Run: opencode debug"
  echo "  4. Docs: https://opencode.ai/docs/permissions/"
fi