#!/usr/bin/env bash
# drift-check: Compare overlapping skills between .opencode/skills and .claude/skills
# Exit non-zero on drift (content mismatch). Safe: read-only, no destructive behavior.

set -euo pipefail

OPENCODE_DIR="$(pwd)/.opencode/skills"
CLAUDE_DIR="$(pwd)/.claude/skills"

echo "Drift check: Comparing overlapping skills..."
echo "  .opencode/skills: $OPENCODE_DIR"
echo "  .claude/skills: $CLAUDE_DIR"
echo ""

# Find all skill directories in .opencode/skills (containing SKILL.md)
# and check if they have a counterpart in .claude/skills
OVERLAPPING=()

for skill_dir in "$OPENCODE_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    
    # Get skill name from directory
    skill_name=$(basename "$skill_dir")
    
    # Check if .opencode/skills has SKILL.md
    opencode_skill="$skill_dir/SKILL.md"
    if [ -f "$opencode_skill" ]; then
        # Check if .claude/skills has counterpart (same directory structure)
        claude_skill="$CLAUDE_DIR/$skill_name/SKILL.md"
        if [ -f "$claude_skill" ]; then
            OVERLAPPING+=("$skill_name")
        fi
    fi
done

if [ ${#OVERLAPPING[@]} -eq 0 ]; then
    echo "No overlapping skills found (no SKILL.md in overlapping directories)."
    exit 0
fi

echo "Found ${#OVERLAPPING[@]} overlapping skills with SKILL.md:"
echo "  ${OVERLAPPING[*]}"
echo ""

DRIFT_FOUND=0

for skill_name in "${OVERLAPPING[@]}"; do
    echo "Checking: $skill_name"
    opencode_skill="$OPENCODE_DIR/$skill_name/SKILL.md"
    claude_skill="$CLAUDE_DIR/$skill_name/SKILL.md"
    
    if ! diff -q "$opencode_skill" "$claude_skill" >/dev/null 2>&1; then
        echo "  ❌ DRIFT DETECTED"
        DRIFT_FOUND=1
        # Show unified diff for context (limited to avoid noise)
        echo "  Diff summary:"
        # Disable pipefail for this line to avoid exit on pipe break
        (set +o pipefail; diff "$opencode_skill" "$claude_skill" | head -20)
    else
        echo "  ✓ matching"
    fi
done

echo ""

if [ $DRIFT_FOUND -eq 1 ]; then
    echo "Drift check failed. See above for details."
    echo ""
    echo "Next steps:"
    echo "  1. Review the drift above"
    echo "  2. Update the canonical .opencode/skills copy first"
    echo "  3. Then sync or retire the .claude/skills shadow copy"
    echo "  4. Run this script again to verify"
    exit 1
else
    echo "Drift check passed. All overlapping skills match."
    exit 0
fi
