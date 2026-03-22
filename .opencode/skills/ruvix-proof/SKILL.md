# RuVix Proof Skill

## Overview
Integrate RuVix Cognition Kernel proof verification into OpenClaw agent workflows. Provides cryptographic proof generation and verification for all agent mutations.

## When to Use
- Agent is about to mutate state (events, insights, decisions)
- Need audit trail for compliance (SOC 2, HIPAA, GDPR)
- Debugging non-deterministic LLM behavior
- Require tamper-evident logs

## Commands

### Generate Proof
```bash
ruvix-proof generate --tier reflex|standard|deep --data <json>
```

**Tiers:**
- `reflex` (<10µs) - High-frequency events
- `standard` (~100µs) - Normal operations
- `deep` (~1ms) - Security-critical mutations

### Verify Proof
```bash
ruvix-proof verify --proof <proof-json> --data <json> --tier <tier>
```

### Record Event with Proof
```bash
ruvix-proof record-event --event-type <type> --agent-id <id> --group-id <gid> --tier reflex
```

## Integration with OpenClaw

### 1. Agent Tool Calls
```typescript
// OpenClaw agent tool
import { getRuvixBridge } from "@/lib/ruvix/bridge";

async function executeTool(tool: string, params: unknown) {
  const bridge = getRuvixBridge();
  
  // Generate proof before mutation
  const proof = await bridge.generateProof(
    { tool, params, timestamp: Date.now() },
    "standard"
  );
  
  // Execute with proof attached
  await toolExecutor.execute(tool, params, proof);
}
```

### 2. Decision Records
```typescript
// ADR with proof
import { recordEvent } from "@/lib/ruvix/promotion";

async function logDecision(decision: AgentDecision) {
  await recordEvent({
    eventId: `dec-${Date.now()}`,
    eventType: "agent_decision",
    agentId: "openclaw-agent",
    groupId: decision.groupId,
    metadata: decision,
    timestamp: new Date(),
    proofTier: "deep",
  });
}
```

## Workflow Integration

### OpenClaw Agent Loop
```
1. Receive task
2. Plan approach
3. For each mutation:
   a. Generate RuVix proof (tier based on operation)
   b. Execute mutation with proof
   c. Record witness log
4. Report completion with proof chain
```

### Example: Insight Promotion
```typescript
import { promoteInsightWithProof } from "@/lib/ruvix/promotion";

async function promoteInsight(insightId: string) {
  // OpenClaw curator agent
  const result = await promoteInsightWithProof({
    insightId,
    groupId: "faith-meats",
    summary: "Optimized agent memory retrieval",
    confidence: 0.92,
    traceRef: "trace-123",
    entities: ["Agent", "Memory", "Retrieval"],
  });
  
  if (result.success && result.proofVerified) {
    // Promotion successful with Deep proof + HITL
    return result;
  } else {
    throw new Error(`Promotion failed: ${result.error}`);
  }
}
```

## Configuration

### `.opencode/config.json`
```json
{
  "skills": {
    "ruvix-proof": {
      "enabled": true,
      "sidecarUrl": "http://127.0.0.1:9001",
      "defaultTier": "standard",
      "enforceProofs": true
    }
  }
}
```

## Best Practices

1. **Always use proofs for mutations** - No direct DB writes
2. **Choose tier appropriately** - Reflex for reads, Deep for security
3. **Store proof references** - Link witness logs to events
4. **Verify before replay** - Check proof chain integrity

## Troubleshooting

### Proof Generation Failed
```
Error: Proof generation exceeded latency budget
Solution: Check RuVix sidecar is running (curl http://127.0.0.1:9001/health)
```

### Capability Denied
```
Error: Capability verification failed
Solution: Grant capability first via ruvix-capability skill
```

## Related Skills
- `ruvix-capability` - Token-based permissions
- `ruvix-checkpoint` - State snapshots
- `ruvix-vector-graph` - Vector/graph stores
