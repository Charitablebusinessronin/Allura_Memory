# Frontend Tightening Implementation Plan

**Goal:** Tighten Allura Memory frontend to match brand canon (IBM Plex Sans, 8px grid, Allura tokens), remove unauthorized `--allura-gold` usage, align dashboard/Graph View, and add comprehensive validation commands.

**Architecture:**  
- Token Audit: Replace hardcoded hex values in components with `var(--allura-*)` CSS custom properties from `brand-tokens.css`  
- Dashboard Polish: Standardize `/dashboard/graph` and `/dashboard/memory-explorer` to use unified token system  
- Graph View API: Wire existing `/api/memory/graph` route to frontend with live Neo4j data  
- Memory Viewer Alignment: Ensure `/dashboard/memory-explorer` uses same data model as `/dashboard/graph`  
- Validation Commands: Add Playwright/E2E commands for token compliance and layout validation  

**Tech Stack:** Next.js App Router + Tailwind CSS + ForceGraph2D + Allura tokens (v2.0)  
**Spec:** `.opencode/agent/subagents/code/woz.md`, `src/lib/brand/allura.ts`, `src/styles/brand-tokens.css`  
**Requirements:** This plan satisfies Token Authority, Blueprint brand canon, Graph View UI scope, and Memory Viewer alignment.

---

## Prerequisites

1. **PostgreSQL & Neo4j running** — verify with `bun run mcp/memory-server.ts` and `neo4j` container  
2. **Env vars loaded** — `POSTGRES_PASSWORD`, `NEO4J_PASSWORD`  
3. **Git branch** — create `feat/frontend-tightening-2026-05` before beginning  

---

### Task 1: Token Audit — Replace Hardcoded Hex Colors

**Files:**
- Modify: `src/app/(main)/dashboard/memory-explorer/page.tsx`
- Modify: `src/app/(main)/dashboard/graph/page.tsx`
- Modify: `src/components/memory-explorer/*.tsx` (all 6 components)
- Modify: `src/components/dashboard/*.tsx` (all 28 components)
- Create: `src/lib/tokens/token-audit-report.md`

- [ ] **Step 1: Scan for hardcoded hex**

Run: `rg "#[0-9a-fA-F]{6}" src/app/(main)/dashboard/memory-explorer/page.tsx src/app/(main)/dashboard/graph/page.tsx src/components/memory-explorer src/components/dashboard`
Expected: Returns all raw hex occurrences (expect ~20 matches)

- [ ] **Step 2: Replace `NODE_COLORS_LIGHT`/`NODE_COLORS_DARK` with Allura tokens**

In `memory-explorer/page.tsx`, replace:
```typescript
const NODE_COLORS_LIGHT: Record<string, string> = {
  memory:   "#1D4ED8",  // blue
  insight:  "#157A44",  // green
  evidence: "#C89B3C",  // gold
  agent:    "#FF5A2E",  // orange
  project:  "#157A44",  // green
  system:   "#111827",  // charcoal
}
```
With:
```typescript
const NODE_COLORS_LIGHT: Record<string, string> = {
  memory:   "var(--allura-blue)",
  insight:  "var(--allura-green)",
  evidence: "var(--allura-gold)",
  agent:    "var(--allura-orange)",
  project:  "var(--allura-green)",
  system:   "var(--allura-charcoal)",
}
```
And `NODE_COLORS_DARK` similarly to dark-mode Allura tokens.

- [ ] **Step 3: Update edge colors to use CSS vars**

In both pages, replace:
```typescript
linkColor={() => "rgba(107,114,128,0.35)"}
```
With:
```typescript
linkColor={() => {
  const defaultHex = "var(--allura-gray-500)".replace("var(--", "")?.replace(")", "")
  const style = getComputedStyle(document.documentElement)
  const hex = style.getPropertyValue('--allura-gray-500').trim()
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1,3), 16)
    const g = parseInt(hex.slice(3,5), 16)
    const b = parseInt(hex.slice(5,7), 16)
    return `rgba(${r},${g},${b},0.6)`
  }
  return 'rgba(107,114,128,0.6)'
}}
```

- [ ] **Step 4: Replace `getResolvedColor` calls with direct CSS vars**

In `graph/page.tsx`, replace calls like:
```typescript
getResolvedColor("surfaceDefault")
getResolvedColor("gold")
getResolvedColor("textSecondary")
```
With:
```typescript
getComputedStyle(document.documentElement).getPropertyValue('--allura-white').trim()
getComputedStyle(document.documentElement).getPropertyValue('--allura-gold').trim()
getComputedStyle(document.documentElement).getPropertyValue('--allura-text-2').trim()
```

- [ ] **Step 5: Audit memory-explorer component files**

Run same hex scan on all 6 components in `src/components/memory-explorer/` and update:
- `RecentConnectionsTable.tsx`
- `KnowledgeLayersPanel.tsx`
- `ExplorerStatusBar.tsx`
- `SystemHealthPanel.tsx`
- `ReviewQueuePanel.tsx`
- `MemoryUsagePanel.tsx`

**Test:** No raw `#[0-9a-fA-F]{6}` regex in component code.

- [ ] **Step 6: Generate audit report**

Write `src/lib/tokens/token-audit-report.md` with:
- Total files modified
- Hardcoded hex count before/after
- Token compliance score (%)

---

### Task 2: Token Compliance E2E Test -- Test File Write

**Files:**
- Create: `tests/e2e/token-compliance.spec.ts`

- [ ] **Step 1: Create Playwright test file**

Write `tests/e2e/token-compliance.spec.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { browser_navigate, browser_evaluate } from "@mcp-docker/playwright";

describe("Token Compliance", () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
  });

  it("should not contain hardcoded hex in component classes", async () => {
    const DASHBOARD_URL = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;
    await browser_navigate({ url: DASHBOARD_URL });

    const hexColors = await browser_evaluate({
      script: `
        const styleSheets = Array.from(document.styleSheets);
        let foundHex = false;
        for (const sheet of styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.cssText && /#[0-9a-fA-F]{6}/.test(rule.cssText)) {
                foundHex = true;
                break;
              }
            }
          } catch {}
        }
        return foundHex;
      `
    });

    expect(hexColors).toBe(false);
  });

  it("should use allura-* CSS custom properties", async () => {
    await browser_navigate({ url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/graph` });

    const hasAlluraTokens = await browser_evaluate({
      script: `
        const root = document.documentElement;
        const vars = getComputedStyle(root);
        const alluraVars = [];
        for (const v of vars) {
          if (v.startsWith('--allura')) alluraVars.push(v);
        }
        return alluraVars.length > 10;
      `
    });

    expect(hasAlluraTokens).toBe(true);
  });
});
```

- [ ] **Step 2: Run token compliance test**

Run: `bun vitest run tests/e2e/token-compliance.spec.ts`
Expected: PASS (after Task 1 fixes are applied)

---

### Task 3: Graph View Route/API Wiring

**Files:**
- Modify: `src/app/(main)/dashboard/graph/page.tsx`
- Modify: `src/lib/dashboard/queries.ts`
- Add: Test: `tests/e2e/graph-view-e2e.spec.ts`

- [ ] **Step 1: Verify `/api/memory/graph` route exists**

Confirm `src/app/api/memory/graph/route.ts` returns:
- `GET /api/memory/graph?group_id=allura-system` → `nodes[]`, `edges[]`, `total_edges`

- [ ] **Step 2: Ensure graph data flows to ForceGraph2D**

Edit `src/lib/dashboard/queries.ts`:
```typescript
export async function loadGraph(): Promise<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[]; totalEdges?: number }>> {
  try {
    const result = await getGraph();
    const mapped = mapGraph(result.data);
    if (mapped && mapped.nodes && mapped.edges) {
      return { data: mapped, error: null, degraded: result.degraded, warnings: warningFrom("graph", result.warning) };
    } else {
      return failure(new Error("Graph response missing nodes or edges"));
    }
  } catch (error) {
    return failure(error);
  }
}
```

- [ ] **Step 3: Add live Neo4j test**

Write `tests/e2e/graph-view-e2e.spec.ts`:
```typescript
describe("Graph View Live Data", () => {
  it("should load graph data from Neo4j", async () => {
    const graphData = await browser_evaluate({
      script: "window.__GRAPH_DATA__"
    });
    expect(graphData.nodes.length).toBeGreaterThan(0);
    expect(graphData.edges.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Add fallback data guard**

In `graph/page.tsx`, add:
```typescript
const [nodes, setNodes] = useState<GraphNode[]>([]);
useEffect(() => {
  loadGraph()
    .then(result => result.data && setNodes(result.data.nodes))
    .catch(() => console.warn("Graph failed, using fallback"));
}, []);
```

---

### Task 4: Memory Explorer Alignment

**Files:**
- Modify: `src/app/(main)/dashboard/memory-explorer/page.tsx`
- Modify: `src/lib/dashboard/mappers.ts`

- [ ] **Step 1: Remove duplicate fallback data**

Remove the `FALLBACK_NODES` and `FALLBACK_EDGES` arrays from `memory-explorer/page.tsx`. Use `loadGraph()` directly for all nodes/edges.

- [ ] **Step 2: Unify color mapping**

Replace `nodeColor()` function with:
```typescript
function nodeColor(type: string) {
  const colors: Record<string, string> = {
    memory: "var(--allura-blue)",
    insight: "var(--allura-green)",
    evidence: "var(--allura-gold)",
    agent: "var(--allura-orange)",
    project: "var(--allura-green)",
    system: "var(--allura-charcoal)",
  };
  return colors[type] || "var(--allura-gray-500)";
}
```

- [ ] **Step 3: Reuse graph API**

Import `loadGraph` from `@/lib/dashboard/queries`:
```typescript
import { loadGraph } from "@/lib/dashboard/queries";
const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
useEffect(() => {
  loadGraph().then(result => {
    if (result.data) setGraphData({ nodes: result.data.nodes, edges: result.data.edges });
  });
}, []);
```

---

### Task 5: Blueprint Brand Canon Fixes

**Files:**
- Modify: `src/styles/brand-tokens.css`
- Delete: Unauthorized `--allura-gold` references in component code

- [ ] **Step 1: Verify `brand-tokens.css` canonical tokens**

Run: `rg "allura-gold" src/styles/brand-tokens.css`  
Expected: Only `--allura-gold` (canonical), no `--allura-gold-hover` duplicates or invalid variants.

- [ ] **Step 2: Add missing semantic aliases**

In `src/styles/brand-tokens.css`, add:
```css
/* ── Dashboard Semantic Aliases ── */
--dashboard-text-primary:   var(--allura-charcoal);
--dashboard-text-secondary: var(--allura-gray-500);
--dashboard-text-muted:     var(--allura-gray-400);
--dashboard-surface:        var(--allura-white);
--dashboard-surface-alt:    var(--allura-cream);
--dashboard-border:         var(--allura-gray-200);
--dashboard-accent:         var(--allura-orange);
--dashboard-success:        var(--allura-green);
--dashboard-warning:        var(--allura-orange);
--dashboard-danger:         #DC2626;
```

- [ ] **Step 3: Validate IBM Plex Sans font loading**

In `src/app/layout.tsx`, ensure:
```tsx
<Link rel="preconnect" href="https://fonts.googleapis.com" />
<Link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
```

---

### Task 6: Dashboard Polish — Layout & 8px Grid

**Files:**
- Modify: `src/app/(main)/dashboard/layout.tsx`
- Modify: `src/app/(main)/dashboard/_components/**/*.tsx`

- [ ] **Step 1: Audit all spacing**

Search for non-8px multiples:
```bash
rg "gap-[0-9]\d" src/app/\(main\)/dashboard
rg "p-[0-9]\d" src/app/\(main\)/dashboard
rg "m-[0-9]\d" src/app/\(main\)/dashboard
```
Fix any that aren't multiples of 8 (`p-2`, `gap-2`, `m-2`, etc.)

- [ ] **Step 2: Enforce 44px minimum touch targets**

In `src/app/(main)/dashboard/_components/**/*.tsx`, verify buttons/focusable elements:
- `min-h-[44px]` on interactive elements
- `min-w-[44px]` side-by-side buttons

- [ ] **Step 3: Add responsive breakpoint tests**

Write `tests/e2e/responsive-breakpoints.spec.ts`:
```typescript
it("should render correctly at 320px", async () => {
  await browser_evaluate({ script: "window.resizeTo(320, 568)" });
  await browser_navigate({ url: DASHBOARD_URL });
  await browser_take_screenshot({ filename: "bp-320.png" });
});

it("should render correctly at 1024px", async () => {
  await browser_evaluate({ script: "window.resizeTo(1024, 768)" });
  await browser_navigate({ url: DASHBOARD_URL });
  await browser_take_screenshot({ filename: "bp-1024.png" });
});
```

---

### Task 7: Validation Commands

**Files:**
- Create: `src/lib/validation/validate-tokens.ts`
- Create: `tests/e2e/validation.spec.ts`

- [ ] **Step 1: Create token validation utility**

Write `src/lib/validation/validate-tokens.ts`:
```typescript
export function validateTokenUsage(code: string): { compliant: boolean; violations: string[] } {
  const hexPattern = /#[0-9a-fA-F]{6}/g;
  const rawHexes = code.match(hexPattern) ?? [];
  const violations: string[] = [];
  
  rawHexes.forEach(hex => violations.push(`Hardcoded hex found: ${hex}`));
  
  return { compliant: rawHexes.length === 0, violations };
}
```

- [ ] **Step 2: Add `VV` validation command**

In `.opencode/command/vv`, add:
```bash
#!/usr/bin/env bash
# VV: Validate Token Compliance
echo "🔍 Scanning for hardcoded hex..."
if grep -r "#[0-9a-fA-F]\{6\}" src/app src/components --include="*.tsx" 2>/dev/null; then
  echo "❌ Hardcoded hex found — run VT to audit"
  exit 1
fi
echo "✅ Token compliance PASS"
```

Make executable: `chmod +x .opencode/command/vv`.

- [ ] **Step 3: Add E2E validation test**

Write `tests/e2e/validation.spec.ts`:
```typescript
describe("Frontend Validation", () => {
  it("should pass token compliance check", async () => {
    const result = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ready`);
    expect(result.status).toBe(200);
  });

  it("should load without console errors", async () => {
    await browser_navigate({ url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` });
    const errors = await browser_console_messages({ level: "error" });
    expect(errors.length).toBe(0);
  });
});
```

---

### Task 8: Documentation & Sign-off

**Files:**
- Modify: `docs/allura/TECHNICAL-DEBT.md`
- Modify: `docs/allura/BUILD-CHECKLIST.md`
- Add: `docs/superpowers/plans/2026-05-05-frontend-tightening-AUDIT.md`

- [ ] **Step 1: Record token audit results**

Write audit log to `docs/superpowers/plans/2026-05-05-frontend-tightening-AUDIT.md`:
- Token compliance score: __%  
- Files modified: __  
- Components standardized: __  
- Breaks introduced: __  

- [ ] **Step 2: Update Technical Debt register**

Add entry to `docs/allura/TECHNICAL-DEBT.md`:
```markdown
## TD-008: Token Authority Compliance (RESOLVED 2026-05-05)
- **Original**: Raw hex colors throughout dashboard components  
- **Resolution**: Replaced all hex with `var(--allura-*)` CSS custom properties  
- **Verification**: E2E test `tests/e2e/token-compliance.spec.ts`  
- **Impact**: Brand consistency, theme-safe, WCAG-ready  
```

- [ ] **Step 3: Commit all changes**

Run: `git add -A && git commit -m "feat: frontend tightening — token audit, graph wiring, validation commands"`

---

## Testing Checklist

| Command | Expected |
|---------|----------|
| `bun run dev` | Dev server starts on port 3100 |
| `bun vitest run tests/e2e/token-compliance.spec.ts` | PASS |
| `bun vitest run src/lib/neo4j/agent-nodes.test.ts` | PASS |
| `bun run build` | Build succeeds, no warnings |
| `bun run lint` | No errors, no warnings |
| `pnpm exec playwright test tests/e2e/` | All visual tests pass (40px diff threshold) |
| `curl http://localhost:3100/dashboard/graph` | Returns HTML with ForceGraph2D |
| `curl http://localhost:3100/api/memory/graph?group_id=allura-system` | Returns `nodes: [{id,label,type}]`, `edges: [{source,target}]` |

**Signature:**  
Implementation completed by **Woz (builder)**.  
Brooks (architect) sign-off required before PR merge.  
Pike (interface) UI review required for consistency.

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| ForceGraph2D re-renders on filter toggles | Debounce filter state updates, memoize graphData |
| CSS var fallback breaks on SSR | Use `getComputedStyle` only in browser, hardcoded fallbacks for SSR |
| Token audit missing nested component files | Run `rg` recursively on `src/components` before Task 2 |

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-05-frontend-tightening.md`.**  
Execute with `executing-plans` (inline) or `subagent-driven-development` (recommended for parallel task dispatch).
