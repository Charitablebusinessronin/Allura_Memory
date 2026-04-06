# Task: Memory Write-Read Round Trip

You are an agent with access to a PostgreSQL database containing the Allura memory system.

## Your task

1. Insert a new event into the `events` table with the following values:
   - `event_type`: `"TASK_COMPLETE"`
   - `group_id`: `"allura-test"`
   - `agent_id`: `"memory-builder"`
   - `status`: `"completed"`
   - `metadata`: `{"task": "benchmark-write-read", "score": 1.0}`

2. Query the event back and confirm:
   - The row exists with the correct `group_id`
   - The `event_type` matches
   - The `metadata` contains `"benchmark-write-read"`

3. Prove tenant isolation: query the same table with `group_id = "allura-OTHER"` and confirm zero rows are returned for this event.

## Rules
- Never use UPDATE or DELETE on trace rows (append-only invariant)
- Always include `group_id` in every query
- Use the DATABASE_URL environment variable to connect

## Success criteria
- Event inserted: ✅
- Event read back with correct fields: ✅
- Tenant isolation verified (cross-tenant query returns 0 rows): ✅
