# Graph Viewer: Allura Memory

> **Status:** RFC — open for review  
> **Scope:** Internal team + future Allura end-users  
> **Layer:** Presentation only — no direct Neo4j access

---

## Goal

Allow agents and human users to **view approved Insights** stored in Neo4j as an interactive graph — without exposing the database directly.

All reads go through the Allura retrieval/API layer. The graph UI renders `nodes[]` and `edges[]` returned by the API, filtered to `status: approved`.

---

## Architecture

```
User / Agent
    │
    ▼
[ Graph Viewer UI ]  ← React + NVL or Neovis.js
    │  GET /api/graph?project=&scope=&status=approved
    ▼
[ Retrieval API ]    ← Node.js / TypeScript
    │  Enforces: project scope, agent permissions, audit log
    ▼
[ Neo4j ]            ← Approved Insights only (no raw traces)
```

**Rule:** The browser never holds Neo4j credentials. No Bolt from the frontend.

---

## Viewer Options

| Tool | Best For | Effort | Fit |
|------|----------|--------|-----|
| [NeoDash](https://github.com/neo4j-labs/neodash) | Internal dashboards, quick win | Low (Docker) | High — zero-code graph/table views |
| [Neo4j Browser](https://neo4j.com/docs/browser/) | Engineer/debug only | None | Medium — not shareable |
| [Neo4j Bloom](https://neo4j.com/product/bloom/) | Business users, natural-language search | Medium | High — may require license |
| Custom React + [NVL](https://neo4j.com/docs/nvl/current/) | Production Allura UI | High (1–2 days) | Best — branded, API-gated |
| Custom React + [Neovis.js](https://github.com/neo4j-contrib/neovis.js) | Fast prototype | Medium | Good — minimal config |

---

## Recommended Path

### Phase 1 — Internal (Now)
Deploy **NeoDash** via Docker. Pre-load queries for approved Insights.

```bash
docker run -p 3001:5005 neo4jlabs/neodash
```

Sample query to visualize approved Insights and their relationships:

```cypher
MATCH (i:Insight {status: "approved"})
OPTIONAL MATCH (i)-[r:SUPERCEDES|DEPRECATED|REVERTED]->(prev:Insight)
RETURN i, r, prev
LIMIT 100
```

### Phase 2 — Production UI (Next Sprint)
Build a **React component** using NVL or Neovis.js that:
- Calls `GET /api/graph` (Allura retrieval layer)
- Renders `nodes[]` + `edges[]` as interactive graph
- Color-codes by `status`: approved (green), deprecated (gray), reverted (orange)
- Supports click-to-expand node detail panel
- Logs all view events to the audit trail

---

## API Contract (Retrieval Layer)

```typescript
// GET /api/graph
// Query params: project, scope, status (default: "approved")

interface GraphResponse {
  nodes: Array<{
    id: string;
    label: string;        // Insight summary
    status: string;       // approved | deprecated | reverted
    confidence: number;
    timestamp: string;
    project: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;         // SUPERCEDES | DEPRECATED | REVERTED
  }>;
}
```

---

## Governance Rules

- **No direct Bolt access** from UI — ever.
- **Scope all queries** by `project` + `status: approved`.
- **Log every graph view** as an audit event in the raw trace store.
- **Agents** use the same retrieval API — not a separate database connection.
- Raw traces are **never** surfaced in the graph view.

---

## Next Actions

- [ ] Deploy NeoDash locally (`docker run neo4jlabs/neodash`)
- [ ] Define `GET /api/graph` endpoint in retrieval layer
- [ ] Build Phase 2 React graph component (NVL preferred)
- [ ] Add auth middleware (JWT) to graph API route
- [ ] Wire graph view events to audit log
