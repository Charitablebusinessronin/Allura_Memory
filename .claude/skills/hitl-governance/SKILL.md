---
description: HITL (Human-in-the-Loop) Governance skill. Use when managing promotion proposals, approval workflows, or human review gates.
mode: primary
temperature: 0.2
permissions:
  read: allow
  edit: allow
  bash:
    "*": allow
---

# HITL Governance Skill

Manage Human-in-the-Loop approval workflows for agent promotion and sensitive operations.

## Workflow States

```
draft → evaluating → ranked → proposed → approved → promoted
                      ↓
                   rejected
```

## Promotion Proposal

When an agent design scores above threshold:

1. **Generate Proposal**
   ```typescript
   {
     proposalId: "prop-001",
     design: AgentDesign,
     evaluationMetrics: {
       accuracy: 0.95,
       cost: 0.02,
       latency: 150,
       composite: 0.92
     },
     reviewerNotes: "",
     humanDecision: "pending"
   }
   ```

2. **Human Review**
   - Reviewer examines metrics
   - Checks design safety
   - Approves, rejects, or requests modifications

3. **Decision Recording**
   - Log to PostgreSQL
   - Create Neo4j insight if approved
   - Archive rejected proposals

## Approval Criteria

- **Composite Score ≥ 0.90**: Consider for promotion
- **Accuracy ≥ 0.95**: High confidence
- **Cost < Budget**: Within token limits
- **Safety Check**: No policy violations

## Audit Trail

Every decision must include:
- Reviewer identity
- Timestamp
- Rationale
- Alternative considered
