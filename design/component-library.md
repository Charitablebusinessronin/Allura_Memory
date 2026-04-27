# Component Library Specification

**Deliverable:** 2 — Component Library  
**Status:** ✅ Complete  
**Date:** 2026-04-26  
**Typeface:** IBM Plex Sans (all components)  

---

## Token Reference

All components reference tokens from `tokens.json`. Never use raw hex in implementation.

---

## 1. Button

### 1.1 Variants

| Variant | Use Case | Background | Text | Border |
|---|---|---|---|---|
| **Primary** | Main CTAs, save, confirm | `color.primary.default` | `color.text.inverse` | none |
| **Secondary** | Insight actions, highlights | `color.secondary.default` | `color.text.inverse` | none |
| **Ghost** | Low-emphasis actions, cancel | transparent | `color.primary.default` | `1px solid color.border.default` |
| **Danger** | Delete, reject, destructive | `color.surface.default` | `color.secondary.default` | `1px solid color.secondary.default` |

### 1.2 Sizes

| Size | Height | Padding X | Font Size | Border Radius |
|---|---|---|---|---|
| **sm** | `32px` | `spacing.md` (`12px`) | `typography.fontSize.xs` (`12px`) | `borderRadius.sm` (`4px`) |
| **md** | `40px` | `spacing.lg` (`16px`) | `typography.fontSize.sm` (`14px`) | `borderRadius.md` (`8px`) |
| **lg** | `48px` | `spacing.xl` (`24px`) | `typography.fontSize.base` (`16px`) | `borderRadius.md` (`8px`) |

### 1.3 States

| State | Visual Treatment |
|---|---|
| **Default** | Standard fill, `shadow.sm` on primary/secondary |
| **Hover** | Background shifts to `*.hover` token; `shadow.md`; cursor `pointer` |
| **Active** | `transform: scale(0.98)`; `shadow.sm` |
| **Disabled** | `opacity: 0.5`; `cursor: not-allowed`; no shadow |
| **Loading** | Spinner icon replaces text; `opacity: 0.8`; `cursor: wait`; disabled interaction |
| **Focus** | `2px solid color.primary.default` outline, `outline-offset: 2px` |

### 1.4 Props Interface

```ts
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}
```

---

## 2. SearchBar

### 2.1 Anatomy

```
┌────────────────────────────────────────┐
│ 🔍  Search memories…        ⌘K         │
└────────────────────────────────────────┘
```

| Property | Spec |
|---|---|
| **Height** | `40px` (md) / `36px` (sm) |
| **Background** | `color.surface.default` |
| **Border** | `1px solid color.border.default` |
| **Border radius** | `borderRadius.md` (`8px`) |
| **Padding** | `spacing.md` (`12px`) left (icon), `spacing.lg` (`16px`) right (shortcut) |
| **Placeholder** | `color.text.muted` (`#9CA3AF`), `typography.fontSize.sm` (`14px`) |
| **Text** | `color.text.primary`, `typography.fontSize.sm` |
| **Icon** | Search (`20px`), `color.text.muted` |
| **Shortcut badge** | `⌘K` — `typography.fontSize.xs`, `color.text.muted`, `borderRadius.sm` background `color.surface.muted` |

### 2.2 States

| State | Visual Treatment |
|---|---|
| **Default** | `border: color.border.default`, `shadow.sm` |
| **Hover** | `border: color.border.subtle`, `shadow.md` |
| **Focus** | `border: color.primary.default`, `shadow.md`, `outline: none` |
| **Active (typing)** | `border: color.primary.default` |
| **Has value** | Clear button (`×`) appears right side |

### 2.3 Keyboard Shortcut
- `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux) focuses input
- `Esc` clears input and blurs

### 2.4 Props Interface

```ts
interface SearchBarProps {
  placeholder?: string;        // default: "Search memories…"
  size?: 'sm' | 'md';           // default: 'md'
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  shortcut?: boolean;           // default: true
  autoFocus?: boolean;
}
```

---

## 3. Dropdown

### 3.1 Single-Select

```
Default:          Open:
┌──────────────┐  ┌──────────────┐
│ Select type ▼│  │ ■ Option 1   │
└──────────────┘  │ □ Option 2   │
                  │ □ Option 3   │
                  └──────────────┘
```

| Property | Spec |
|---|---|
| **Trigger height** | `40px` |
| **Trigger padding** | `spacing.md` horizontal |
| **Background** | `color.surface.default` |
| **Border** | `1px solid color.border.default` |
| **Border radius** | `borderRadius.md` (`8px`) |
| **Chevron** | `16px`, `color.text.muted`, rotates `180°` when open |
| **Menu** | `shadow.lg`, `borderRadius.md`, `background: color.surface.default` |
| **Menu max-height** | `240px` with scroll |
| **Item height** | `36px` |
| **Item padding** | `spacing.md` horizontal |
| **Item hover** | `background: color.surface.muted` |
| **Selected item** | `background: color.surface.muted`, left `3px` accent bar `color.primary.default` |

### 3.2 Multi-Select

- Same trigger, but shows selected count badge (`+2`) or truncated label list
- Checkboxes (`16px`, `borderRadius.sm`) on left of each item
- Selected state: checkmark inside box, `background: color.primary.default`, `border: color.primary.default`
- "Clear all" option at bottom of menu

### 3.3 Props Interface

```ts
interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string | string[];     // string for single, string[] for multi
  placeholder?: string;
  multi?: boolean;                // default: false
  searchable?: boolean;          // default: false
  disabled?: boolean;
  onChange: (value: string | string[]) => void;
}
```

---

## 4. Pagination

### 4.1 Anatomy

```
┌────┬────┬────┬────┬────┬────┬────┐
│ <  │ 1  │ 2  │ …  │ 9  │ 10 │ >  │
└────┴────┴────┴────┴────┴────┴────┘
```

| Property | Spec |
|---|---|
| **Container** | Horizontal flex, `gap: spacing.xs` (`4px`), centered |
| **Page button size** | `36px × 36px` |
| **Page button shape** | `borderRadius.sm` (`4px`) |
| **Font** | `typography.fontSize.sm` (`14px`), `typography.fontWeight.medium` |
| **Default** | `background: transparent`, `color: color.text.secondary`, `border: 1px solid color.border.subtle` |
| **Hover** | `background: color.surface.muted`, `border-color: color.border.default` |
| **Active page** | `background: color.primary.default`, `color: color.text.inverse`, `border-color: color.primary.default` |
| **Disabled** | `opacity: 0.4`, `cursor: not-allowed` |
| **Ellipsis** | `color.text.muted`, no hover state |

### 4.2 Ellipsis Rules

- Always show first and last page
- Show current page ±1 neighbor
- Ellipsis (`…`) replaces skipped ranges
- Min items: 7 (first, ellipsis, current, ellipsis, last) when page count > 7

### 4.3 Props Interface

```ts
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;        // default: true
  siblingCount?: number;          // default: 1
}
```

---

## 5. Avatar

### 5.1 Single Avatar

| Size | Dimensions | Font Size | Use Case |
|---|---|---|---|
| **xs** | `24px × 24px` | `10px` | Inline lists, compact rows |
| **sm** | `32px × 32px` | `12px` | Table cells, tags |
| **md** | `40px × 40px` | `14px` | Cards, nav items |
| **lg** | `48px × 48px` | `16px` | Profile headers, detail sidebars |
| **xl** | `64px × 64px` | `20px` | User profile pages |

| Property | Spec |
|---|---|
| **Shape** | `borderRadius.full` (`9999px`) — circle |
| **Fallback** | Initials on `color.primary.default` background, `color.text.inverse` text |
| **Image fit** | `object-fit: cover` |
| **Border** | `2px solid color.surface.default` (optional, for stacking) |
| **Status dot** | `8px` circle, `border: 2px solid color.surface.default`, positioned bottom-right |

### 5.2 Avatar Group

```
┌────┬────┬────┬────┐
│ 🅰️ │ 🅱️ │ 🅲️ │ +2 │
└────┴────┴────┴────┘
```

| Property | Spec |
|---|---|
| **Overlap** | `-8px` margin-left per stacked avatar (creates overlap) |
| **Max visible** | `3` avatars + overflow counter |
| **Overflow** | `color.surface.muted` background, `color.text.secondary` text, `typography.fontSize.xs` |
| **Z-index** | Each subsequent avatar `z-index + 1` |

### 5.3 Props Interface

```ts
interface AvatarProps {
  src?: string;                  // Image URL
  alt: string;                    // Alt text / name for initials
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  fallback?: string;             // Override initials
}

interface AvatarGroupProps {
  avatars: AvatarProps[];
  max?: number;                   // default: 3
  size?: 'xs' | 'sm' | 'md' | 'lg';
}
```

---

## 6. NotificationBadge

### 6.1 Dot Badge

| Property | Spec |
|---|---|
| **Size** | `8px × 8px` |
| **Shape** | `borderRadius.full` |
| **Color** | `color.secondary.default` (`#FF5A2E`) |
| **Position** | Top-right of parent, offset `-4px` from edge |
| **Animation** | Subtle pulse (`scale 1 → 1.2 → 1`, `2s infinite`) |

### 6.2 Count Badge

```
┌───┐
│ 9+│
└───┘
```

| Property | Spec |
|---|---|
| **Min size** | `18px × 18px` |
| **Padding** | `0 spacing.xs` (`0 4px`) |
| **Shape** | `borderRadius.full` |
| **Background** | `color.secondary.default` |
| **Text** | `color.text.inverse`, `typography.fontSize.xs`, `typography.fontWeight.bold` |
| **Max display** | `99+` when count > 99 |
| **Position** | Top-right of parent, offset `-8px` horizontal, `-4px` vertical |

### 6.3 Props Interface

```ts
interface NotificationBadgeProps {
  variant: 'dot' | 'count';
  count?: number;                // Required for 'count' variant
  max?: number;                  // default: 99
  pulse?: boolean;               // default: true for dot
}
```

---

## 7. Navigation (Sidebar)

### 7.1 Desktop — Expanded

| Property | Spec |
|---|---|
| **Width** | `240px` |
| **Height** | `100vh` |
| **Background** | `color.surface.default` |
| **Border right** | `1px solid color.border.subtle` |
| **Padding** | `spacing.lg` (`16px`) vertical |

**Sections (top to bottom):**

```
┌────────────────────┐
│ [Logo] Allura      │  ← Brand header, height: 64px, padding: spacing.lg
│                    │
│ 📊 Overview        │  ← Nav item, height: 44px, padding: spacing.md horizontal
│ 📝 Memory Feed      │
│ 🕸️ Graph View      │
│ 💡 Insight Review   │
│ 📄 Evidence Detail  │
│                    │
│ ────────────────── │  ← Divider
│ ⚙️ Settings        │
│ 👤 Profile         │
│                    │
│ [Collapse ←]       │  ← Collapse trigger, bottom
└────────────────────┘
```

**Nav Item Spec:**
| State | Background | Text | Icon |
|---|---|---|---|
| Default | transparent | `color.text.secondary` | `color.text.muted` |
| Hover | `color.surface.muted` | `color.text.primary` | `color.text.secondary` |
| Active | `color.surface.muted` | `color.primary.default` | `color.primary.default` |
| Active indicator | `3px` left border, `color.primary.default` |

> **Deprecation notice (2026-04-26):** Earlier drafts suggested `color.primary.default` for all active indicators including tab bars. That guidance has been superseded by `screen-frames.md` §4. **Sidebar nav items use Blue (`color.primary.default`). Tab bars use Gold (`color.accent.gold`).** See TOKEN-AUTHORITY.md DD-2.

**Icon size:** `20px`, `margin-right: spacing.md` (`12px`)
**Label:** `typography.fontSize.sm` (`14px`), `typography.fontWeight.medium`

### 7.2 Desktop — Collapsed

| Property | Spec |
|---|---|
| **Width** | `64px` |
| **Nav items** | Icon only, centered |
| **Tooltip** | Label appears on hover (`delay: 200ms`, `shadow.md`) |
| **Active indicator** | Same `3px` left border |

### 7.3 Mobile — Overlay

| Property | Spec |
|---|---|
| **Trigger** | Hamburger icon in top app bar |
| **Width** | `280px` |
| **Position** | Slide-in from left, `z-index: 50` |
| **Overlay** | Full-screen scrim, `background: rgba(15, 17, 21, 0.5)` |
| **Animation** | Slide `translateX(-100%) → 0`, `200ms ease-out` |
| **Close** | Tap overlay, swipe left, or `×` button |

### 7.4 Props Interface

```ts
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: NotificationBadgeProps;
}

interface NavigationProps {
  items: NavItem[];
  activeId: string;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}
```

---

## 8. Component State Summary Matrix

| Component | Default | Hover | Active | Disabled | Loading |
|---|---|---|---|---|---|
| **Button (primary)** | `color.primary.default` bg | `color.primary.hover` bg | `scale(0.98)` | `opacity: 0.5` | Spinner + `opacity: 0.8` |
| **SearchBar** | `color.border.default` | `color.border.subtle` + `shadow.md` | `color.primary.default` border | `opacity: 0.5` | — |
| **Dropdown** | `color.border.default` | `color.border.subtle` | Open menu | `opacity: 0.5` | — |
| **Pagination** | Transparent | `color.surface.muted` | `color.primary.default` | `opacity: 0.4` | — |
| **Avatar** | Image / initials | `opacity: 0.9` | — | `opacity: 0.5` | Skeleton loader |
| **Nav Item** | Transparent | `color.surface.muted` | `color.primary.default` text | `opacity: 0.4` | — |
