#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Ralph Wiggum Finish Loop — OpenCode + Team RAM Edition
# ═══════════════════════════════════════════════════════════════════════════
# Adapted from: https://github.com/ghuntley/how-to-ralph-wiggum
# Team RAM config from Notion: https://www.notion.so/555af02240844238adddb721389ec27c
#
# Usage:
#   ./ralph/loop.sh                 # Build mode, unlimited iterations
#   ./ralph/loop.sh 20              # Build mode, max 20 iterations
#   ./ralph/loop.sh plan            # Plan mode, unlimited iterations
#   ./ralph/loop.sh plan 5          # Plan mode, max 5 iterations
#   ./ralph/loop.sh plan-work "description"  # Scoped planning
#   ./ralph/loop.sh finish          # Finish push (P0→P2 from IMPLEMENTATION_PLAN.md)
#   ./ralph/loop.sh finish 10       # Finish push, max 10 iterations
#   ./ralph/loop.sh --dry-run       # Show what would be dispatched (no execution)
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RALPH_DIR="$PROJECT_ROOT/ralph"
IMPL_PLAN="$RALPH_DIR/IMPLEMENTATION_PLAN.md"

# ── Parse Arguments ─────────────────────────────────────────────────────────

MODE="build"
PROMPT_FILE="$RALPH_DIR/PROMPT_build.md"
MAX_ITERATIONS=0
DRY_RUN=false

if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=true
    shift
fi

if [ "${1:-}" = "plan" ]; then
    MODE="plan"
    PROMPT_FILE="$RALPH_DIR/PROMPT_plan.md"
    MAX_ITERATIONS=${2:-0}
elif [ "${1:-}" = "plan-work" ]; then
    if [ -z "${2:-}" ]; then
        echo "Error: plan-work requires a work description"
        echo "Usage: ./ralph/loop.sh plan-work \"description\" [max_iterations]"
        exit 1
    fi
    MODE="plan-work"
    export WORK_SCOPE="$2"
    PROMPT_FILE="$RALPH_DIR/PROMPT_plan_work.md"
    MAX_ITERATIONS=${3:-5}
elif [ "${1:-}" = "finish" ]; then
    MODE="finish"
    PROMPT_FILE="$RALPH_DIR/PROMPT_build.md"
    MAX_ITERATIONS=${2:-30}
    # Finish mode always uses IMPLEMENTATION_PLAN.md
    if [ ! -f "$IMPL_PLAN" ]; then
        echo "Error: ralph/IMPLEMENTATION_PLAN.md not found."
        echo "Run './ralph/loop.sh plan' first to generate the plan."
        exit 1
    fi
elif [[ "${1:-}" =~ ^[0-9]+$ ]]; then
    MAX_ITERATIONS=$1
fi

ITERATION=0
CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "detached")

# ── Team RAM Agent Map ──────────────────────────────────────────────────────
# Source: Notion Team Ram database (authoritative)
# https://www.notion.so/555af02240844238adddb721389ec27c

declare -A TEAM_RAM
TEAM_RAM[brooks]="BROOKS_ARCHITECT|Core|primary|Orchestrator + Chief Architect"
TEAM_RAM[jobs]="JOBS_INTENT_GATE|Core|primary|Intent Gate + Scope Owner"
TEAM_RAM[woz]="WOZ_BUILDER|Code Subagents|subagent|Primary Builder"
TEAM_RAM[scout]="SCOUT_RECON|Core Subagents|utility|Recon + Discovery"
TEAM_RAM[bellard]="BELLARD_DIAGNOSTICS_PERF|Code Subagents|specialist|Performance + Diagnostics"
TEAM_RAM[carmack]="CARMACK_PERFORMANCE|Core|specialist|Performance & Optimization"
TEAM_RAM[knuth]="KNUTH_DATA_ARCHITECT|Core|specialist|Data Architect + Schema"
TEAM_RAM[fowler]="FOWLER_REFACTOR_GATE|Core Subagents|specialist|Maintainability Gate"
TEAM_RAM[pike]="PIKE_INTERFACE_REVIEW|Core Subagents|specialist|Interface + Simplicity Gate"
TEAM_RAM[hightower]="HIGHTOWER_DEVOPS|Core|specialist|DevOps + Infrastructure"

# ── Finish Mode Dispatch Map ────────────────────────────────────────────────
# Maps IMPLEMENTATION_PLAN.md task patterns to agents

finish_dispatch() {
    local task="$1"
    # Default: Woz builds, Scout discovers, Bellard measures
    local primary="woz"
    local support="scout"

    if echo "$task" | grep -qi "load test\|k6\|performance\|benchmark\|p95\|latency"; then
        primary="bellard"
        support="carmack"
    elif echo "$task" | grep -qi "schema\|migration\|postgres\|neo4j\|data\|query"; then
        primary="knuth"
        support="woz"
    elif echo "$task" | grep -qi "docker\|ci\|deploy\|infra\|container"; then
        primary="hightower"
        support="woz"
    elif echo "$task" | grep -qi "interface\|api\|endpoint\|contract"; then
        primary="pike"
        support="woz"
    elif echo "$task" | grep -qi "refactor\|debt\|lint\|typecheck\|cleanup"; then
        primary="fowler"
        support="woz"
    elif echo "$task" | grep -qi "watchdog\|soak\|monitor\|dlq"; then
        primary="bellard"
        support="hightower"
    elif echo "$task" | grep -qi "notion\|sync\|proposal\|curator\|approve"; then
        primary="woz"
        support="knuth"
    fi

    echo "$primary|$support"
}

# ── Print Header ─────────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ralph Wiggum Finish Loop — Team RAM Edition"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Mode:       $MODE"
echo "Prompt:     $PROMPT_FILE"
echo "Project:    $PROJECT_ROOT"
echo "Branch:     $CURRENT_BRANCH"
[ $MAX_ITERATIONS -gt 0 ] && echo "Max:        $MAX_ITERATIONS iterations"
[ "$MODE" = "plan-work" ] && echo "Scope:      $WORK_SCOPE"
[ "$MODE" = "finish" ] && echo "Plan:       $IMPL_PLAN"
[ "$DRY_RUN" = true ] && echo "DRY RUN:    No execution, dispatch preview only"
echo ""
echo "Team RAM (from Notion — authoritative):"
for agent in brooks jobs woz scout bellard carmack knuth fowler pike hightower; do
    IFS='|' read -r name cat type desc <<< "${TEAM_RAM[$agent]}"
    echo "  • $name ($type) — $desc"
done
echo ""
echo "Allura Rules (NON-NEGOTIABLE):"
echo "  • bun only — never npm, npx, or node directly"
echo "  • Postgres append-only — INSERT only"
echo "  • group_id required on every DB operation"
echo "  • MCP_DOCKER tools only — never docker exec"
echo "  • Neo4j uses SUPERSEDES — never edit nodes"
echo "  • HITL required — no autonomous Neo4j promotion"
echo ""

# ── Pre-flight Checks ───────────────────────────────────────────────────────

if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

if ! command -v opencode &> /dev/null; then
    echo "Error: opencode CLI not found."
    echo "Install: https://opencode.ai"
    exit 1
fi

if [ "$MODE" = "finish" ]; then
    echo "Remaining tasks from IMPLEMENTATION_PLAN.md:"
    grep -E "^\- \[ \]" "$IMPL_PLAN" 2>/dev/null | head -20 || echo "  (no unchecked tasks found)"
    echo ""
fi

if [ "$DRY_RUN" = true ]; then
    echo "══ DRY RUN — dispatch preview ══"
    if [ "$MODE" = "finish" ]; then
        while IFS= read -r line; do
            if echo "$line" | grep -qE "^\- \[ \]"; then
                task=$(echo "$line" | sed 's/^- \[ \] //')
                dispatch=$(finish_dispatch "$task")
                primary=$(echo "$dispatch" | cut -d'|' -f1)
                support=$(echo "$dispatch" | cut -d'|' -f2)
                echo "  Task: $task"
                echo "    → Primary: $primary | Support: $support"
            fi
        done < "$IMPL_PLAN"
    else
        echo "  Mode: $MODE"
        echo "  Default dispatch: woz (build) + scout (recon)"
    fi
    echo ""
    echo "Dry run complete. No changes made."
    exit 0
fi

echo "Starting loop... (Ctrl+C to stop)"
echo "Monitor: ralph --status  (from another terminal)"
echo ""

# ── Main Loop ────────────────────────────────────────────────────────────────

while true; do
    if [ $MAX_ITERATIONS -gt 0 ] && [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo ""
        echo "Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    ITERATION=$((ITERATION + 1))

    # ── Finish mode: pick next task from plan ─────────────────────────────
    if [ "$MODE" = "finish" ]; then
        NEXT_TASK=$(grep -E "^\- \[ \]" "$IMPL_PLAN" | head -1 | sed 's/^- \[ \] //')
        if [ -z "$NEXT_TASK" ]; then
            echo ""
            echo "══════════════════════════════════════════════════════════════════"
            echo "  ALL TASKS COMPLETE! Implementation plan is finished."
            echo "══════════════════════════════════════════════════════════════════"
            break
        fi

        dispatch=$(finish_dispatch "$NEXT_TASK")
        primary=$(echo "$dispatch" | cut -d'|' -f1)
        support=$(echo "$dispatch" | cut -d'|' -f2)

        echo "======================== LOOP $ITERATION ========================"
        echo "Task:    $NEXT_TASK"
        echo "Primary: $primary | Support: $support"
        echo ""
    else
        echo "======================== LOOP $ITERATION ========================"
    fi

    # ── Run one iteration via opencode ────────────────────────────────────
    # The prompt file instructs each iteration to use Task() for parallel
    # subagent dispatch. In finish mode, the IMPLEMENTATION_PLAN.md is the
    # task source.
    export RALPH_MODE="$MODE"
    export RALPH_ITERATION="$ITERATION"
    [ "$MODE" = "finish" ] && export RALPH_NEXT_TASK="$NEXT_TASK"
    [ "$MODE" = "finish" ] && export RALPH_PRIMARY_AGENT="$primary"
    [ "$MODE" = "finish" ] && export RALPH_SUPPORT_AGENT="$support"

    if [ "$MODE" = "plan-work" ]; then
        envsubst < "$PROMPT_FILE" | opencode run --dangerously-skip-permissions 2>&1 || true
    else
        cat "$PROMPT_FILE" | opencode run --dangerously-skip-permissions 2>&1 || true
    fi

    # ── Validation Gate ───────────────────────────────────────────────────
    echo ""
    echo "--- Validation Gate (loop $ITERATION) ---"

    # Typecheck
    if (cd "$PROJECT_ROOT" && bun run typecheck 2>&1); then
        echo "✅ Typecheck: CLEAN"
    else
        echo "❌ Typecheck: FAILED — iteration $ITERATION needs fix"
    fi

    # Test suite (quick — not full E2E)
    if (cd "$PROJECT_ROOT" && bun vitest run --reporter=verbose 2>&1 | tail -5); then
        echo "✅ Tests: PASS"
    else
        echo "⚠️  Tests: some failures (check output above)"
    fi

    # ── Push changes ─────────────────────────────────────────────────────
    CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "detached")

    # Stage + commit any uncommitted changes from this iteration
    if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)" ]; then
        git -C "$PROJECT_ROOT" add -A
        git -C "$PROJECT_ROOT" commit -m "ralph: loop $ITERATION ($MODE) — $CURRENT_BRANCH" --allow-empty-message 2>/dev/null || true
        echo "📦 Changes committed"
    fi

    git -C "$PROJECT_ROOT" push origin "$CURRENT_BRANCH" 2>/dev/null || {
        echo "Push failed. Creating remote branch..."
        git -C "$PROJECT_ROOT" push -u origin "$CURRENT_BRANCH" 2>/dev/null || true
    }

    echo ""
    echo "Iteration $ITERATION done."

    # ── Finish mode: mark task complete in IMPLEMENTATION_PLAN.md ─────────
    if [ "$MODE" = "finish" ] && [ -n "$NEXT_TASK" ]; then
        # Replace first unchecked item with checked
        sed -i "0,/^- \[ \] ${NEXT_TASK}/s//- [x] ${NEXT_TASK}/" "$IMPL_PLAN" 2>/dev/null || true
        echo "✅ Marked complete: $NEXT_TASK"
    fi

    sleep 2
done

echo ""
if [ "$MODE" = "finish" ]; then
    echo "Ralph finish loop complete. Check ralph/IMPLEMENTATION_PLAN.md for final status."
else
    echo "Loop complete. Check ralph/IMPLEMENTATION_PLAN.md for status."
fi