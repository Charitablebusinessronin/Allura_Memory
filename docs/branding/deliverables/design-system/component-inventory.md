# Allura Component Inventory
> Design System v1.0 | Prepared for Developer Handoff
> Source: Figma Wireframe System (PAQpnxQZENNwbhmk5qxOjR)

---

## 1. Product Shells (Layout Patterns)

### Desktop App Shell
**Pattern ID:** `shell/desktop`

```
┌─────────────────────────────────────────────────────────┐
│ [Top Bar: Logo | Search | Utilities | Avatar]          │  64px
├──────────┬──────────────────────────────────────────────┤
│          │ [Page Header: Title | Actions]              │
│ Sidebar  ├──────────────────────────────────────────────┤
│  240px   │                                              │
│          │ [Content Canvas]                             │
│ Nav      │                                              │
│ Items    │  Cards, Lists, Tables, Graphs               │
│          │                                              │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│ [Optional: Right Detail Drawer - 400px width]          │
└─────────────────────────────────────────────────────────┘
```

**Structure:**
- **Top Bar:** Fixed height 64px, z-index 100
- **Sidebar:** Fixed width 240px, collapsible to 64px (icon-only)
- **Content Area:** Fluid, max-width 1440px, centered
- **Right Drawer:** Fixed width 400px, slides from right, overlay with backdrop

**Responsive Behavior:**
- Tablet (< 1024px): Sidebar collapses to icon-only
- Mobile (< 768px): Sidebar becomes bottom sheet or hamburger menu

---

### Mobile App Shell
**Pattern ID:** `shell/mobile`

```
┌─────────────────────────┐
│ [Top Nav: Back | Title] │  56px
├─────────────────────────┤
│                         │
│ [Content Stack]         │
│                         │
│ Scrollable              │
│                         │
│                         │
├─────────────────────────┤
│ [Bottom Action Bar]     │  64px
└─────────────────────────┘
```

**Structure:**
- **Top Nav:** Fixed height 56px, safe area aware
- **Content:** Scrollable, full-width, padding 16px horizontal
- **Bottom Action:** Fixed height 64px, safe area padding

---

## 2. Navigation Components

### Sidebar Nav Item
**Component ID:** `nav/sidebar-item`

| Property | Value | Notes |
|----------|-------|-------|
| Height | 40px | Single line |
| Padding | 12px 16px | Left icon + label |
| Icon Size | 20px | Lucide icons |
| Font | 14px / 500 | Inter Medium |
| Border Radius | 8px | Hover/active state |

**Variants:**
- `default` - Inactive state
- `active` - Current page, filled background
- `hover` - Light background tint
- `collapsed` - Icon only, centered

**States:**
```
Default:    bg-transparent, text-gray-600
Hover:      bg-gray-100, text-gray-900
Active:     bg-blue-50, text-blue-600, border-r-2 border-blue-600
Disabled:   opacity-50, cursor-not-allowed
```

---

### Top Utility Bar
**Component ID:** `nav/top-bar`

**Elements:**
- Global Search Input (flex-grow)
- Notification Icon Button
- Settings Icon Button
- User Avatar (40px circle)

**Specs:**
- Height: 64px
- Background: white
- Border Bottom: 1px solid gray-200
- Shadow: none (flat)

---

### Page Header
**Component ID:** `layout/page-header`

**Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb (optional)                                    │
│ Title                           [Primary] [Secondary]   │
│ Subtitle / Description                                   │
└─────────────────────────────────────────────────────────┘
```

**Specs:**
- Padding: 24px 32px
- Title: 24px / 600 / Inter
- Subtitle: 14px / 400 / gray-500
- Actions: Right-aligned, gap 12px

---

## 3. Data Display Components

### Stat Card
**Component ID:** `data/stat-card`

**Structure:**
```
┌─────────────────────────┐
│ Label                   │  12px / 500 / gray-500
│                         │
│ 12,458                  │  32px / 700 / gray-900
│ ▲ 8.5% vs last week     │  12px / trend color
└─────────────────────────┘
```

**Specs:**
- Min Width: 200px
- Padding: 20px
- Background: white
- Border: 1px solid gray-200
- Border Radius: 12px
- Shadow: sm

**Variants:**
- `default` - Standard metric
- `with-trend` - Includes trend indicator
- `with-explanation` - Adds helper text
- `compact` - Reduced padding for dense layouts

**Trend Colors:**
- Positive: green-600
- Negative: red-600
- Neutral: gray-500

---

### Memory Row
**Component ID:** `data/memory-row`

**Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ [Icon]  Title of Memory                    [Badge] [→] │
│         Snippet of content...                           │
│         Source • Type • Timestamp                       │
└─────────────────────────────────────────────────────────┘
```

**Specs:**
- Height: Auto (min 72px)
- Padding: 16px
- Gap: 12px
- Icon: 40px circle, colored background
- Border Bottom: 1px solid gray-100

**Variants:**
- `default` - Standard list item
- `hover` - Background tint on hover
- `selected` - Blue left border, light blue background
- `with-badge` - Shows status badge
- `with-warning` - Yellow warning indicator
- `with-menu` - Action menu on right

**States:**
```
Default:  bg-white, border-b border-gray-100
Hover:    bg-gray-50
Selected: bg-blue-50, border-l-2 border-blue-500
Active:   bg-gray-100 (on click)
```

---

### Decision Row
**Component ID:** `data/decision-row`

**Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Decision Title                             [Status]       │
│ Type • Rationale summary...                             │
│ Actor • Date                                             │
└─────────────────────────────────────────────────────────┘
```

**Specs:**
- Similar to Memory Row
- Status badge required
- Expandable for full rationale

**Status Variants:**
- `approved` - Green badge
- `pending` - Yellow badge
- `rejected` - Red badge
- `draft` - Gray badge

---

### Agent Card
**Component ID:** `data/agent-card`

**Structure:**
```
┌─────────────────────────┐
│ [Avatar]  Agent Name    │
│           Role          │
│                         │
│ Status: Active          │
│ Last activity: 2m ago     │
│ [Health indicator]      │
└─────────────────────────┘
```

**Specs:**
- Width: 280px
- Padding: 16px
- Avatar: 48px circle
- Border: 1px solid gray-200
- Border Radius: 12px

**Variants:**
- `default` - Standard view
- `active` - Green status indicator
- `paused` - Yellow status indicator
- `inactive` - Gray status indicator

---

### Timeline Item
**Component ID:** `data/timeline-item`

**Structure:**
```
┌─────────────────────────────────────────────────────────┐
│  ●─────── Timestamp                                     │
│  │      Event Label                                     │
│  │      Source • Note                                    │
│  ▼                                                       │
└─────────────────────────────────────────────────────────┘
```

**Specs:**
- Connector line: 2px solid gray-300
- Node: 12px circle, colored by type
- Padding: 16px 16px 16px 32px (indent for line)

**Node Colors:**
- Memory: blue-500
- Decision: purple-500
- Agent: green-500
- System: gray-500

---

### Graph Detail Panel
**Component ID:** `data/graph-detail`

**Structure:**
```
┌─────────────────────────┐
│ Selected Node Title     │
│ Type: Memory            │
│                         │
│ Metadata:               │
│ - Key: Value            │
│ - Key: Value            │
│                         │
│ Relationships:          │
│ [Tag] [Tag] [Tag]       │
│                         │
│ [View Full] [Explore]   │
└─────────────────────────┘
```

**Specs:**
- Width: 320px (desktop), full-width (mobile)
- Background: white
- Border Left: 1px solid gray-200
- Padding: 20px

**Variants:**
- `default` - Node selected
- `empty` - No selection
- `loading` - Skeleton state

---

## 4. Input & Control Components

### Search Input
**Component ID:** `input/search`

**Specs:**
- Height: 40px
- Padding: 0 16px 0 40px (left padding for icon)
- Border: 1px solid gray-300
- Border Radius: 8px
- Background: white
- Icon: Search (20px, gray-400)

**States:**
```
Default:  border-gray-300
Focus:    border-blue-500, ring-2 ring-blue-100
Filled:   show clear button (×)
Loading:  show spinner instead of icon
```

---

### Filter Chip
**Component ID:** `input/filter-chip`

**Specs:**
- Height: 32px
- Padding: 0 12px
- Border: 1px solid gray-300
- Border Radius: 16px (pill)
- Font: 14px / 500

**Variants:**
- `default` - Unselected
- `selected` - Filled background, checkmark icon
- `removable` - Selected with × button
- `disabled` - 50% opacity

**Colors:**
- Default: bg-white, border-gray-300, text-gray-700
- Selected: bg-blue-100, border-blue-300, text-blue-700

---

### Button
**Component ID:** `input/button`

**Specs:**
- Height: 40px (default), 32px (small)
- Padding: 0 16px (0 12px for small)
- Border Radius: 8px
- Font: 14px / 600
- Icon: 16px (optional, left or right)

**Variants:**
- `primary` - Blue background, white text
- `secondary` - White background, blue border
- `ghost` - Transparent, gray text
- `destructive` - Red background, white text

**States:**
```
Default:  as defined by variant
Hover:    darken 10%
Focus:    ring-2 ring-offset-2
Active:   darken 15%, inset shadow
Disabled: opacity-50, cursor-not-allowed
Loading:  spinner replaces text
```

---

### Tabs
**Component ID:** `input/tabs`

**Specs:**
- Height: 40px
- Border Bottom: 1px solid gray-200
- Tab Padding: 0 16px
- Font: 14px / 500
- Active Indicator: 2px bottom border

**States:**
```
Default:  text-gray-500, border-transparent
Hover:    text-gray-700
Active:   text-blue-600, border-b-2 border-blue-600
Disabled: text-gray-300
```

---

### Status Badge
**Component ID:** `data/badge`

**Specs:**
- Height: 20px (small), 24px (default)
- Padding: 0 8px (0 6px for small)
- Border Radius: 4px (small), 6px (default)
- Font: 12px / 600 (small), 12px / 500 (default)

**Variants:**
- `active` - Green background
- `inactive` - Gray background
- `warning` - Yellow background
- `error` - Red background
- `info` - Blue background
- `draft` - Purple background

---

## 5. Overlay Components

### Right Detail Drawer
**Component ID:** `overlay/drawer`

**Specs:**
- Width: 400px (desktop), 100% (mobile)
- Height: 100vh
- Position: Fixed right
- Background: white
- Shadow: -4px 0 24px rgba(0,0,0,0.1)
- Animation: Slide in from right (300ms ease)

**Structure:**
```
┌─────────────────────────┐
│ [×] Title               │  Header: 64px
├─────────────────────────┤
│                         │
│ Content                 │  Scrollable
│                         │
│                         │
├─────────────────────────┤
│ [Secondary] [Primary]   │  Footer: 64px
└─────────────────────────┘
```

**Variants:**
- `memory-detail` - Memory content
- `agent-detail` - Agent information
- `decision-detail` - Decision rationale

**States:**
- `open` - Visible, slide in
- `closed` - Hidden, slide out
- `loading` - Skeleton content
- `empty` - Empty state message
- `error` - Error message with retry

---

### Modal
**Component ID:** `overlay/modal`

**Specs:**
- Max Width: 480px (small), 640px (medium), 800px (large)
- Border Radius: 12px
- Background: white
- Shadow: 0 24px 48px rgba(0,0,0,0.2)
- Backdrop: rgba(0,0,0,0.5), blur(4px)

**Structure:**
```
┌─────────────────────────┐
│ Icon?  Title       [×]  │
├─────────────────────────┤
│                         │
│ Content                 │
│                         │
├─────────────────────────┤
│ [Cancel]   [Confirm]    │
└─────────────────────────┘
```

**Variants:**
- `confirmation` - Confirm/cancel actions
- `destructive` - Red confirm button
- `info` - Single close action
- `form` - Contains form inputs

---

### Toast
**Component ID:** `overlay/toast`

**Specs:**
- Position: Fixed bottom-right (desktop), bottom-center (mobile)
- Width: Auto (max 400px)
- Padding: 16px
- Border Radius: 8px
- Shadow: lg
- Animation: Slide up + fade in

**Variants:**
- `success` - Green left border, checkmark icon
- `error` - Red left border, alert icon
- `warning` - Yellow left border, alert icon
- `info` - Blue left border, info icon

---

## 6. Feedback States

### Empty State
**Component ID:** `feedback/empty`

**Structure:**
```
┌─────────────────────────┐
│                         │
│    [Illustration]       │
│                         │
│    No memories yet      │
│    Get started by...    │
│                         │
│    [Action Button]      │
│                         │
└─────────────────────────┘
```

**Specs:**
- Centered content
- Illustration: 120px
- Title: 18px / 600
- Description: 14px / gray-500
- Max Width: 400px

---

### Loading Skeleton
**Component ID:** `feedback/skeleton`

**Specs:**
- Background: gray-200
- Border Radius: 4px
- Animation: Pulse (shimmer optional)

**Patterns:**
- Text line: height 16px, width 60-100%
- Card: height 120px, full width
- Avatar: 40px circle
- Button: height 40px, width 120px

---

### Error State
**Component ID:** `feedback/error`

**Structure:**
```
┌─────────────────────────┐
│    [Error Icon]         │
│    Something went wrong │
│    Try again or contact │
│                         │
│    [Retry]              │
└─────────────────────────┘
```

---

## Component Priority Matrix

| Priority | Component | Usage Count | Complexity | Build Order |
|----------|-----------|-------------|------------|-------------|
| P0 | shell/desktop | 7 screens | High | 1 |
| P0 | shell/mobile | 4 screens | High | 1 |
| P0 | nav/sidebar-item | 7+ items | Low | 2 |
| P0 | input/button | Everywhere | Low | 2 |
| P0 | input/search | 3+ screens | Low | 2 |
| P1 | data/stat-card | Overview | Low | 3 |
| P1 | data/memory-row | Search + | Medium | 3 |
| P1 | layout/page-header | Every screen | Low | 3 |
| P1 | input/filter-chip | Search | Low | 3 |
| P2 | overlay/drawer | Detail views | High | 4 |
| P2 | data/decision-row | Decisions | Medium | 4 |
| P2 | data/agent-card | Agents | Medium | 4 |
| P2 | input/tabs | Detail views | Low | 4 |
| P3 | data/timeline-item | Provenance | Medium | 5 |
| P3 | data/graph-detail | Graph | Medium | 5 |
| P3 | data/badge | Everywhere | Low | 5 |
| P3 | overlay/modal | Actions | Medium | 5 |
| P4 | feedback/empty | Edge cases | Low | 6 |
| P4 | feedback/skeleton | Loading | Low | 6 |
| P4 | overlay/toast | Actions | Low | 6 |

---

## Naming Convention

```
[category]/[component-name]/[variant]/[state]

Examples:
- nav/sidebar-item/default
- nav/sidebar-item/active
- data/stat-card/with-trend
- input/button/primary/loading
- overlay/drawer/memory-detail/open
```

---

## File Organization

```
components/
├── shell/
│   ├── DesktopShell.tsx
│   └── MobileShell.tsx
├── nav/
│   ├── SidebarItem.tsx
│   ├── TopBar.tsx
│   └── PageHeader.tsx
├── data/
│   ├── StatCard.tsx
│   ├── MemoryRow.tsx
│   ├── DecisionRow.tsx
│   ├── AgentCard.tsx
│   ├── TimelineItem.tsx
│   ├── GraphDetail.tsx
│   └── Badge.tsx
├── input/
│   ├── Button.tsx
│   ├── SearchInput.tsx
│   ├── FilterChip.tsx
│   └── Tabs.tsx
├── overlay/
│   ├── Drawer.tsx
│   ├── Modal.tsx
│   └── Toast.tsx
└── feedback/
    ├── EmptyState.tsx
    ├── Skeleton.tsx
    └── ErrorState.tsx
```
