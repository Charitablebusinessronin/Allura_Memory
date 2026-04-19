# Dashboard UI Refresh — Design Spec

## Overview
This document captures the design decisions and implementation plan for the Allura Memory dashboard UI refresh, including the new **Curator Memory Explainer** AI feature.

---

## Design Tokens

All tokens are CSS custom properties defined on `:root` and `[data-theme]` selectors.

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--color-bg` | `#0f0e0d` | `#f5f4f0` | Page background |
| `--color-surface` | `#161513` | `#faf9f7` | Card / sidebar surface |
| `--color-surface-2` | `#1c1b19` | `#ffffff` | Hover / elevated surface |
| `--color-primary` | `#4f98a3` | `#01696f` | Accent, links, active states |
| `--color-success` | `#6daa45` | `#437a22` | Healthy status |
| `--color-warning` | `#fdab43` | `#da7101` | Degraded / pending |
| `--color-error` | `#dd6974` | `#a12c7b` | Down / error states |

**Font:** Satoshi via Fontshare CDN — `font-size: var(--text-sm)` (14px base) for all UI.

---

## KPI Card Changes

**Before:** Flat gray cards, small uniform text, no visual hierarchy.

**After:**
- Large dominant value numbers (`clamp(1.75rem, 2vw, 2.25rem)`) with `tabular-nums`
- Color-coded icon badges (teal = memories, gold = approvals, purple = components, green = health)
- Muted metadata line below value for context
- Hover shadow lift

---

## Component Status Table

- Sticky thead with `10px uppercase` column labels
- Row hover background (`--color-surface-2`)
- Inline colored status badges (`.comp-status.healthy / .degraded / .down`)
- Latency column uses `tabular-nums` for alignment

---

## Curator Memory Explainer (New Feature)

### What it is
A new panel on the dashboard that lets users click any memory store and get an AI-generated plain-English explanation of what that memory does and how the Curator agent uses it.

### UI Pattern
- Memory rows are clickable — clicking expands an inline AI explanation box
- Explanation appears with a **typewriter animation** (18ms/char interval)
- Explanation box has a left border accent and teal background tint
- Model tag (`gpt-4o-mini`) shown in header

### Implementation Plan (Next.js)

**1. API Route**
```ts
// app/api/explain-memory/route.ts
import OpenAI from 'openai'

const client = new OpenAI()

export async function POST(req: Request) {
  const { memoryType, memoryName, metadata } = await req.json()

  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    messages: [
      {
        role: 'system',
        content: 'You are an AI assistant explaining memory system components to developers. Be concise, technical but accessible. 2-3 sentences max.'
      },
      {
        role: 'user',
        content: `Explain what the "${memoryName}" (${memoryType}) memory store does and how the Curator agent uses it. Context: ${JSON.stringify(metadata)}`
      }
    ]
  })

  return new Response(stream.toReadableStream())
}
```

**2. React Component**
```tsx
// components/MemoryExplainButton.tsx
'use client'
import { useState } from 'react'

export function MemoryExplainButton({ memoryType, memoryName, metadata }) {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function explain() {
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    setExplanation('')

    const res = await fetch('/api/explain-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memoryType, memoryName, metadata })
    })

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      setExplanation(prev => prev + decoder.decode(value))
    }
    setLoading(false)
  }

  return (
    <div>
      <button onClick={explain} className="explain-btn">
        ✦ {open ? 'Close' : 'Explain'}
      </button>
      {open && (
        <div className="ai-explanation">
          <span className="ai-label">✦ AI EXPLANATION</span>
          <p>{explanation}{loading && <span className="cursor">|</span>}</p>
        </div>
      )}
    </div>
  )
}
```

**3. Environment Variable**
```env
OPENAI_API_KEY=sk-...
```

---

## Empty State: Store Health

Replace "No circuit data" plain text with:
- Icon (radio/signal SVG)
- Label: "No circuit data"
- Sub: "Circuit breaker metrics will appear once traffic flows through the store"

---

## Next Steps

- [ ] Apply token system to `globals.css` as Tailwind CSS variables
- [ ] Implement `MemoryExplainButton` component in Curator page
- [ ] Wire `POST /api/explain-memory` endpoint
- [ ] Replace KPI card components with updated hierarchy
- [ ] Add light/dark mode toggle to topbar
- [ ] Implement sparkline charts in Store Health card (Chart.js or Recharts)
