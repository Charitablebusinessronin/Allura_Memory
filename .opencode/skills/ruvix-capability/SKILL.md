# RuVix Capability Skill

## Overview
Manage capability-based security tokens for OpenClaw agents. Provides fine-grained, unforgeable permissions with tenant isolation (`group_id`).

## When to Use
- Agent needs cross-tenant access control
- Delegating permissions to subagents
- Revoking compromised credentials
- Auditing agent permissions

## Commands

### Grant Capability
```bash
ruvix-capability grant --to <agent-id> --capability event_create --group-id <gid> --expires 3600
```

**Capability Types:**
- `event_create` / `event_read` - Event operations
- `insight_create` / `insight_promote` / `insight_supersede` - Insight ops
- `system_checkpoint` / `system_replay` - State operations
- `policy_modify` - Administrative

### Revoke Capability
```bash
ruvix-capability revoke --token-id <cap-xxx>
```

### Verify Capability
```bash
ruvix-capability verify --token-id <cap-xxx> --required <capability>
```

### List Capabilities
```bash
ruvix-capability list --principal <agent-id>
```

## Integration with OpenClaw

### 1. Agent Activation
```typescript
// OpenClaw agent bootstrap
import { grantCapability, createEventCreateCapability } from "@/lib/ruvix/capability";

async function activateAgent(agentId: string, groupId: string) {
  const token = await grantCapability({
    capability: createEventCreateCapability(groupId),
    grantedTo: agentId,
    expiresInSecs: 3600,
  });
  
  // Store token in agent context
  agent.setCapabilityToken(token);
}
```

### 2. Cross-Tenant Isolation
```typescript
// Agent accessing another group's resources
import { verifyCapability } from "@/lib/ruvix/capability";

async function accessResource(resourceId: string, targetGroup: string) {
  const result = await verifyCapability({
    tokenId: agent.capabilityToken.tokenId,
    requiredCapability: { type: "event_read", group_id: targetGroup },
  });
  
  if (!result.valid) {
    throw new Error(`Access denied: ${result.error}`);
  }
  
  return await resourceLoader.load(resourceId);
}
```

### 3. Subagent Delegation
```typescript
// Parent agent delegating to child
import { grantCapability } from "@/lib/ruvix/capability";

async function spawnSubagent(parentToken: CapabilityToken, task: string) {
  const childToken = await grantCapability({
    capability: parentToken.capability,
    grantedTo: `subagent-${Date.now()}`,
    expiresInSecs: 1800,
  });
  
  const subagent = await spawnAgent({
    task,
    capabilityToken: childToken,
  });
  
  return subagent;
}
```

## Workflow Integration

### OpenClaw Agent Lifecycle
```
1. Agent activation
   └─ Grant initial capabilities (event_create, insight_create)
   
2. Agent execution
   └─ Verify capability before each mutation
   
3. Subagent spawn
   └─ Derive child capability from parent
   
4. Agent completion
   └─ Revoke temporary capabilities
   
5. Agent retirement
   └─ Revoke all capabilities, archive
```

### Example: Agent Promotion Workflow
```typescript
import { promoteInsightWithProof } from "@/lib/ruvix/promotion";
import { verifyCapability, createInsightPromoteCapability } from "@/lib/ruvix/capability";

async function curatorAgent(insightId: string, groupId: string) {
  // Verify promotion capability
  const capCheck = await verifyCapability({
    tokenId: agent.tokenId,
    requiredCapability: createInsightPromoteCapability(groupId),
  });
  
  if (!capCheck.valid) {
    throw new Error("Curator lacks promotion capability");
  }
  
  // Promote with Deep proof + HITL
  const result = await promoteInsightWithProof({
    insightId,
    groupId,
    summary: "Agent optimization pattern",
    confidence: 0.95,
    traceRef: "trace-456",
    entities: ["Agent", "Optimization"],
  });
  
  return result;
}
```

## Configuration

### `.opencode/config.json`
```json
{
  "skills": {
    "ruvix-capability": {
      "enabled": true,
      "sidecarUrl": "http://127.0.0.1:9001",
      "defaultExpires": 3600,
      "enforceIsolation": true
    }
  }
}
```

## Best Practices

1. **Least privilege** - Grant minimal capabilities needed
2. **Time-bound** - Always set expiration for temporary agents
3. **Derive, don't duplicate** - Child agents derive from parent
4. **Revoke on completion** - Clean up after agents finish
5. **Audit regularly** - List capabilities per agent

## Troubleshooting

### Capability Denied
```
Error: Capability verification failed
Solution: Check group_id matches, capability type correct
```

### Token Expired
```
Error: Expired at <timestamp>
Solution: Grant new capability with fresh expiration
```

### Token Revoked
```
Error: Revoked
Solution: Re-grant capability if legitimate access needed
```

## Related Skills
- `ruvix-proof` - Proof generation/verification
- `ruvix-checkpoint` - State snapshots
- `ruvix-vector-graph` - Vector/graph stores
