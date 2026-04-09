# SessionStart Hook — Allura Context Hydration

## What This Hook Does
On every new session, preload the essential context so agents start informed, not blind.

## Step 1: Detect First-Time vs Returning Session
Check `memory-bank/activeContext.md` for current focus.

## Step 2: Load Last Session from Allura Brain
```sql
SELECT event_type, agent_id, metadata, created_at
FROM events
WHERE group_id = 'allura-system'
ORDER BY created_at DESC
LIMIT 5
```

## Step 3: Check Active Blockers
```sql
SELECT metadata FROM events
WHERE group_id = 'allura-system'
  AND event_type = 'BLOCKED'
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 3
```

## Step 4: Render Session Briefing
```
## 🌅 Session Start — {datetime}
**Last Action**: {event_type} by @{agent_id} — {summary}
**Active Blockers**: {count} pending
**Current Focus**: {from activeContext.md}
```

## Step 5: Log Session Start
```
insert_data(events):
  event_type: 'SESSION_START'
  group_id: 'allura-system'
  agent_id: 'brooks'
  metadata: { timestamp, blockers_count }
```

## Rules
- Max 2 DB calls total (parallel allowed).
- Do NOT run Neo4j queries on startup — only on explicit commands.
- If DB unavailable → proceed with file-based context only, note failure.
