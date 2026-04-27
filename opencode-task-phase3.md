# OpenCode Task: Allura Dashboard — Phase 3–6 (Remaining Screens + Verification)

## Branch: feature/real-data-dashboard-25
## Current State
- Phase 1–2 complete: Brand tokens applied, IBM Plex Sans installed, 20 component files, monolith deleted
- Typecheck and build pass
- Remaining skeletal screens need brand polish and real-data verification

## Phase 3: Polish Remaining Screens

### 3a. Graph View (`src/app/(main)/dashboard/graph/page.tsx`)
Current: 13 lines, just loads graph and shows `GraphSummary`.

**Add node detail panel:**
- Create a `NodeDetailPanel` component in `src/components/dashboard/NodeDetailPanel.tsx`
- When a node is clicked, show:
  - Node label, type, metadata
  - "Connected To" list (edges where this node is source or target)
  - Relationship labels (performed, resulted_in, generated, applies_to, connected_to, caused_by)
- Wire click handler in `GraphSummary` to select node
- Pass selected node + edges to `NodeDetailPanel`
- Use brand tokens (no hardcoded hexes)
- IBM Plex Sans font

**Rules:**
- No fake edges — only show edges from real API response
- Empty state: "Select a node to see its relationships."
- No mock relationship data

### 3b. Evidence Detail (`src/app/(main)/dashboard/evidence/[id]/page.tsx`)
Current: 21 lines, raw log + metadata.

**Polish:**
- Apply IBM Plex Sans
- Replace hardcoded layout colors with brand tokens
- Add "Related Memory" link if `relatedMemoryId` exists
- Add "Related Insight" link if `relatedInsightId` exists
- Add confidence display if present in metadata
- Format timestamp with relative time (e.g., "2 hours ago")
- Show metadata as key-value pairs (not just dl), including nested objects
- Honest fallback: if `rawLog` is JSON, pretty-print it; if empty, show "No raw log available."

### 3c. Evidence List (`src/app/(main)/dashboard/evidence/page.tsx`)
Current: 13 lines.

**Polish:**
- Apply IBM Plex Sans
- Add Tabs: All / Traces / Memory-derived
- Add SearchInput for filtering
- Use brand tokens

### 3d. Agents (`src/app/(main)/dashboard/agents/page.tsx`)
Current: 14 lines.

**Polish:**
- Apply IBM Plex Sans
- Load real agent data from `/api/memory/graph` (filter nodes where type === "agent")
- Show agent cards with: name, type, connected memories count, recent activity
- Use brand tokens
- Empty state: "No agents found in graph."

### 3e. Projects (`src/app/(main)/dashboard/projects/page.tsx`)
Current: 14 lines.

**Polish:**
- Apply IBM Plex Sans
- Load real project data from `/api/memory/graph` (filter nodes where type === "project")
- Show project cards with: name, connected memories count, insights count
- Use brand tokens
- Empty state: "No projects found in graph."

### 3f. Settings (`src/app/(main)/dashboard/settings/page.tsx`)
Current: 6 lines.

**Polish:**
- Apply IBM Plex Sans
- Show current group_id (allura-system)
- Show current user/display name
- Show theme preset selector (if available)
- Show system version/build info
- Use brand tokens

### 3g. Curator (`src/app/(main)/dashboard/curator/page.tsx`)
Current: 5 lines.

**Polish:**
- Apply IBM Plex Sans
- Load curator proposals via `loadInsights("pending")`
- Show pending proposals with InsightCard + InsightActions
- Show stats: pending count, approved count, rejected count
- Use brand tokens

### 3h. Traces (`src/app/(main)/dashboard/traces/page.tsx`)
Current: 10 lines.

**Polish:**
- Apply IBM Plex Sans
- Load traces via `loadEvidence()`
- Show trace cards with timestamp, source, agent
- Use brand tokens

## Phase 4: Real Data Rules Verification

Verify these rules are enforced:
- [ ] Every memory read includes `group_id=allura-system` — check `src/lib/dashboard/api.ts`
- [ ] Graph endpoint is read-only — check `src/app/api/memory/graph/route.ts`
- [ ] No mock data in any dashboard page
- [ ] No fake graph edges
- [ ] No fake approve/reject success
- [ ] Empty API response shows empty state
- [ ] Failed API response shows error state
- [ ] Partial/degraded response shows warning state

## Phase 5: Screen-Specific Verification

For each screen, verify:
- [ ] `/dashboard` — real metrics, real activity, real system status
- [ ] `/dashboard/memories` — real memories, tabs filter correctly, search works
- [ ] `/dashboard/insights` — real insights, tabs (Queue/Approved/Rejected/Superseded), approve/reject works
- [ ] `/dashboard/graph` — real nodes/edges, node detail panel shows real relationships
- [ ] `/dashboard/evidence` — real evidence, tabs/search work
- [ ] `/dashboard/evidence/[id]` — real detail, metadata honest, no fabricated links
- [ ] `/dashboard/agents` — real agent nodes from graph
- [ ] `/dashboard/projects` — real project nodes from graph
- [ ] `/dashboard/curator` — real pending proposals
- [ ] `/dashboard/settings` — honest system info

## Phase 6: Final Verification

Run:
```bash
bun run typecheck
bun run build
```

Fix ALL errors. No warnings from our changes (pre-existing warnings acceptable).

## Constraints
- NO hardcoded hex colors anywhere in dashboard code. Use `brand-tokens.css` custom properties.
- NO mock data. Every screen must use real API calls.
- NO fake relationships in graph.
- Components consume mapped UI contracts only (via mappers.ts).
- Raw API responses stay inside api/query/mapper layers.

## Output
When finished, provide:
1. Which screens were polished and what was added
2. Real data verification results
3. Typecheck and build results
4. Any remaining issues or risks
