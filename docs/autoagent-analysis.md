# AutoAgent Analysis — Comparison with Brooks/Allura Architecture

> [!NOTE]
> **AI-Assisted Documentation**
> Analysis of kevinrgu/autoagent repository and its relationship to Brooksian principles.

## Repository Overview

**AutoAgent** is a meta-agent framework for autonomous agent harness engineering:
- **Purpose**: Let an AI agent iteratively improve another AI agent's harness overnight
- **Core Loop**: Modify `agent.py` → Run benchmark → Check score → Keep/discard → Repeat
- **Philosophy**: Program the meta-agent via `program.md`, not the harness directly

---

## Architecture Comparison

### AutoAgent Structure

```
agent.py                    # Single-file harness under test
  ├── EDITABLE HARNESS      # prompt, tools, agent construction
  └── FIXED ADAPTER         # Harbor integration (don't touch)
  
program.md                  # Meta-agent instructions + directive
tasks/                      # Benchmark tasks (Harbor format)
results.tsv                 # Experiment log
```

### Key Design Choices

| Aspect | AutoAgent | Brooks/Allura |
|--------|-----------|---------------|
| **Orchestration** | Single agent, single file | 8-agent surgical team |
| **Evolution** | Automated hill-climbing on score | Human-guided, HITL approval |
| **Complexity** | Simplicity criterion (fewer components win) | Conceptual integrity |
| **Safety** | Docker isolation | Permission tiers + audit trails |
| **Persistence** | `results.tsv` log | PostgreSQL + Neo4j + session recovery |
| **Tool Registry** | Inline function definitions | 184-entry registry with metadata |

---

## Insights for Brooks/Allura

### 1. **Meta-Agent Loop Validation**

AutoAgent's experiment loop is a concrete implementation of several Claude Code primitives:

```python
# AutoAgent's loop (from program.md)
for experiment in experiments:
    1. Check current branch/commit
    2. Read run.log and task results
    3. Diagnose failures from trajectories
    4. Group failures by root cause
    5. Choose ONE general harness improvement
    6. Edit harness
    7. Commit change
    8. Rebuild and rerun
    9. Record results in results.tsv
    10. Decide keep/discard
```

**Brooks Enhancement**: This maps to your **Two-Level Verification** improvement:
- Level 1: Agent verifies its work (task passes)
- Level 2: Verify harness changes don't break guardrails

**Recommendation**: Add an AutoAgent-style evaluation loop to Brooks:
```typescript
interface Experiment {
  commit_hash: string;
  harness_changes: Diff;
  benchmark_results: TaskResult[];
  passed: number;
  avg_score: number;
  status: "keep" | "discard" | "crash";
  description: string;
}

// Brooks orchestrates experiments
async function runExperimentLoop(directive: string) {
  while (!humanInterrupted()) {
    const baseline = await establishBaseline();
    const improvement = await proposeImprovement(directive);
    const results = await runBenchmark();
    
    if (results.passed > baseline.passed) {
      await keepChange();
    } else if (results.passed === baseline.passed && isSimpler()) {
      await keepChange();  // Simplicity criterion
    } else {
      await discardChange();
    }
  }
}
```

---

### 2. **Tool Strategy Insight**

AutoAgent's `program.md` states:
> "A single `run_shell` tool forces the agent to write boilerplate from scratch on every call, wasting tokens and introducing errors."

**Current Brooks**: Your agents have specialized tools, but are they optimized?

**Claude Code Parallel**: AutoAgent's tool strategy aligns with Claude Code's **Tool Pool Assemblies**:
- Dynamic tool selection per session
- Specialized tools reduce failure modes
- `agent.as_tool()` for sub-agents

**Recommendation for Brooks**:
```typescript
// Current: Static tool assignment
const agentTools = allTools;  // Everything available

// Enhanced: Dynamic assembly based on task category
function assembleToolPool(task: Task): Tool[] {
  const category = classifyTask(task);
  switch (category) {
    case "code-review":
      return [readFile, grepSearch, codeReviewSkill];
    case "implementation":
      return [readFile, writeFile, editFile, runInTerminal, typecheck];
    case "architecture":
      return [readFile, searchNodes, createEntities, architectSkill];
  }
}
```

---

### 3. **Simplicity Criterion vs. Brooks's Law**

AutoAgent:
> "All else being equal, simpler is better. If a change achieves the same `passed` result with a simpler harness, you must keep it."

Brooks:
> "Adding manpower to a late project makes it later."

**Synthesis**: Both value **lean systems**, but measure differently:
- AutoAgent: Code complexity (lines, components)
- Brooks: Communication overhead (n(n-1)/2 paths)

**Unified Principle**:
```
Simplicity = Minimize(code_complexity × communication_overhead)
```

**Recommendation**: When Brooks delegates, prefer:
1. Simpler agent configurations (fewer tools)
2. Clearer role boundaries (reduces communication paths)
3. Reusable skills over one-off implementations

---

### 4. **Failure Analysis Pattern**

AutoAgent's diagnostic approach:
> "When diagnosing failures, look for patterns such as: misunderstanding the task, missing capability, weak information gathering, bad execution strategy, missing verification..."

**Brooks Enhancement**: Add structured failure classification:

```typescript
enum FailureCategory {
  TASK_MISUNDERSTANDING = "task_misunderstanding",
  MISSING_CAPABILITY = "missing_capability",
  WEAK_INFORMATION_GATHERING = "weak_information_gathering",
  BAD_EXECUTION_STRATEGY = "bad_execution_strategy",
  MISSING_VERIFICATION = "missing_verification",
  ENVIRONMENT_ISSUE = "environment_issue",
  SILENT_FAILURE = "silent_failure"
}

interface FailureAnalysis {
  task_id: string;
  category: FailureCategory;
  root_cause: string;
  harness_improvement: string;
  affected_task_class: string;  // Not task-specific (avoids overfitting)
}

// Brooks delegates to @oracle for analysis
async function analyzeFailures(results: TaskResult[]): Promise<FailureAnalysis[]> {
  return await delegate("@oracle", {
    task: "classify failures by root cause",
    input: results,
    output_format: "FailureAnalysis[]"
  });
}
```

---

### 5. **Overfitting Protection**

AutoAgent's rule:
> "Use this test: 'If this exact task disappeared, would this still be a worthwhile harness improvement?'"

**Brooks Parallel**: Resist Second-System Effect

**Recommendation**: Add to Brooks's delegation criteria:
```typescript
function evaluateImprovement(proposal: Improvement): boolean {
  const test = "If this exact task disappeared, would this still be worthwhile?";
  const isGeneral = checkGeneralApplicability(proposal);
  const reducesComplexity = measureComplexityDelta(proposal) < 0;
  
  return isGeneral && (proposal.improvesScore || reducesComplexity);
}
```

---

### 6. **Session Persistence Gap**

AutoAgent:
- Logs to `results.tsv` (experiment ledger)
- Trajectory in `trajectory.json`
- No explicit session recovery

Claude Code:
- Full JSON session state
- Survives crashes with reconstruction

**Brooks Advantage**: Your **Session Persistence Enhancement** improvement already exceeds AutoAgent's approach.

**Recommendation**: Document this as a differentiator:
```markdown
## Brooks vs. AutoAgent: Session Management

| Feature | AutoAgent | Brooks (Enhanced) |
|---------|-----------|-------------------|
| Experiment Log | `results.tsv` | PostgreSQL + Neo4j |
| Trajectory | `trajectory.json` | Full session reconstruction |
| Crash Recovery | None | Full state restoration |
| Token Tracking | Basic | Budget enforcement |
```

---

## Concrete Brooks Improvements from AutoAgent

### 1. Add Experiment Tracking

```typescript
// New entity in memory graph
interface Experiment {
  experiment_id: string;
  directive: string;           // From program.md equivalent
  baseline_score: number;
  proposed_changes: Diff;
  results: TaskResult[];
  passed: number;
  total: number;
  status: "keep" | "discard" | "crash";
  description: string;
  committed_by: string;
  timestamp: ISOString;
}

// Brooks delegates to @atlas for experiment orchestration
```

### 2. Implement Simplicity Scoring

```typescript
function calculateSimplicityScore(harness: Harness): number {
  const components = countComponents(harness);
  const linesOfCode = countLines(harness);
  const communicationPaths = (nAgents * (nAgents - 1)) / 2;
  
  return 1 / (components * linesOfCode * communicationPaths);
}

// When scores are equal, simpler wins
```

### 3. Add Failure Pattern Classification

```typescript
// Delegate to @oracle for failure analysis
const failurePatterns = await analyzeFailures(results);

// Group by root cause
const grouped = groupBy(failurePatterns, "root_cause");

// Choose one general improvement
const improvement = selectMostImpactful(grouped);
```

### 4. Create program.md Equivalent

```markdown
# Brooks Meta-Agent Directive

## Goal
Maximize agent effectiveness while minimizing communication overhead.

## Simplicity Criterion
When two approaches achieve the same result, prefer:
1. Fewer agents
2. Clearer role boundaries
3. Reusable skills over one-off tools
4. Explicit over implicit

## Keep/Discard Rules
- If effectiveness improved, keep
- If effectiveness equal and simpler, keep
- Otherwise, discard (but log learnings)

## NEVER STOP
Once improvement loop begins, continue until human interrupts.
```

---

## Memory Graph Integration

Add these insights to your knowledge graph:

```
(AutoAgent Analysis)
  ├── implements → (Experiment Loop Pattern)
  ├── validates → (Simplicity Criterion)
  ├── contrasts_with → (Brooks Surgical Team)
  └── informs → (Brooks Session Persistence Enhancement)
```

---

## Summary

**AutoAgent Strengths**:
- Automated hill-climbing on objective metric
- Simplicity as first-class criterion
- Structured failure analysis
- Protection against overfitting

**Brooks/Allura Strengths**:
- Multi-agent surgical team (better for complex tasks)
- Session persistence and crash recovery
- Permission tiers and audit trails
- HITL governance (safety)

**Synthesis**: Brooks can adopt AutoAgent's experiment loop and simplicity criterion while maintaining its superior safety and persistence architecture.

---

*Analysis based on kevinrgu/autoagent repository and Claude Code leak insights*
