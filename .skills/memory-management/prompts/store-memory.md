# Store Memory

Store a new memory in the system with automatic versioning and governance.

## When to Use

Use this prompt when the agent needs to:
- Remember something for future sessions
- Capture a learned insight
- Log a decision with context
- Create a versioned knowledge item

## Input Parameters

```yaml
key: "session.{id}.insight.{name}"  # Unique identifier
type: "Insight"                     # Memory node type
content: "Description of what was learned"  # Human-readable summary
value: {}                           # Structured data (JSON)
group_id: "project-slug"           # Tenant/project isolation
confidence: 0.85                   # 0-1 confidence score
tags: ["auth", "api", "best-practice"]  # Searchable tags
```

## Example Interaction

**User:** I just figured out that JWT tokens should expire in 15 minutes for mobile apps.

**Agent:**
```typescript
await memory.store({
  key: "session.abc.insight.jwt-mobile",
  type: "Insight",
  content: "JWT tokens should expire in 15 minutes for mobile apps to balance security and UX",
  value: {
    recommendation: "15 minute expiration",
    rationale: "Shorter than web (1hr) due to device theft risk",
    appliesTo: ["mobile", "ios", "android"]
  },
  group_id: "myproject",
  confidence: 0.92,
  tags: ["jwt", "mobile", "security", "auth"]
})
```

**Result:** Memory stored as draft, awaiting promotion to active status.

## Governance Note

New memories are created with `status: "draft"`. Use `memory.promote()` to activate after human review, or configure auto-promotion for trusted sources.

## Related Operations

- `memory.search()` - Find existing memories
- `memory.get()` - Retrieve specific memory
- `memory.promote()` - Activate draft memory
