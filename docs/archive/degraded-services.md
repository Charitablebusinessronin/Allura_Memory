# Degraded Services — Notion Integration

> **Date**: April 9, 2026  
> **Decision**: Defer Notion dashboard integration to P2  
> **Principle**: "Fewer Interfaces, Stronger Contracts" — don't leave broken promises

---

## What Was Attempted

**Goal**: Create "Brooks Skill Executions" database in Notion for real-time metrics dashboard.

**Errors Encountered**:
1. `MCP_DOCKER_notion_create_pages undefined` — MCP tool not available
2. Notion API 401 unauthorized — No valid token in environment
3. Schema parameter requires SQL DDL syntax — Configuration mismatch

---

## Root Cause

**Missing Prerequisites**:
- `NOTION_TOKEN` not set in `.env` (grep returned empty)
- `.env.example` uses `NOTION_API_KEY` but MCP expects `NOTION_INTERNAL_INTEGRATION_TOKEN`
- No Notion integration has been created in the Notion workspace

**Brooksian Analysis**:
This is **accidental complexity** (OAuth token management, API version mismatches) blocking **essential work** (metrics visibility). Per *"Fewer Interfaces, Stronger Contracts"*, we have two options:

| Option | Effort | Risk | Recommendation |
|--------|--------|------|----------------|
| A: Fix Notion | 2 hours | Token expiry, API drift | Only if dashboard is operationally required |
| B: Defer to P2 | 10 min | Temporary metrics gap | **Recommended** — use Postgres directly |

---

## Decision: Option B (Defer)

**Rationale**:
1. **Postgres already has metrics** — `brooks_metrics` view provides same data
2. **No users blocked** — Dashboard is "nice to have," not "must have"
3. **Token requires manual setup** — Cannot automate Notion integration creation
4. **Simpler architecture** — One less external dependency

**What We Lose**:
- Real-time Notion dashboard for Brooks metrics
- Visual cards for non-technical stakeholders

**What We Keep**:
- Full metrics in PostgreSQL (`brooks_decisions`, `brooks_metrics` views)
- Queryable via SQL for Grafana/internal dashboards
- All data preserved; migration path to Notion remains open

---

## Recovery Path

To restore Notion integration:

1. **Create Notion Integration**:
   - Go to https://www.notion.so/my-integrations
   - Create internal integration
   - Copy token

2. **Set Environment Variable**:
   ```bash
   echo "NOTION_TOKEN=secret_xxx" >> .env
   ```

3. **Update MCP Config**:
   - Ensure `.claude/settings.json` uses correct env var name
   - Current: `NOTION_INTERNAL_INTEGRATION_TOKEN: "${NOTION_TOKEN}"`

4. **Test Connection**:
   ```bash
   mcp__MCP_DOCKER__mcp-add("notion")
   # Verify tool surfaces
   ```

5. **Re-enable P0**:
   - Update `memory-bank/activeContext.md`
   - Move Notion integration back to P0

---

## Alternative: Postgres-First Dashboard

**Immediate workaround** (no Notion required):

```sql
-- Query Brooks metrics directly
SELECT 
  DATE(created_at) as date,
  COUNT(*) as decisions,
  AVG((metadata->>'confidence')::float) as avg_confidence
FROM events
WHERE agent_id = 'brooks'
  AND event_type IN ('ADR_CREATED', 'INTERFACE_DEFINED')
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

**Grafana**: Connect to Postgres, visualize `brooks_metrics` view.

---

## Reflection

├─ Action Taken: Documented Notion degradation; deferred to P2; updated activeContext.md
├─ Principle Applied: Fewer Interfaces, Stronger Contracts (don't leave broken promises)
├─ Event Logged: SERVICE_DEGRADED (Notion integration)
├─ Neo4j Promoted: No (operational decision, not architectural)
└─ Confidence: High (clear rationale, recovery path documented)

---

**Status**: ⏸️ DEFERRED — Can be reactivated when Notion token is available.
