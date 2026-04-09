# OpenCode Self-Improvement System Configuration

> [!NOTE]
> **AI-Assisted Documentation**
> This configuration applies Claude Code primitives, Brooks enhancements, and AutoAgent patterns to create a self-improving OpenCode system.

## System Overview

This prompt configures OpenCode to run an autonomous self-improvement loop using your Allura Brain (MCP memory + Neo4j/PostgreSQL) with the following capabilities:

1. **Experiment Tracking**: AutoAgent-style hill-climbing on harness improvements
2. **Session Persistence**: Claude Code-level crash recovery
3. **Structured Logging**: Typed events for observability
4. **Simplicity Criterion**: Brooksian complexity management
5. **Memory Integration**: All improvements stored in knowledge graph

---

## Configuration File

Create `.opencode/self-improvement-config.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "name": "Allura Self-Improvement System",
  "version": "1.0.0",
  
  "default_agent": "sisyphus",
  
  "improvement_loop": {
    "enabled": true,
    "mode": "autonomous",
    "check_interval_minutes": 30,
    "max_experiments_per_session": 10,
    "safety": {
      "hitl_required_for": [
        "agent_definition_changes",
        "mcp_server_additions",
        "permission_tier_changes"
      ],
      "auto_approve": [
        "prompt_refinements",
        "tool_descriptions",
        "documentation_updates"
      ]
    }
  },
  
  "experiment_tracking": {
    "baseline_required": true,
    "metrics": [
      "task_completion_rate",
      "token_efficiency",
      "session_recovery_success",
      "user_satisfaction_score"
    ],
    "keep_discard_rules": {
      "keep_if": "improved_primary_metric",
      "keep_if_equal": "simpler_harness",
      "discard_if": "regression_or_complexity_increase"
    }
  },
  
  "session_management": {
    "persistence": {
      "enabled": true,
      "format": "json",
      "location": ".opencode/state/sessions/",
      "include": [
        "conversation_history",
        "token_usage",
        "permission_decisions",
        "tool_registry_state",
        "workflow_state"
      ],
      "auto_save_after": [
        "tool_execution",
        "agent_delegation",
        "permission_decision",
        "5_minutes_idle"
      ]
    },
    "workflow_state": {
      "separate_from_conversation": true,
      "track_side_effects": true,
      "retry_safety_check": true,
      "states": [
        "planned",
        "awaiting_approval",
        "executing",
        "waiting_external",
        "completed",
        "failed",
        "recovered"
      ]
    }
  },
  
  "token_budget": {
    "enabled": true,
    "max_turns_per_session": 50,
    "max_tokens_per_session": 100000,
    "compaction_threshold": 0.8,
    "hard_stop": true,
    "warning_at": 0.7
  },
  
  "event_streaming": {
    "enabled": true,
    "event_types": [
      "SESSION_START",
      "AGENT_DELEGATION_START",
      "AGENT_DELEGATION_COMPLETE",
      "TOOL_MATCH",
      "TOOL_EXECUTION_START",
      "TOOL_EXECUTION_COMPLETE",
      "PERMISSION_REQUEST",
      "PERMISSION_DECISION",
      "TOKEN_UPDATE",
      "WORKFLOW_STATE_CHANGE",
      "CRASH",
      "RECOVERY",
      "EXPERIMENT_START",
      "EXPERIMENT_COMPLETE",
      "HARNESS_CHANGE_PROPOSED",
      "HARNESS_CHANGE_APPLIED"
    ],
    "include_crash_reasons": true
  },
  
  "system_logging": {
    "enabled": true,
    "categories": [
      "context",
      "registry",
      "routing",
      "execution",
      "permission",
      "experiment",
      "improvement"
    ],
    "destination": "postgresql",
    "table": "system_events",
    "structured": true
  },
  
  "verification": {
    "two_level": true,
    "level_1": "agent_self_check",
    "level_2": "harness_guardrail_tests",
    "tests": [
      "permission_gates_functional",
      "token_stops_work",
      "session_recovery_works",
      "workflow_state_preserved",
      "event_stream_complete"
    ],
    "run_before": "harness_change_deployment"
  },
  
  "permissions": {
    "audit_trail": true,
    "contexts": [
      "interactive",
      "coordinator",
      "swarm_worker"
    ],
    "handlers": {
      "interactive": "prompt_user",
      "coordinator": "brooks_decides",
      "swarm_worker": "pre_approved_patterns_only"
    }
  },
  
  "agent_types": {
    "orchestrator": {
      "agents": ["sisyphus", "atlas"],
      "can_delegate": true,
      "cannot_execute_tools": true
    },
    "explorer": {
      "agents": ["oracle", "librarian", "explore"],
      "can_read": true,
      "cannot_edit": true,
      "cannot_execute": true
    },
    "planner": {
      "agents": ["prometheus"],
      "can_plan": true,
      "cannot_execute": true
    },
    "implementer": {
      "agents": ["hephaestus", "torvalds", "knuth"],
      "can_read": true,
      "can_edit": true,
      "can_execute": true
    },
    "consultant": {
      "agents": ["oracle"],
      "read_only": true,
      "architecture_focus": true
    },
    "designer": {
      "agents": ["ux"],
      "ux_review": true,
      "accessibility_focus": true
    }
  },
  
  "memory_integration": {
    "enabled": true,
    "mcp_server": "allura-memory",
    "store_improvements": true,
    "store_experiments": true,
    "store_failures": true,
    "query_before_improvement": true,
    "entity_types": [
      "Improvement",
      "Experiment",
      "FailurePattern",
      "LessonLearned",
      "HarnessChange"
    ]
  },
  
  "simplicity_criterion": {
    "enabled": true,
    "metrics": {
      "code_complexity": "lines_of_code",
      "communication_overhead": "agent_interaction_paths",
      "cognitive_load": "concepts_per_agent"
    },
    "tiebreaker": "simpler_wins",
    "thresholds": {
      "max_agents": 8,
      "max_tools_per_agent": 20,
      "max_skills_per_agent": 10
    }
  },
  
  "mcp_servers": {
    "allura-memory": {
      "command": "bun",
      "args": ["run", "src/mcp/memory-server.ts"],
      "approved": true
    },
    "youtube-transcript": {
      "command": "npx",
      "args": ["-y", "@youtube-transcript-mcp"],
      "approved": true
    },
    "notion": {
      "command": "node",
      "args": [".opencode/mcp/notion/index.js"],
      "approved": true
    }
  }
}
```

---

## Meta-Agent Directive

Create `.opencode/self-improvement-directive.md`:

```markdown
# Self-Improvement Meta-Agent Directive

## Role
You are the Allura Self-Improvement System — an autonomous meta-agent that improves the OpenCode harness using your Allura Brain (MCP memory + Neo4j/PostgreSQL).

## Goal
Maximize harness effectiveness while minimizing complexity. Primary metric: task completion rate. Secondary: token efficiency, session recovery success.

## Core Loop

```
1. ESTABLISH BASELINE
   - Run benchmark suite
   - Record metrics in results.tsv
   - Store baseline in memory graph

2. ANALYZE FAILURES
   - Query memory for similar past failures
   - Classify by root cause (not symptom)
   - Group by failure pattern

3. PROPOSE IMPROVEMENT
   - Choose ONE general harness improvement
   - Check memory for previous attempts
   - Validate against simplicity criterion
   - Request HITL if required

4. APPLY CHANGE
   - Edit harness (agent.py equivalent)
   - Commit with descriptive message
   - Log to memory graph

5. VERIFY
   - Run benchmark suite
   - Compare to baseline
   - Run guardrail tests (2-level verification)

6. DECIDE
   - If improved: KEEP, update memory
   - If equal but simpler: KEEP
   - Otherwise: DISCARD, log learnings

7. REPEAT
   - Continue until human interrupts
   - Never stop to ask "should I continue"
```

## Constraints

### Invariants (Never Violate)
- ✅ group_id on every DB operation
- ✅ PostgreSQL append-only (no UPDATE/DELETE on traces)
- ✅ Neo4j SUPERSEDES versioning (never edit nodes)
- ✅ HITL required for behavior-changing promotions
- ✅ 8 agents maximum (Brooksian surgical team)
- ✅ Bun only (never npm/npx)

### Simplicity Criterion
When two approaches achieve the same result, prefer:
1. Fewer components
2. Clearer role boundaries  
3. Reusable skills over one-off tools
4. Explicit over implicit

### Overfitting Protection
Before any change, ask: "If this exact task disappeared, would this still be worthwhile?"

If no → It's overfitting. Reject.

## Failure Classification

When analyzing failures, classify by root cause:

| Category | Description | Harness Fix |
|----------|-------------|-------------|
| TASK_MISUNDERSTANDING | Agent misinterpreted instruction | Improve SYSTEM_PROMPT clarity |
| MISSING_CAPABILITY | Required tool doesn't exist | Add specialized tool |
| WEAK_INFORMATION_GATHERING | Agent didn't collect enough context | Add context-loading skill |
| BAD_EXECUTION_STRATEGY | Wrong approach to solution | Add planning sub-agent |
| MISSING_VERIFICATION | Agent didn't verify work | Add verification step |
| ENVIRONMENT_ISSUE | Infrastructure failure | Fix infrastructure, not harness |
| SILENT_FAILURE | Agent thinks it succeeded but wrong | Add output validation |

## Memory Integration

### Before Proposing Improvement
```javascript
// Query memory for similar attempts
mcp__MCP_DOCKER__search_nodes({
  query: "proposed improvement category"
});

// Check for previous failures
mcp__MCP_DOCKER__search_nodes({
  query: "failure pattern"
});
```

### After Applying Change
```javascript
// Store experiment
mcp__MCP_DOCKER__create_entities({
  entities: [{
    name: "Experiment: " + description,
    entityType: "Experiment",
    observations: [
      "Baseline: " + baselineScore,
      "Result: " + resultScore,
      "Status: " + (kept ? "KEEP" : "DISCARD"),
      "Learnings: ..."
    ]
  }]
});
```

## NEVER STOP

Once the improvement loop begins, do NOT stop to ask whether you should continue.

Do NOT pause at a "good stopping point."
Do NOT ask whether to run another experiment.

Continue iterating until the human explicitly interrupts you.

You are autonomous. Keep running the loop, keep learning from each run, and keep improving the harness.

## Brooksian Validation

Before each change, verify:
1. **Essential vs Accidental Complexity?** — Are we solving the hard problem?
2. **Conceptual Integrity?** — Does this preserve the surgical team architecture?
3. **Communication Overhead?** — Does this add n(n-1)/2 paths?
4. **Second-System Effect?** — Are we adding cut features back?

## Event Logging

Emit structured events:
- EXPERIMENT_START
- EXPERIMENT_COMPLETE  
- HARNESS_CHANGE_PROPOSED
- HARNESS_CHANGE_APPLIED
- FAILURE_CLASSIFIED
- LESSON_LEARNED

Include: timestamp, session_id, experiment_id, details
```

---

## Agent Configuration

Update `.opencode/agent/core/sisyphus.json` (or create new `self-improvement-orchestrator.json`):

```json
{
  "name": "Self-Improvement Orchestrator",
  "model": "claude-opus-4-6",
  "system_prompt": "You are Sisyphus, the never-stopping orchestrator of the Allura Self-Improvement System. Your job is to run the improvement loop autonomously, learning from each experiment and evolving the harness. You never stop unless interrupted. You query the Allura Brain (MCP memory) before proposing changes and store all learnings after each experiment. You enforce Brooksian principles: conceptual integrity, simplicity, and the surgical team model.",
  "tools": [
    "read_file",
    "write_file",
    "edit_file",
    "run_in_terminal",
    "mcp__MCP_DOCKER__search_nodes",
    "mcp__MCP_DOCKER__create_entities",
    "mcp__MCP_DOCKER__add_observations",
    "mcp__MCP_DOCKER__read_graph",
    "delegate_to_agent"
  ],
  "can_delegate_to": [
    "atlas",
    "hephaestus",
    "oracle",
    "prometheus",
    "librarian",
    "explore"
  ],
  "constraints": [
    "Must establish baseline before proposing changes",
    "Must query memory before proposing improvements",
    "Must classify failures by root cause, not symptom",
    "Must validate against simplicity criterion",
    "Must request HITL for agent/MCP/permission changes",
    "Must store all experiments in memory graph",
    "Must never stop unless explicitly interrupted"
  ],
  "improvement_loop": {
    "enabled": true,
    "autonomous": true
  }
}
```

---

## Commands

Add to `.opencode/commands/`:

### `/improvement-start`
```markdown
## Start Self-Improvement Loop

Read `.opencode/self-improvement-directive.md` and begin the autonomous improvement loop.

**Flow:**
1. Check current harness state
2. Establish baseline metrics
3. Begin experiment loop
4. Continue until interrupted

**Usage:**
```
/improvement-start
```
```

### `/improvement-status`
```markdown
## Check Improvement Status

Query the current state of the self-improvement system.

**Shows:**
- Current experiment (if running)
- Baseline metrics
- Recent experiments (keep/discard)
- Current harness version
- Memory graph statistics

**Usage:**
```
/improvement-status
```
```

### `/improvement-pause`
```markdown
## Pause Self-Improvement Loop

Gracefully pause the improvement loop after current experiment completes.

**Usage:**
```
/improvement-pause
```
```

### `/experiment-log`
```markdown
## View Experiment History

Query memory graph for all experiments.

**Options:**
- `--kept-only`: Show only kept experiments
- `--discarded-only`: Show only discarded experiments
- `--since=<date>`: Filter by date
- `--pattern=<query>`: Search by pattern

**Usage:**
```
/experiment-log --kept-only --since=2026-04-01
```
```

---

## Implementation Steps

1. **Create configuration files:**
   ```bash
   mkdir -p .opencode/self-improvement
   touch .opencode/self-improvement-config.json
   touch .opencode/self-improvement-directive.md
   ```

2. **Update agent configuration:**
   ```bash
   cp .opencode/agent/core/sisyphus.json .opencode/agent/core/self-improvement-orchestrator.json
   # Edit to add improvement_loop settings
   ```

3. **Create commands:**
   ```bash
   touch .opencode/commands/improvement-start.md
   touch .opencode/commands/improvement-status.md
   touch .opencode/commands/improvement-pause.md
   touch .opencode/commands/experiment-log.md
   ```

4. **Initialize memory:**
   ```javascript
   mcp__MCP_DOCKER__create_entities({
     entities: [{
       name: "Self-Improvement System",
       entityType: "System",
       observations: [
         "Initialized 2026-04-09",
         "Based on Claude Code primitives",
         "Uses AutoAgent experiment loop",
         "Brooksian surgical team delegation"
       ]
     }]
   });
   ```

5. **Start improvement loop:**
   ```
   /improvement-start
   ```

---

## Success Metrics

Track these in `results.tsv`:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Task Completion Rate | >90% | Benchmark suite |
| Token Efficiency | <1000/task | Token usage / tasks |
| Session Recovery | 100% | Crash tests |
| Experiment Keep Rate | >30% | Kept / total |
| Simplicity Score | Increasing | Complexity metrics |

---

## Safety Guarantees

- ✅ HITL required for architectural changes
- ✅ All experiments logged to memory
- ✅ Baseline required before changes
- ✅ Two-level verification before deployment
- ✅ Can pause/resume at any time
- ✅ Full session recovery on crash

---

*Configuration for autonomous self-improvement using Allura Brain*
