# Allura Design System - Component Specifications

**Version:** 1.0  
**Last Updated:** 2026-04-22  
**Source:** Wireframe Analysis - Figma File PAQpnxQZENNwbhmk5qxOjR  
**Product:** Allura AI Memory Layer  

---

## Table of Contents
1. [Product Shell Definition](#1-product-shell-definition)
2. [Component Inventory](#2-component-inventory)
3. [Component Variants & States](#3-component-variants--states)
4. [Design Foundations](#4-design-foundations)
5. [Layout & Responsive Rules](#5-layout--responsive-rules)
6. [Figma File Organization](#6-figma-file-organization)
7. [Developer Handoff Notes](#7-developer-handoff-notes)
8. [Immediate Priorities](#8-immediate-priorities)

---

## 1. Product Shell Definition

### Desktop App Shell
```
┌─────────────────────────────────────────────────────────────────────┐
│                           TOP BAR                                   │
├─────────────┬───────────────────────────────────────────────────────┤
│ LEFT        │                    MAIN CONTENT AREA                  │
│ SIDEBAR     │                                                       │
│ (240px)     │                                                       │
├─────────────┴───────────────────────────────────────────────────────┤
│                    OPTIONAL RIGHT DRAWER (320px)                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
- **Top Bar:** Global search, notifications, user avatar/menu
- **Left Sidebar:** Navigation (collapsible to icon-only mode)
- **Main Content Area:** Page header + content canvas
- **Right Detail Drawer:** Contextual panels (memory detail, graph detail, etc.)

### Mobile App Shell
```
┌─────────────────────────────────────────────────────────────────────┐
│                           TOP BAR                                   │
├─────────────────────────────────────────────────────────────────────┤
│                           CONTENT STACK                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        BOTTOM ACTION BAR                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Components:**
- **Top Bar:** Back button, page title, primary action
- **Content Stack:** Full-screen views with navigation history
- **Bottom Action Bar:** Primary/secondary actions, menu toggle
- **Modal/Drawer:** Overlays for forms, details, confirmations

---

## 2. Component Inventory

### Navigation Components
- **Sidebar Nav Item** (icon + label + active state)
- **Top Utility Bar** (search + utility icons + user menu)
- **Page Header** (title + subtitle + right-side actions)
- **Breadcrumb** (hierarchical navigation path)

### Data Display Components
- **Stat Card** (metric value + label + optional trend/helper)
- **Memory List Row** (title + snippet + type + source + timestamp + badge)
- **Decision List Row** (title + type + rationale + actor + date + status)
- **Agent Card** (name + role + status + last activity + health)
- **Content Grid Wrapper** (responsive grid with consistent gaps)
- **Data Display** (tables, lists, cards with consistent styling)

### Control Components
- **Top Search Bar** (input + clear action + scope selector)
- **Filter Chip** (selectable + removable + label)
- **Search Input** (with clear action + loading state)
- **Button** (primary/secondary/ghost/destructive variants)
- **Icon Button** (neutral/hover/selected/destructive)
- **Tabs** (horizontal tab set with active state)
- **Dropdown/Sort Trigger** (menu trigger with selected value)
- **Toggle** (on/off switch with label)
- **Status Badge** (semantic status indicators)

### Overlay & Feedback Components
- **Right Detail Drawer** (slide-in panel with header + content + actions)
- **Modal** (centered overlay with header + body + footer)
- **Confirmation Dialog** (title + message + confirm/cancel actions)
- **Toast** (temporary notification with auto-dismiss)
- **Empty State** (illustration + title + description + primary action)
- **Loading Skeleton** (placeholder shapes for content loading)
- **Error State** (illustration + title + description + retry action)

### Specialized Components
- **Graph Node Detail Panel** (selected node metadata + relationships + actions)
- **Provenance Timeline Item** (timestamp + event label + source + note)
- **Recent Activity Row** (action type + entity + timestamp + actor)

---

## 3. Component Variants & States

### Button Component
```
Button/
├── Variants/
│   ├── primary
│   ├── secondary
│   ├── ghost
│   └── destructive
├── Sizes/
│   ├── sm
│   ├── md (default)
│   └── lg
└── States/
    ├── default
    ├── hover
    ├── focus
    ├── disabled
    └── loading
```

### Stat Card Component
```
StatCard/
├── Variants/
│   ├── default
│   ├── with-trend
│   ├── with-explanation
│   ├── compact
│   └── mobile
└── States/
    ├── default
    ├── hover
    └── loading
```

### Memory List Row Component
```
MemoryRow/
├── Variants/
│   ├── default
│   ├── hovered
│   ├── selected
│   ├── with-badge
│   ├── with-action-menu
│   └── with-warning
└── States/
    ├── default
    ├── hover
    ├── focus
    ├── selected
    └── disabled
```

### Sidebar Nav Item Component
```
NavItem/
├── Variants/
│   ├── icon-only
│   ├── icon-and-label
│   ├── section-header
│   └── divider
├── States/
    ├── default
    ├── hover
    ├── active
    └── disabled
└── Sizes/
    ├── sm
    ├── md (default)
    └── lg
```

### Right Detail Drawer Component
```
DetailDrawer/
├── Variants/
│   ├── memory-detail
│   ├── agent-detail
│   ├── decision-detail
│   ├── graph-detail
│   └── filter-panel
├── States/
    ├── closed
    ├── opening
    ├── open
    ├── loading
    ├── empty
    ├── error
    └── closing
└── Positions/
    ├── right (desktop)
    └── bottom (mobile)
```

### Filter Chip Component
```
FilterChip/
├── Variants/
│   ├── choice
│   ├── tag
│   ├── date-range
│   └── multi-select
└── States/
    ├── default
    ├── selected
    ├── hover
    ├── disabled
    └── removable
```

### Tab Component
```
Tabs/
├── Variants/
│   ├── horizontal
│   ├── vertical
│   └── pill
├── States/
    ├── default
    ├── active
    ├── hover
    └── disabled
└── Sizes/
    ├── sm
    ├── md (default)
    └── lg
```

### Status Badge Component
```
Badge/
├── Variants/
│   ├── dot
│   ├── outline
│   ├── solid
│   └── pill
├── Semantic/
    ├── memory (blue)
    ├── connection (orange)
    ├── clarity (green)
    ├── trust (navy)
    ├── empowerment (gold)
    ├── success (green)
    ├── warning (orange)
    ├── error (red)
    └── info (blue)
└── States/
    ├── default
    ├── hover
    └── disabled
```

---

## 4. Design Foundations

### Spacing Scale (4px base)
```
--space-0: 0px
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
--space-20: 80px
--space-24: 96px
```

### Typography Scale
```
--text-xs: 12px (0.75rem)
--text-sm: 14px (0.875rem)
--text-base: 16px (1rem)
--text-lg: 18px (1.125rem)
--text-xl: 20px (1.25rem)
--text-2xl: 24px (1.5rem)
--text-3xl: 30px (1.875rem)
--text-4xl: 36px (2.25rem)
--text-5xl: 48px (3rem)
--text-6xl: 60px (3.75rem)

Font Weights: 400 (regular), 500 (medium), 600 (semi-bold), 700 (bold)
Line Heights: 1.25 (tight), 1.5 (normal), 1.6 (relaxed), 2 (loose)
```

### Border Radius
```
--radius-none: 0px
--radius-sm: 4px
--radius-md: 8px
--radius-lg: 12px
--radius-xl: 16px
--radius-2xl: 24px
--radius-full: 9999px
```

### Icon Sizes
```
--icon-xs: 16px
--icon-sm: 20px
--icon-md: 24px (default)
--icon-lg: 32px
--icon-xl: 40px
```

### Shadow Levels
```
--shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.05)
--shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1)
--shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.1)
--shadow-xl: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)
--shadow-glow-blue: 0 0 20px rgba(30, 91, 219, 0.3)
--shadow-glow-coral: 0 0 20px rgba(232, 90, 43, 0.3)
```

### Color System
**Neutral Palette:**
- --color-white: #FFFFFF
- --color-cream: #F9F6F1
- --color-light-gray: #E5E7EB
- --color-gray: #6B7280
- --color-charcoal: #374151
- --color-dark-navy: #0F172A

**Semantic Palette:**
- --color-memory: #1E5BDB (blue)
- --color-connection: #E85A2B (orange)
- --color-clarity: #1A7A4A (green)
- --color-trust: #0F172A (navy)
- --color-empowerment: #D4A843 (gold)

**Status Colors:**
- --color-success: #10B981
- --color-warning: #F59E0B
- --color-error: #EF4444
- --color-info: #3B82F6

---

## 5. Layout & Responsive Rules

### Desktop Layout Constraints
- **Sidebar Width:** 240px (collapsible to 60px icon-only)
- **Main Content Max Width:** 1200px
- **Content Padding:** 24px (horizontal), varies vertically
- **Grid Gap:** 24px
- **Card Padding:** 24px
- **Right Drawer Width:** 320px

### Mobile Layout Rules
- **Sidebar:** Collapses to bottom navigation or menu toggle
- **Main Content:** Full width with 16px padding
- **Grid:** Becomes single column stack
- **Cards:** Full width cards with 16px margin bottom
- **Drawers:** Become bottom sheets or full-screen modals
- **Top Bar:** Height increases to accommodate touch targets

### Breakpoint Behavior
```
≥1024px (Desktop): Full sidebar + main content + optional right drawer
768px-1023px (Tablet): Sidebar collapses to icons, main content full width
<768px (Mobile): Sidebar hidden (accessible via menu), stacked content
```

### Component-Specific Responsiveness
- **Stat Cards:** 4-column → 2-column → 1-column
- **Memory Rows:** Full width with consistent padding
- **Tables:** Become card lists on mobile
- **Graph Explorer:** Preview-only on mobile, full on desktop
- **Detail Drawers:** Right sidebar → bottom sheet on mobile
- **Navigation:** Horizontal → hamburger menu on mobile

---

## 6. Figma File Organization

### Recommended Page Structure
```
01 Foundations
├── Spacing Scale
├── Typography Scale
├── Color System
├── Border Radius
├── Icon Sizes
├── Shadow Levels
├── Grid System
└── Icon Library

02 Components
├── Navigation
│   ├── Sidebar Nav Item
│   ├── Top Utility Bar
│   ├── Page Header
│   └── Breadcrumb
├── Data Display
│   ├── Stat Card
│   ├── Memory List Row
│   ├── Decision List Row
│   ├── Agent Card
│   └── Content Grid
├── Controls
│   ├── Button
│   ├── Icon Button
│   ├── Search Input
│   ├── Filter Chip
│   ├── Tabs
│   ├── Dropdown
│   └── Toggle
├── Overlays
│   ├── Right Detail Drawer
│   ├── Modal
│   ├── Confirmation Dialog
│   ├── Toast
│   ├── Empty State
│   └── Loading Skeleton
└── Specialized
    ├── Graph Node Detail
    ├── Provenance Timeline Item
    └── Recent Activity Row

03 Patterns
├── App Shell Desktop
├── App Shell Mobile
├── Page Header + Action Bar
├── Filterable List Pattern
├── Detail Drawer Pattern
└── Split View Pattern

04 Desktop Screens
├── Overview Dashboard
├── Memory Search
├── Memory Detail
├── Graph Explorer
├── Provenance / Audit View
├── Decisions Log
└── Agents Panel

05 Mobile Screens
├── Home
├── Memory Detail
├── Quick Capture Flow
├── Graph Preview
└── Settings

06 States
├── Button States
├── Nav Item States
├── Form States
├── Data States (empty/loading/error)
├── Navigation States
└── Overlay States

07 Handoff Notes
├── Component Usage Guidelines
├── Responsiveness Notes
├── Content Priority Rules
├── Interaction Expectations
├── Build Order Recommendations
└── QA Checklist
```

### Naming Convention
Use slash notation for clear hierarchy:
- `Nav/Item/Default`
- `Nav/Item/Active`
- `Button/Primary/Default`
- `Button/Primary/Loading`
- `Card/Stat/Default`
- `Card/Stat/With-Trend`
- `List/MemoryRow/Default`
- `List/MemoryRow/Selected`
- `Drawer/Memory/Open`
- `Drawer/Memory/Loading`
- `Overlay/Modal/Confirmation`

---

## 7. Developer Handoff Notes

### Build Order Recommendations
**Phase 1: Foundation & Primitives**
1. Design tokens (CSS variables)
2. Reset/base styles
3. Typography system
4. Spacing system
5. Color system
6. Border radius & shadows
7. Icon system
8. Basic form elements (input, button, select)

**Phase 2: Core Components**
1. Button variants & states
2. Input variants & states
3. Nav item component
4. Stat card component
5. Page header component
6. Search input component
7. Filter chip component

**Phase 3: Layout & Navigation**
1. App shell (desktop)
2. App shell (mobile)
3. Sidebar navigation
4. Top utility bar
5. Page layout system

**Phase 4: Complex Components**
1. Detail drawer system
2. Modal system
3. Card components
4. List/row components
5. Tab systems
6. Toggle/switch components

**Phase 5: Specialized & Pages**
1. Graph components
2. Timeline components
3. Specialized cards (agent, decision)
4. Page templates
5. Screen implementations
6. Responsive adaptations

### Component Usage Guidelines
- **Always use component instances** - never duplicate UI
- **Follow variant naming** - use exact names from design system
- **Respect state transitions** - implement all defined states
- **Use design tokens** - never hardcode colors, spacing, typography
- **Follow responsive rules** - implement breakpoint behavior exactly
- **Maintain accessibility** - ensure all states meet WCAG 2.1 AA

### Content Priority Rules
1. **Primary Actions** - always visible and accessible
2. **Navigation** - persistent or easily accessible
3. **Content** - main information hierarchy
4. **Secondary Actions** - in menus or overflow when needed
5. **Metadata** - truncated or available on demand
6. **Decorative Elements** - last priority, must not impede usability

### Interaction Expectations
- **Clicking memory row** → opens right detail drawer (desktop) or navigates to detail view (mobile)
- **Clicking graph node** → updates side panel with node details
- **Applying filters** → updates list inline without page reload
- **Decision log row** → opens full decision detail view
- **Mobile quick capture** → submits with success toast confirmation
- **Saving changes** → shows confirmation toast or modal as appropriate
- **Error states** → provide clear retry/action options
- **Empty states** → provide primary action to populate content

### Accessibility Requirements
- All interactive elements must have clear focus states
- Color contrast must meet WCAG 2.1 AA (4.5:1 for text, 3:1 for large text)
- Touch targets must be minimum 44x44px
- All forms must have proper labels and error messaging
- Keyboard navigation must be logical and complete
- Screen reader labels must be provided for all icons and controls

### Performance Guidelines
- Lazy load non-critical components
- Use virtual scrolling for long lists
- Implement skeleton screens for loading states
- Optimize images for web use
- Minimize critical CSS
- Use CSS containment where applicable

---

## 8. Immediate Priorities (Next 10 Actions)

### For Design Team (Figma)
1. **Create Foundations Page** - establish spacing, typography, color scales
2. **Extract Core Components** - button, nav item, stat card, search input
3. **Define Component Variants** - all states for each core component
4. **Build App Shells** - desktop and mobile layout patterns
5. **Create Component Library Page** - organized by category with descriptions
6. **Establish Naming Convention** - apply slash notation consistently
7. **Document State Transitions** - when and how states change
8. **Create Responsiveness Guidelines** - breakpoint behavior for each component
9. **Build Handoff Notes Page** - developer guidance and build order
10. **Validate Against Wireframes** - ensure all screens can be built from components

### For Development Team
1. **Set Up Design Tokens** - CSS variables from foundations
2. **Create Component Library** - reusable React/Vue components
3. **Implement App Shell** - layout structure with navigation
4. **Build Core Components** - button, input, nav item, stat card
5. **Establish State Management** - pattern for component states
6. **Implement Responsive Breakpoints** - layout adaptation rules
7. **Create Page Templates** - reusable screen structures
8. **Set Up Testing Framework** - component and interaction tests
9. **Document Usage Guidelines** - team conventions and best practices
10. **Conduct Component Review** - validate against design specs

---

## Implementation Readiness Checklist

### ✅ Completed
- Wireframe analysis and component identification
- Design token extraction (colors, typography, spacing)
- Component inventory with variants and states
- Layout and responsive rules defined
- Figma file organization recommended
- Developer handoff notes prepared

### 🔄 In Progress
- Component library creation in code
- Design token implementation
- App shell development
- Screen implementation from components

### 📋 Next Steps
1. Create Figma components from specs
2. Implement design tokens in CSS
3. Build reusable component library
4. Develop app shell layouts
5. Create screen templates from components
6. Implement responsive behavior
7. Add interaction and state management
8. Conduct QA against original wireframes
9. Prepare final handoff package
10. Team training on design system usage

---

*This design system transforms the Allura wireframe board from a collection of screens into a reusable, component-based UI framework that enables rapid, consistent development.*