# audit

> API documentation for `audit` module.

## Functions

### `getTraceDetails`

Get full trace details from PostgreSQL

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRef` | `unknown` | - The trace_ref to look up |

**Returns:**

`void` - Trace details or null if not found

---

### `getInsightsByTraceRef`

Get all insights derived from a specific trace

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRef` | `unknown` | - The trace_ref to search for |
| `groupId` | `unknown` | - Optional group_id filter |

**Returns:**

`void` - Array of insight summaries

---

### `getAuditTrailForInsight`

Get audit trail for an insight Returns the insight with its source trace details

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `insightId` | `unknown` | - The insight_id (not the node ID) |
| `groupId` | `unknown` | - Group ID for tenant isolation |

**Returns:**

`void` - Audit trail record or null

---

### `generateAuditReport`

Create a comprehensive audit report for a group Lists all insights with their source traces

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - Group ID to generate report for |

**Returns:**

`void` - Array of audit trail records

---

### `linkInsightToTrace`

Link an insight to a trace reference Updates the source_ref property on the insight

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `insightId` | `unknown` | - The insight's stable ID |
| `groupId` | `unknown` | - Group ID for tenant isolation |
| `traceRef` | `unknown` | - The trace reference to link |

**Returns:**

`void` - True if linked successfully

---

### `unlinkInsightFromTrace`

Unlink an insight from its trace reference Clears the source_ref property

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `insightId` | `unknown` | - The insight's stable ID |
| `groupId` | `unknown` | - Group ID for tenant isolation |

**Returns:**

`void` - True if unlinked successfully

---

## Classes

### `AuditNavigationError`

Audit navigation error

---

## Interfaces

### `AuditTrailRecord`

Audit trail record combining insight and trace details

---

### `TraceDetails`

Trace details from PostgreSQL

---

### `InsightSummary`

Insight summary from Neo4j

---

## Type Definitions

### `ManagedTransaction`

Audit Navigation Queries Story 1.6: Link Promoted Knowledge Back to Raw Evidence  Navigate between Neo4j insights and PostgreSQL traces.

---
