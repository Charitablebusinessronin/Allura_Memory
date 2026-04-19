<!-- Context: development/frontend | Priority: critical | Version: 2.0 | Updated: 2026-04-19 -->

# Frontend Development Navigation

**Purpose**: Client-side development patterns for Allura Memory

**Status**: ✅ Active - Next.js 15 + React 19 + shadcn/ui

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Next.js 15 | App Router, Server Components default |
| **UI** | React 19 | Server Components preferred |
| **Styling** | Tailwind CSS | Custom theme in `tailwind.config.ts` |
| **Components** | shadcn/ui | `npx shadcn add <component>` |
| **State** | Zustand | Client state in `src/stores/` |
| **Forms** | React Hook Form + Zod | Validation at boundaries |

---

## Quick Routes

| Task | Path |
|------|------|
| **When to delegate** | `when-to-delegate.md` |
| **React patterns** | `react/react-patterns.md` |
| **Server actions** | `src/server/` |
| **Components** | `src/components/` |
| **Stores** | `src/stores/` |

---

## Allura-Specific Patterns

### Server vs Client Components
- **Default**: Server Components (no directive needed)
- **Client only**: Add `"use client"` for interactivity
- **Server actions**: `src/server/` for data mutations

### State Management
- **Server state**: Server actions + revalidation
- **Client state**: Zustand stores
- **URL state**: Next.js useSearchParams

### Component Architecture
- **shadcn/ui**: Base components via CLI
- **Custom**: Compose shadcn primitives
- **Forms**: RHF + Zod validation

---

## Structure

```
frontend/
├── navigation.md              # This file
├── when-to-delegate.md        # Agent delegation guide
└── react/
    ├── navigation.md          # React-specific nav
    └── react-patterns.md        # Hooks, patterns
```

---

## Related Context

- **Backend** → `../backend/navigation.md`
- **Principles** → `../principles/clean-code.md`
- **Core Standards** → `../../core/standards/code-quality.md`
