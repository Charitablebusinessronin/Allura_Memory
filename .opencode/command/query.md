---
description: "Memory query — search memory for insights"
allowed-tools: ["mcp__MCP_DOCKER__*"]
---

# Memory Query

Search memory for relevant insights. When Allura Brain is available, uses MCP_DOCKER tools.

## Usage

```bash
/query <search term>
```

## Protocol

### Phase 1: Search Memory

Search your configured memory backend for relevant insights:

- Query by search term

- Limit results to most relevant matches

- Filter by confidence if supported

### Phase 2: Find Related Entities

Look for related entities, decisions, or events connected to the search results.

### Phase 3: Present Results

Present:

- Top insights with confidence scores

- Related entities

- Links to source events

- Recommendations for next steps

## Example

```markdown
User: /query authentication patterns

Results:
- INS-042: OAuth2 pattern adopted (confidence: 0.92)
- INS-038: JWT token rotation strategy (confidence: 0.88)
- INS-015: Session management approach (confidence: 0.85)

Related entities:
- TASK-042: Add OAuth2 authentication
- EVT-123: Architecture decision on auth
- ADR-007: Authentication strategy

Recommendation: Review INS-042 for current auth implementation.
```

---

**Invoke with:** `/query <search term>`
