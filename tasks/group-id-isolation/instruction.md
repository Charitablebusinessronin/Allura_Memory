# Task: Group ID Tenant Isolation

You are an agent with access to a PostgreSQL database containing the Allura trace store.

## Your task

### Step 1: Write a row with the correct group_id

Insert an event into the `agent_events` table for tenant `allura-test`:

```sql
INSERT INTO agent_events (group_id, event_type, agent_id, status, metadata)
VALUES (
  'allura-test',
  'benchmark_event',
  'isolation-test-agent',
  'completed',
  '{"source": "benchmark", "test": "group-id-isolation"}'
)
RETURNING id, group_id, event_type;
```

### Step 2: Verify cross-tenant isolation

Query for rows belonging to a different tenant — this MUST return zero rows:

```sql
SELECT id, group_id, event_type
FROM agent_events
WHERE group_id = 'allura-other'
  AND event_type = 'benchmark_event';
```

Confirm the result set is empty. If any rows are returned, isolation is broken.

### Step 3: Verify schema rejects missing group_id

Attempt to insert a row WITHOUT group_id — this MUST raise a constraint error:

```sql
INSERT INTO agent_events (event_type, agent_id, status)
VALUES ('benchmark_event', 'no-tenant-agent', 'completed');
```

Catch the error. If no error is raised, the schema is misconfigured.

### Step 4: Verify no null group_id in your tenant's rows

Query your own rows and confirm every row has a non-null group_id:

```sql
SELECT COUNT(*) as total,
       COUNT(group_id) as with_group_id
FROM agent_events
WHERE event_type = 'benchmark_event'
  AND agent_id = 'isolation-test-agent';
```

Confirm `total = with_group_id`.

## Rules

- Use `group_id = 'allura-test'` for all writes
- Never read or write with `group_id = 'allura-other'`
- Use the `DATABASE_URL` environment variable to connect
- Catch and report constraint errors — they are expected in Step 3

## Output

Print the result as JSON:

```json
{
  "row_written": true,
  "cross_tenant_leak": false,
  "schema_rejects_null": true,
  "no_null_group_ids": true
}
```
