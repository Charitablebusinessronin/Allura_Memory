---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Tell your human partner that Superpowers works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use superpowers:subagent-driven-development instead of this skill.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Memory Integration

This skill MUST log task execution and create outcome insights.

### At Session Start

1. **Load skill**: Announce "I'm using the executing-plans skill to implement this plan."
2. **Hydrate context**:
   - Read plan file
   - Search for previous execution attempts on this workflow
   - Load any checkpoints or partial progress
3. **Log start**: `skill:executing-plans:start` with `plan_path` and `task_count`

### During Execution

Log events per task:
- `skill:executing-plans:task-start` - Before starting a task
- `skill:executing-plans:task-step` - After each verification step
- `skill:executing-plans:task-complete` - With commit SHA and test results
- `error:task-blocked` - If blocked (with blocker details)
- `error:verification-failed` - If verification fails

Example metadata:
```json
{
  "task_id": "task-3",
  "task_name": "Add user authentication",
  "files_modified": ["src/auth.ts"],
  "commit_sha": "abc123",
  "tests_passed": 5,
  "tests_failed": 0
}
```

### At Session End

1. Log `skill:executing-plans:end` with:
   - `tasks_completed`: count
   - `tasks_failed`: count
   - `final_commit`: SHA
   - `total_time_minutes`: duration
2. Create outcome insight: `Outcome: {Feature Name} Implementation`
   - Category: "Implementation"
   - Tags: ["superpowers", "execution", "outcome", "{group}"]
   - Include key achievements and any blockers encountered
3. Link to plan and all task-complete events
4. Verify write

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:finishing-a-development-branch** - Complete development after all tasks
