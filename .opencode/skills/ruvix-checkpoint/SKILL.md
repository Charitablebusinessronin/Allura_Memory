# RuVix Checkpoint Skill

## Overview
Create deterministic state checkpoints and replay execution traces for OpenClaw agents. Enables debugging non-deterministic LLM behavior and restoring previous states.

## When to Use
- Debug agent execution failures
- Restore state after catastrophic error
- Audit agent decision chain
- Replay agent session for analysis
- Create recovery points before risky operations

## Commands

### Create Checkpoint
```bash
ruvix-checkpoint create --label <name> --group-id <gid> --event-count <n>
```

### Replay from Checkpoint
```bash
ruvix-checkpoint replay --checkpoint-id <chk-xxx>
```

### List Checkpoints
```bash
ruvix-checkpoint list --group-id <gid>
```

### Get Checkpoint Details
```bash
ruvix-checkpoint get --checkpoint-id <chk-xxx>
```

## Integration with OpenClaw

### 1. Agent Session Checkpointing
```typescript
// OpenClaw agent loop with checkpoints
import { createCheckpoint } from "@/lib/ruvix/checkpoint";

async function agentLoop(agentId: string, tasks: Task[]) {
  let eventCount = 0;
  
  for (const task of tasks) {
    // Create checkpoint before risky operation
    if (task.riskLevel === "high") {
      await createCheckpoint({
        label: `before-${task.id}`,
        groupId: agent.groupId,
        eventCount,
      });
    }
    
    try {
      await executeTask(task);
      eventCount++;
    } catch (error) {
      // Replay from last checkpoint
      await replayCheckpoint(lastCheckpointId);
      throw error;
    }
  }
}
```

### 2. Debug Replay
```typescript
// Replay failed agent session
import { replayCheckpoint } from "@/lib/ruvix/checkpoint";

async function debugAgentFailure(failureCheckpointId: string) {
  const result = await replayCheckpoint(failureCheckpointId);
  
  if (result.success) {
    console.log(`Replayed ${result.eventsReplayed} events`);
    console.log(`Last event: ${result.lastEventId}`);
    
    // Inspect state at failure point
    await inspectState(result.lastEventId);
  } else {
    throw new Error(`Replay failed: ${result.error}`);
  }
}
```

### 3. State Restoration
```typescript
// Restore agent state after crash
import { createCheckpoint, replayCheckpoint } from "@/lib/ruvix/checkpoint";

async function recoverAgent(agentId: string, crashPoint: string) {
  // Find last good checkpoint before crash
  const checkpoints = await listCheckpoints(agentId);
  const lastGood = checkpoints.find(c => c.createdAt < crashPoint);
  
  if (!lastGood) {
    throw new Error("No recovery checkpoint found");
  }
  
  // Replay to restore state
  const result = await replayCheckpoint(lastGood.checkpointId);
  
  if (result.success) {
    await resumeAgent(agentId, result.lastEventId);
  }
}
```

## Workflow Integration

### OpenClaw Agent Execution with Checkpoints
```
1. Agent starts
   └─ Create initial checkpoint (state: empty)
   
2. Each task execution
   └─ Create pre-task checkpoint (if risky)
   └─ Execute task
   └─ Record witness log
   
3. Task failure
   └─ Replay from pre-task checkpoint
   └─ Retry with different approach
   
4. Agent completion
   └─ Create final checkpoint (state: complete)
   
5. Debug session
   └─ Replay from any checkpoint
   └─ Inspect state at each step
```

### Example: Curator Agent with Checkpoints
```typescript
import { createCheckpoint, replayCheckpoint } from "@/lib/ruvix/checkpoint";
import { promoteInsightWithProof } from "@/lib/ruvix/promotion";

async function curatorAgent(insights: string[]) {
  const groupId = "faith-meats";
  let eventCount = 0;
  
  for (const insightId of insights) {
    // Checkpoint before promotion (risky operation)
    const checkpoint = await createCheckpoint({
      label: `before-promote-${insightId}`,
      groupId,
      eventCount,
    });
    
    try {
      await promoteInsightWithProof({
        insightId,
        groupId,
        summary: "Agent pattern",
        confidence: 0.9,
        traceRef: `trace-${insightId}`,
        entities: ["Agent"],
      });
      
      eventCount++;
    } catch (error) {
      // Rollback to checkpoint
      await replayCheckpoint(checkpoint.checkpointId);
      
      // Retry with different strategy
      await retryPromotion(insightId);
    }
  }
  
  // Final checkpoint
  await createCheckpoint({
    label: "curator-complete",
    groupId,
    eventCount,
  });
}
```

## Configuration

### `.opencode/config.json`
```json
{
  "skills": {
    "ruvix-checkpoint": {
      "enabled": true,
      "sidecarUrl": "http://127.0.0.1:9001",
      "autoCheckpoint": true,
      "checkpointInterval": 10,
      "maxCheckpoints": 100
    }
  }
}
```

## Best Practices

1. **Checkpoint before mutations** - Always snapshot state before changes
2. **Label descriptively** - Use meaningful names for debugging
3. **Set retention limits** - Don't accumulate unlimited checkpoints
4. **Verify replay** - Test checkpoint restoration periodically
5. **Link to witness logs** - Trace checkpoint → events → proofs

## Troubleshooting

### Replay Failed
```
Error: Checkpoint <id> not found
Solution: Check checkpoint ID, verify it exists via list command
```

### State Hash Mismatch
```
Error: Witness log verification failed
Solution: Check witness log integrity, may indicate tampering
```

### Too Many Checkpoints
```
Error: Checkpoint limit exceeded
Solution: Increase maxCheckpoints or prune old checkpoints
```

## Related Skills
- `ruvix-proof` - Proof generation/verification
- `ruvix-capability` - Token-based permissions
- `ruvix-vector-graph` - Vector/graph stores
