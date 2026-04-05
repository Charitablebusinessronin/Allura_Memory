# Session Stability Skill

> Ensures 6-month operational stability for long-running agent sessions.

## Purpose

This skill provides the infrastructure for maintaining stable, recoverable agent sessions
over extended periods (6+ months). It implements:

1. **Encoding Validation** - UTF-8 integrity across all files
2. **State Hydration** - 4-layer encoding priority (Database → Neo4j → Files → Memory Bank)
3. **Checkpoint Management** - 5-minute automatic checkpoints
4. **Budget Enforcement** - Hard limits on tokens, tool calls, time, cost
5. **Drift Detection** - Planning and subagent drift monitoring
6. **Alert Management** - FATAL/WARNING/INFO alert handling

## When to Use

Use this skill:

- At the START of every agent session (via `roninmemory-context` skill)
- When initializing long-running operations (EPIC, SPRINT, STORY)
- Before and after critical state transitions
- When recovering from crashes or interruptions
- When implementing the behavior-tested loop (DEV STORY → CODE REVIEW → CORRECT COURSE → BLOOD LOOP → RETROSPECTIVE)

## Key Concepts

### 4-Layer Encoding Priority

Sessions must hydrate state from canonical sources in this order:

```
1. PostgreSQL (Database)      ← Highest priority, most durable
2. Neo4j (Serialization)     ← Curated knowledge, versioned
3. Files (.opencode/state)   ← Fast recovery, recent state
4. Memory Bank               ← Fallback documentation
```

When creating checkpoints, write to ALL layers. When hydrating, try each layer in order.

### Checkpoint Frequency

- **Automatic**: Every 5 minutes
- **Manual**: Before phase transitions (DEV → CODE_REVIEW, etc.)
- **Critical**: Before operations that might fail (database writes, API calls)

### Budget Levels

- **Default**: 100k tokens, 100 tool calls, 5min time, $10 cost, 50 steps
- **Epic**: Higher budget for complex epics
- **Story**: Standard budget for individual stories
- **Session**: Budget reset per session

### Drift Detection

Detect drift in three dimensions:

1. **Story vs Acceptance Criteria** - Implementation matches spec?
2. **Story vs Epic Timeline** - Progress on schedule?
3. **Subagent vs Planned Workflow** - Agents following plan?

### Alert Severity

- **FATAL**: Halt execution immediately (budget exceeded, database failure)
- **WARNING**: Log and continue, notify if persistent (encoding issue, drift detected)
- **INFO**: Log only (checkpoint created, phase transition)

## Implementation

### Components

```
src/lib/
├── validation/
│   ├── encoding-validator.ts        # UTF-8 validation
│   └── planning-drift-analyzer.ts   # Drift detection
├── session/
│   ├── checkpoint-manager.ts        # Checkpoint management
│   ├── state-hydrator.ts            # State hydration
│   └── session-bootstrap.ts         # Entry point
├── monitoring/
│   └── alert-manager.ts             # Alert handling
└── budget/
    └── enforcer.ts                  # Budget enforcement (existing)
```

### Scripts

```
scripts/audit/
├── daily-audit.sh   # Daily health checks
└── weekly-audit.sh  # Weekly maintenance
```

### API

```
src/app/api/health/route.ts
├── GET /api/health         # Basic health check
├── GET /api/health?detailed=true  # Detailed component status
└── POST /api/health        # Acknowledge alerts
```

## Usage

### Session Initialization

```typescript
import { SessionBootstrap } from '@/lib/session/session-bootstrap';

const bootstrap = new SessionBootstrap({
  groupId: 'allura-project-1',
  enableEncodingValidation: true,
  enableCheckpoints: true,
  enableBudget: true,
  enableDriftDetection: true,
});

const result = await bootstrap.bootstrap();

if (!result.success) {
  console.error('Session bootstrap failed:', result.errors);
  // Handle FATAL alerts
  // Attempt recovery from checkpoint
  const checkpoint = await bootstrap.recover();
  if (checkpoint) {
    // Resume from checkpoint
  }
}

// Session is ready
console.log('Session ID:', result.sessionId);
console.log('Loaded from:', result.state.loadedFrom);
```

### Checkpoint Management

```typescript
// Automatic checkpoints (handled by SessionBootstrap)
// Manual checkpoint for phase transitions
await bootstrap.updatePhase('CODE_REVIEW', {
  story: 'story-1.1',
  completedTests: ['test1', 'test2'],
});

// Create custom checkpoint
const checkpointId = await checkpointManager.createCheckpoint(
  sessionId,
  groupId,
  'BLOOD_LOOP',
  {
    testResults: ['pass', 'pass', 'pass'],
    coverage: 95.5,
  }
);

// Load checkpoint for recovery
const checkpoint = await checkpointManager.loadLatestCheckpoint(sessionId);
```

### State Hydration

```typescript
import { StateHydrator } from '@/lib/session/state-hydrator';

const hydrator = new StateHydrator();

// Hydrate from all available sources
const state = await hydrator.hydrate(sessionId, groupId);

// Sources tried in order:
// 1. PostgreSQL (if enableDbHydration: true)
// 2. Neo4j (if enableNeo4jHydration: true)
// 3. Files (.opencode/state/sessions)
// 4. Memory Bank (memory-bank/*.md)

console.log('Session phase:', state.phase);
console.log('Loaded from:', state.loadedFrom);
```

### Drift Detection

```typescript
import { PlanningDriftAnalyzer } from '@/lib/validation/planning-drift-analyzer';

const analyzer = new PlanningDriftAnalyzer({
  storiesDir: '_bmad-output/implementation-artifacts',
  epicsFile: '_bmad-output/planning-artifacts/epics.md',
});

await analyzer.loadPlanningArtifacts();

// Check story vs acceptance criteria
const storyDrift = analyzer.analyzeStoryVsAc('story-1.1', [
  'Implemented encoding validator',
  'Added UTF-8 validation',
]);

if (storyDrift?.hasDrift) {
  console.log('Drift detected:', storyDrift.description);
  console.log('Remediation:', storyDrift.remediation);
}

// Check story vs epic timeline
const epicDrift = analyzer.analyzeStoryVsEpic('story-1.1', 50);

// Check subagent vs planned workflow
const workflowDrift = analyzer.analyzeSubagentVsPlan(
  'MemoryBuilder',
  ['load context', 'implement', 'test', 'validate'],
  ['load context', 'implement', 'commit']  // Skipped test/validate
);

// Get priority for remediation
const priority = analyzer.getRemediationPriority(storyDrift);
```

### Alert Management

```typescript
import { AlertManager, getAlertManager } from '@/lib/monitoring/alert-manager';

const alertManager = getAlertManager();

// Create alerts
alertManager.fatal('budget', 'Budget Exhausted', 'Token budget exceeded 100k limit');
alertManager.warning('drift', 'Story Drift Detected', 'Story 1.1 implementation diverges from AC');
alertManager.info('checkpoint', 'Checkpoint Created', 'Automatic checkpoint saved');

// Register custom handler
alertManager.registerHandler('FATAL', async (alert) => {
  // Send notification, halt execution, etc.
  await sendNotification(alert);
  await haltSession(alert.sessionId);
});

// Get statistics
const stats = alertManager.getStats();
console.log('Total alerts:', stats.total);
console.log('Fatal alerts:', stats.fatal);

// Get unacknowledged alerts
const unacknowledged = alertManager.getUnacknowledgedAlerts();
unacknowledged.forEach(alert => {
  console.log(`[${alert.severity}] ${alert.title}: ${alert.description}`);
});
```

### Health Check API

```bash
# Basic health check
curl http://localhost:3000/api/health

# Detailed health check
curl http://localhost:3000/api/health?detailed=true

# Check specific components
curl http://localhost:3000/api/health?include=postgresql,neo4j

# Exclude components
curl http://localhost:3000/api/health?exclude=disk-space

# Acknowledge alerts (POST)
curl -X POST http://localhost:3000/api/health \
  -H "Content-Type: application/json" \
  -d '{"alertId": "...", "acknowledgedBy": "user@example.com"}'
```

## Error Severity Rules

### FATAL (Halt Execution)

- Budget exceeded (tokens, tool calls, time, cost, steps)
- Database connection failure
- Checkpoint persistence failure
- Encoding validation failure (null bytes, corruption)
- State hydration failure (all layers unavailable)

**Action**: 
1. Create forensic snapshot
2. Log to PostgreSQL
3. HALT and wait for human diagnosis
4. Never auto-recover from FATAL

### WARNING (Log and Continue)

- Encoding warnings (BOM, UTF-8 issues in non-critical files)
- Drift detected (story vs AC, story vs epic)
- Checkpoint directory issues (created automatically)
- Subagent workflow deviation

**Action**: 
1. Log warning
2. Continue execution
3. Notify if warning persists > 3 occurrences

### INFO (Log Only)

- Checkpoint created
- Phase transition
- State hydrated from X
- Component health check passed

**Action**: 
1. Log to file
2. No notification
3. No execution impact

## Monitoring

### Daily Audit

Run daily via cron or CI:

```bash
./scripts/audit/daily-audit.sh
```

Checks:
- Encoding validation
- Database health
- State directory health
- Budget enforcement
- Health endpoint
- TypeScript/lint
- Git status

### Weekly Audit

Run weekly via cron or CI:

```bash
./scripts/audit/weekly-audit.sh
```

Checks:
- Dependency updates
- Security vulnerabilities
- Database maintenance (VACUUM, ANALYZE)
- Log rotation
- Long-term drift analysis
- Performance metrics collection
- Trend analysis

## Recovery Procedures

### From Checkpoint

```typescript
const checkpoint = await bootstrap.recover();

if (checkpoint) {
  // Resume from checkpoint
  const state = hydrator.restoreFromCheckpoint(checkpoint);
  console.log('Recovered phase:', state.phase);
}
```

### From Memory Bank (Fallback)

If all other sources fail:

1. Read `memory-bank/activeContext.md` for current focus
2. Read `memory-bank/progress.md` for completed work
3. Read `memory-bank/systemPatterns.md` for architecture
4. Read `memory-bank/techContext.md` for tech stack

### From Scratch

If no recovery is possible:

1. Create new session with `SessionBootstrap`
2. Mark previous work as "lost" in PostgreSQL
3. Restart from last known good epic/story
4. Use `bmad-help` skill to understand next steps

## Integration with BMad Workflow

This skill integrates with the behavior-tested loop:

```
bmad-dev-story          → Bootstrap session, enable budget
    ↓
bmad-code-review        → Checkpoint before review, detect drift
    ↓
bmad-correct-course     → Analyze drift, update state
    ↓
[ Blood Loop ]          → Run tests, validate encoding, enforce budget
    ↓
bmad-retrospective      → Analyze epic-level drift, create forensic snapshot
```

Each transition:
1. Creates checkpoint
2. Validates state
3. Checks budget
4. Hydrates for next phase

## Best Practices

### Session Initialization

1. **Always bootstrap** - Never skip SessionBootstrap
2. **Enable all checks** - Encoding, budget, drift, checkpoints
3. **Handle failures** - FATAL means halt, not continue
4. **Log early** - Use AlertManager for all severity levels

### Checkpoint Strategy

1. **Automatic** - Let SessionBootstrap handle 5-minute checkpoints
2. **Manual** - Create checkpoint before risky operations
3. **Named** - Use descriptive phase names
4. **Verified** - Check checkpoint integrity on load

### Budget Management

1. **Default limits**
   - 100k tokens
   - 100 tool calls
   - 5 minutes
   - $10 cost
   - 50 steps

2. **Story budget**
   - 20k tokens
   - 20 tool calls
   - 2 minutes
   - $2 cost
   - 20 steps

3. **Monitor usage**
   - Check before each operation
   - Warn at 80%
   - Fatal at 100%
   - Record forensic snapshot at halt

### Drift Prevention

1. **Check early** - Analyze drift after each implementation
2. **Small iterations** - Smaller stories = less drift
3. **Regular audits** - Daily for encoding, weekly for planning
4. **Document decisions** - Memory Bank is fallback, not primary

## Related Skills

- `roninmemory-context` - Session initialization
- `systematic-debugging-memory` - Debug with memory hydration
- `bmad-dev-story` - Story implementation workflow
- `bmad-code-review` - Code review workflow
- `bmad-correct-course` - Course correction workflow
- `bmad-retrospective` - Epic retrospective workflow

## Sources

- `_bmad-output/planning-artifacts/epics.md` - Epic definitions
- `_bmad-output/implementation-artifacts/*.md` - Story specifications
- `memory-bank/*.md` - Session context
- `.opencode/state/checkpoints/*.json` - Checkpoint files
- `.opencode/state/sessions/*.json` - Session state files