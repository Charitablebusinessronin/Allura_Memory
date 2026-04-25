# Developer Handoff Guide
> Allura Wireframe System → React/Next.js Implementation

---

## Quick Start

### Phase 1: Foundation (Week 1)

**Priority: CRITICAL**

Build these first — everything else depends on them:

```bash
# 1. Install dependencies
npm install lucide-react clsx tailwind-merge

# 2. Set up Tailwind config with brand tokens
# See: tokens/tailwind.config.js

# 3. Create base components in order:
```

| Order | Component | File | Effort |
|-------|-----------|------|--------|
| 1 | Design Tokens | `styles/tokens.css` | 2h |
| 2 | App Shell (Desktop) | `components/shell/DesktopShell.tsx` | 4h |
| 3 | App Shell (Mobile) | `components/shell/MobileShell.tsx` | 4h |
| 4 | Button | `components/ui/Button.tsx` | 1h |
| 5 | Sidebar Nav Item | `components/nav/SidebarItem.tsx` | 2h |
| 6 | Search Input | `components/ui/SearchInput.tsx` | 1h |

**Stop here and review.** Don't proceed until these 6 are solid.

---

## Component Implementation Guide

### Shell Components

#### DesktopShell

```typescript
// components/shell/DesktopShell.tsx
interface DesktopShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  rightDrawer?: React.ReactNode;
  showDrawer?: boolean;
  onDrawerClose?: () => void;
}

// Usage:
<DesktopShell
  sidebar={<SidebarNav items={navItems} />}
  rightDrawer={<MemoryDetail memory={selectedMemory} />}
  showDrawer={!!selectedMemory}
  onDrawerClose={() => setSelectedMemory(null)}
>
  <OverviewDashboard />
</DesktopShell>
```

**Key Implementation Details:**
- Sidebar: Fixed 240px, flex-shrink-0
- Content: flex-1, min-width-0 (critical for truncation)
- Drawer: Fixed 400px, transform translate-x-full when closed
- Z-index: Sidebar 40, Drawer 50, Backdrop 40

#### MobileShell

```typescript
// components/shell/MobileShell.tsx
interface MobileShellProps {
  children: React.ReactNode;
  topNav?: React.ReactNode;
  bottomAction?: React.ReactNode;
}

// Usage:
<MobileShell
  topNav={<MobileTopBar title="Memories" />}
  bottomAction={<Button>Capture Memory</Button>}
>
  <MemoryList memories={memories} />
</MobileShell>
```

---

### Navigation Components

#### SidebarItem

```typescript
// components/nav/SidebarItem.tsx
interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  isActive?: boolean;
  badge?: number;
}

// Implementation notes:
// - Use next/link for navigation
// - Active state: bg-blue-50, border-r-2 border-blue-600
// - Icon: 20px, text: 14px medium
// - Height: 40px, padding: 12px 16px
```

#### PageHeader

```typescript
// components/layout/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
}

// Layout:
// - Padding: 24px 32px
// - Title: text-2xl font-semibold
// - Actions: flex gap-3, right-aligned
```

---

### Data Display Components

#### StatCard

```typescript
// components/data/StatCard.tsx
interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  explanation?: string;
  variant?: 'default' | 'compact';
}

// Grid layout:
// - Desktop: grid-cols-4
// - Tablet: grid-cols-2
// - Mobile: grid-cols-1
```

#### MemoryRow

```typescript
// components/data/MemoryRow.tsx
interface MemoryRowProps {
  memory: {
    id: string;
    title: string;
    snippet: string;
    type: 'conversation' | 'document' | 'decision';
    source: string;
    timestamp: Date;
    confidence?: number;
  };
  isSelected?: boolean;
  onClick?: () => void;
  onAction?: (action: string) => void;
}

// Critical: min-width-0 on text container for truncation
// Layout: flex gap-3, items-start
// Icon: 40px circle with type color
```

**Truncation Pattern:**
```tsx
<div className="min-w-0 flex-1">
  <h4 className="truncate font-medium">{title}</h4>
  <p className="truncate text-sm text-gray-500">{snippet}</p>
</div>
```

---

### Overlay Components

#### Drawer

```typescript
// components/overlay/Drawer.tsx
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'default' | 'large';
}

// Implementation:
// - Fixed position, right-0, top-0, bottom-0
// - Width: 400px (desktop), 100% (mobile)
// - Transform: translate-x-full when closed
// - Backdrop: fixed inset-0, bg-black/50
// - Animation: 300ms ease-out
```

#### Modal

```typescript
// components/overlay/Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'destructive';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

// Sizes:
// - Small: max-w-md (448px) - confirmations
// - Medium: max-w-lg (512px) - forms
// - Large: max-w-2xl (672px) - complex content
```

---

## Responsive Strategy

### Breakpoint Behaviors

| Component | Desktop (>1024px) | Tablet (768-1024px) | Mobile (<768px) |
|-----------|-------------------|---------------------|-----------------|
| Sidebar | Fixed 240px | Icon-only 64px | Hidden, hamburger menu |
| Content | Fluid, max 1440px | Fluid | Full width, 16px padding |
| Drawer | 400px fixed | 400px fixed | Full screen |
| Grid | 4 cols → 3 cols | 2 cols | 1 col |
| Tables | Full table | Condensed | Card list |
| Graph | Interactive | Interactive | Preview only |

### Mobile Adaptation Rules

**Tables → Cards:**
```tsx
// Desktop: Table row
// Mobile: Card with stacked info

{isMobile ? (
  <MemoryCard memory={memory} />
) : (
  <MemoryRow memory={memory} />
)}
```

**Drawer → Full Screen:**
```tsx
// Use same component, different styling
<Drawer
  className={cn(
    "fixed inset-y-0 right-0",
    isMobile ? "w-full" : "w-[400px]"
  )}
/>
```

---

## State Management Patterns

### Selected Memory Pattern

```typescript
// Global state (Zustand / Redux)
interface MemoryState {
  selectedMemoryId: string | null;
  selectedMemory: Memory | null;
  isDrawerOpen: boolean;
}

// Component usage:
function MemoryList() {
  const { selectedMemoryId, setSelectedMemory } = useMemoryStore();
  
  return (
    <>
      {memories.map(memory => (
        <MemoryRow
          key={memory.id}
          memory={memory}
          isSelected={memory.id === selectedMemoryId}
          onClick={() => setSelectedMemory(memory.id)}
        />
      ))}
      
      <Drawer isOpen={!!selectedMemoryId}>
        <MemoryDetail memoryId={selectedMemoryId} />
      </Drawer>
    </>
  );
}
```

### Filter Pattern

```typescript
interface FilterState {
  searchQuery: string;
  types: MemoryType[];
  dateRange: DateRange | null;
  sortBy: SortOption;
}

// URL sync for shareable filters
const filters = useQueryState<FilterState>('filters');
```

---

## Content Handling

### Realistic Content Rules

**Never use:**
- "Lorem ipsum"
- "Title here"
- "Description text"
- Single-line content examples

**Always use:**
- Real memory titles: "User prefers concise, technical answers about AI infrastructure"
- Realistic timestamps: "2 hours ago", "May 21, 2024"
- Varied content lengths
- Edge cases: long names, missing data, errors

### Truncation Rules

| Element | Max Lines | Truncation |
|---------|-----------|------------|
| Memory title | 1 line | ellipsis |
| Memory snippet | 2 lines | line-clamp-2 |
| Page title | 1 line | ellipsis |
| Card description | 3 lines | line-clamp-3 |
| User name | 1 line | ellipsis |

### Empty States

Every list needs an empty state:

```tsx
{memories.length === 0 ? (
  <EmptyState
    icon={SearchX}
    title="No memories found"
    description="Try adjusting your filters or search query"
    action={<Button onClick={clearFilters}>Clear Filters</Button>}
  />
) : (
  <MemoryList memories={memories} />
)}
```

---

## Build Order

### Week 1: Foundation

- [ ] Design tokens setup
- [ ] Tailwind config
- [ ] Desktop shell
- [ ] Mobile shell
- [ ] Button component
- [ ] Sidebar navigation
- [ ] Search input

### Week 2: Core Components

- [ ] Stat cards
- [ ] Memory row
- [ ] Page header
- [ ] Filter chips
- [ ] Overview dashboard (template)

### Week 3: Detail Views

- [ ] Drawer component
- [ ] Memory detail view
- [ ] Decision row
- [ ] Agent card
- [ ] Tabs component

### Week 4: Advanced Features

- [ ] Graph explorer
- [ ] Timeline component
- [ ] Provenance view
- [ ] Modal system
- [ ] Toast notifications

### Week 5: Polish

- [ ] Empty states
- [ ] Loading skeletons
- [ ] Error states
- [ ] Mobile adaptations
- [ ] Performance optimization

---

## Testing Checklist

### Visual QA

- [ ] All spacing uses token scale (no arbitrary values)
- [ ] All colors use semantic tokens
- [ ] Typography follows type scale
- [ ] Shadows consistent across components
- [ ] Border radius consistent

### Responsive QA

- [ ] Test at 320px (minimum mobile)
- [ ] Test at 768px (tablet)
- [ ] Test at 1024px (small desktop)
- [ ] Test at 1440px (large desktop)
- [ ] Sidebar collapses correctly
- [ ] Drawer works on all sizes
- [ ] Tables transform to cards on mobile

### Interaction QA

- [ ] All buttons have hover states
- [ ] All interactive elements have focus rings
- [ ] Loading states work
- [ ] Empty states display correctly
- [ ] Error states display correctly
- [ ] Keyboard navigation works
- [ ] Screen reader labels present

### Content QA

- [ ] Long titles truncate correctly
- [ ] Missing data shows placeholder
- [ ] Dates format consistently
- [ ] Numbers format with commas
- [ ] Search highlights matching text

---

## Common Pitfalls

### ❌ Don't

1. **Don't** build screens independently
   - Bad: Copy-pasting header code to every page
   - Good: Use shell component, compose content

2. **Don't** use arbitrary Tailwind values
   - Bad: `w-[387px]`
   - Good: `w-96` (384px) or custom token

3. **Don't** hardcode colors
   - Bad: `text-blue-600`
   - Good: `text-brand-primary`

4. **Don't** forget loading states
   - Bad: Blank screen while fetching
   - Good: Skeleton or spinner

5. **Don't** skip empty states
   - Bad: Empty list = blank area
   - Good: Helpful empty state with action

### ✅ Do

1. **Do** use composition patterns
   ```tsx
   <PageShell>
     <PageHeader title="Memories" />
     <MemoryList />
   </PageShell>
   ```

2. **Do** handle edge cases
   - Empty arrays
   - Network errors
   - Loading states
   - Permission denied

3. **Do** test with realistic data
   - Long names
   - Special characters
   - Missing optional fields

4. **Do** document component props
   ```tsx
   interface ButtonProps {
     /** Visual variant */
     variant?: 'primary' | 'secondary' | 'ghost';
     /** Show loading spinner */
     isLoading?: boolean;
     /** Disable interactions */
     isDisabled?: boolean;
   }
   ```

---

## Resources

### Design Files
- Figma: https://www.figma.com/design/PAQpnxQZENNwbhmk5qxOjR/Untitled
- Wireframes: `assets/images/allura-wireframe-system.png`

### Documentation
- Component Inventory: `component-inventory.md`
- Design Foundations: `foundations.md`
- Brand Kit: `../../04_brand-kit-builder_brand-kit.md`

### Tokens
- CSS Variables: `../design-tokens/tokens.css`
- JSON Tokens: `../design-tokens/tokens.json`

---

## Questions?

**Slack:** #allura-dev  
**Design:** @eva-lotta-lamm (Figma)  
**Tech Lead:** [Your name here]

**Remember:** Build the shell first. Then the primitives. Then compose pages from those primitives. Do not code each screen independently.
