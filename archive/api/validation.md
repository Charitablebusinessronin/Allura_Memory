# validation

> API documentation for `validation` module.

## Functions

### `levenshteinDistance`

Levenshtein distance for detecting similar (potentially misspelled) group_ids

---

### `getPostgresGroupIdStats`

Get group_id usage statistics from PostgreSQL

---

### `getNeo4jGroupIdStats`

Get group_id usage statistics from Neo4j

---

### `findSimilarGroupIds`

Find potentially misspelled group_ids (similar names) Uses Levenshtein distance to detect typos

---

### `findOrphanedGroupIds`

Find orphaned group_ids (no recent activity) An orphaned group has no events in the last N days

---

### `generateGroupIdGovernanceReport`

Generate a comprehensive governance report

---

### `validateGroupId`

Validate group_id format NFR11 compliance: lowercase-only

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - The group_id to validate |

**Throws:**

- `Error` - GroupIdValidationError if validation fails

---

### `normalizeGroupId`

Normalize a group_id to lowercase and trim whitespace

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - The group_id to normalize |

**Returns:**

`void` - Normalized group_id

---

### `isValidGroupId`

Check if a group_id is valid without throwing

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - The group_id to check |

**Returns:**

`void` - true if valid, false otherwise

---

### `isReservedGroupId`

Check if a group_id is a reserved ID

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - The group_id to check |

**Returns:**

`void` - true if reserved, false otherwise

---

### `isGlobalGroupId`

Check if a group_id is the global context ID

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - The group_id to check |

**Returns:**

`void` - true if global, false otherwise

---

### `validateGroupIds`

Validate multiple group_ids and return valid ones

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupIds` | `unknown` | - Array of group_ids to validate |

**Returns:**

`void` - Object with valid group_ids and errors

---

### `assertValidGroupId`

Assert that a group_id is valid (throws if not) Use in functions that require valid group_id

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - The group_id to assert |

**Returns:**

`void` - The validated group_id

**Throws:**

- `Error` - GroupIdValidationError if invalid

---

### `validateGroupIdWithRules`

Validate group_id with custom rules Useful for specific use cases like internal IDs

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - The group_id to validate |
| `options` | `unknown` | - Custom validation options |

**Returns:**

`void` - Validated group_id

---

### `parseTraceRef`

Parse a trace_ref string into components

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRef` | `unknown` | - The trace_ref string (e.g., "events:12345") |

**Returns:**

`void` - Parsed TraceRef object

**Throws:**

- `Error` - TraceRefValidationError if format is invalid

---

### `isSupportedTraceTable`

Validate that a trace_ref has a supported table

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRef` | `unknown` | - Parsed trace_ref |

**Returns:**

`void` - true if table is supported

---

### `formatTraceRef`

Format a trace_ref from components

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `table` | `unknown` | - Table name |
| `id` | `unknown` | - Record ID |

**Returns:**

`void` - Formatted trace_ref string

---

### `validateTraceRefFormat`

Validate a trace_ref string

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRef` | `unknown` | - The trace_ref to validate |

**Returns:**

`void` - Validation result

---

### `verifyTraceRefExists`

Verify that a trace_ref points to an existing record in PostgreSQL

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRef` | `unknown` | - The trace_ref to verify |

**Returns:**

`void` - Validation result with exists flag

---

### `validateTraceRefs`

Batch validate multiple trace_refs

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRefs` | `unknown` | - Array of trace_refs to validate |

**Returns:**

`void` - Array of validation results

---

### `extractTraceRefs`

Extract all trace_refs from a text Useful for finding references in insight content

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `text` | `unknown` | - Text to search for trace_refs |

**Returns:**

`void` - Array of found trace_refs

---

### `createEventTraceRef`

Create a trace_ref for an event Convenience function for common use case

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventId` | `unknown` | - The event ID |

**Returns:**

`void` - Formatted trace_ref

---

### `createArtifactTraceRef`

Create a trace_ref for an artifact

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `artifactId` | `unknown` | - The artifact ID |

**Returns:**

`void` - Formatted trace_ref

---

### `isTraceRefFormat`

Check if a string is a valid trace_ref format (without DB verification)

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `value` | `unknown` | - Value to check |

**Returns:**

`void` - true if format is valid

---

### `getTraceRefTable`

Get the table name from a trace_ref

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRef` | `unknown` | - The trace_ref string |

**Returns:**

`void` - Table name or null if invalid

---

### `getTraceRefId`

Get the ID from a trace_ref

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `traceRef` | `unknown` | - The trace_ref string |

**Returns:**

`void` - ID or null if invalid

---

## Classes

### `GroupIdValidationError`

Validation error for invalid group IDs

---

### `ValidGroupId`

Create a validated group_id wrapper Ensures the group_id is always valid at construction time

---

### `TraceRefValidationError`

Trace reference validation error

---

## Interfaces

### `GroupIdStats`

Group ID usage statistics

---

### `PostgresGroupIdReport`

Group ID usage across PostgreSQL

---

### `Neo4jGroupIdReport`

Group ID usage across Neo4j

---

### `GroupIdGovernanceReport`

Combined governance report

---

### `TraceRef`

Trace reference format: {table}:{id} Examples: events:12345, artifacts:67890

---

### `TraceRefValidationResult`

Trace reference validation result

---

## Type Definitions

### `ReservedGroupId`

Reserved group IDs that have special meaning

---

### `SupportedTraceTable`

Supported tables for trace references

---
