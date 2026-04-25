# Allura Design System - Build Order & Implementation Guide

**Version:** 1.0  
**Last Updated:** 2026-04-22  
**Target:** React/Next.js Development Team  
**Design System Source:** Figma File PAQpnxQZENNwbhmk5qxOjR  

---

## Philosophy: Build from Primitives Up

> "Build the shell first. Then build the primitives. Then compose pages from those primitives. Do not code each screen independently."

This guide provides the optimal sequence for implementing the Allura design system to maximize reuse, minimize rework, and ensure consistency.

---

## Overall Build Strategy

### Phase Categories
1. **Foundations** - Design tokens and base styles
2. **Primitives** - Basic interactive elements
3. **Components** - Reusable UI building blocks
4. **Layout** - Shell structures and patterns
5. **Templates** - Reusable page structures
6. **Pages** - Specific screen implementations
7. **Integration** - State, routing, and data connections
8. **Polish** - Animations, micro-interactions, and refinements

### Guiding Principles
- **Atomic First:** Build smallest reusable units before composing them
- **Shell Before Content:** Layout structure before filling it
- **Patterns Before Pages:** Reusable structures before one-offs
- **States Included:** Build all states from the start, not as afterthoughts
- **Mobile-First:** Consider mobile constraints early in development
- **Test-Driven:** Write tests alongside components when possible

---

## Detailed Build Order

### Phase 1: Foundations (Days 1-2)
**Goal:** Establish the design token foundation that all other components will consume

#### Tasks:
1. **CSS Custom Properties**
   - Create `:root` variables for all design tokens
   - Implement spacing scale (4px base)
   - Implement typography scale (font sizes, weights, line heights)
   - Implement color system (neutral, semantic, status)
   - Implement border radius scale
   - Implement shadow levels
   - Implement icon sizes
   - Implement transition durations
   - Implement z-index scale

2. **Base Styles**
   - Global reset (box-sizing, font-smoothing)
   - Base typography (body text, links)
   - Focus ring styles
   - Scrollbar styling (if custom)
   - Dark mode preparation

3. **Utility Classes**
   - Display utilities (flex, grid, block, none)
   - Position utilities (relative, absolute, fixed, sticky)
   - Overflow utilities
   - Text utilities (align, transform, wrap)
   - Visibility utilities
   - Cursor utilities

4. **CSS Architecture Setup**
   - Choose methodology (CSS Modules, Styled Components, Tailwind, etc.)
   - Set up build process for design tokens
   - Create token export script (JSON → CSS/JS)
   - Document token usage guidelines

**Deliverables:**
- `src/styles/design-tokens.css` or equivalent
- `src/styles/base.css`
- `src/styles/utilities.css`
- Token documentation and export script

### Phase 2: Primitives (Days 2-4)
**Goal:** Build the basic interactive elements that form the foundation of all components

#### Tasks:
**Buttons**
- Base button component with variant props
- Primary/secondary/ghost/destructive variants
- All sizes (sm, md, lg)
- All states (default, hover, focus, disabled, loading)
- Icon button variant
- Loading state with spinner
- Accessibility (proper contrast, focus rings)

**Inputs & Controls**
- Text input (with clear action, loading state)
- Textarea
- Select dropdown
- Radio button group
- Checkbox group
- Toggle switch
- Slider (if needed)
- All with proper labels, states, and validation

**Navigation Primitives**
- Nav item (icon, label, active state)
- Breadcrumb item
- Pagination controls
- Menu item (for dropdowns)

**Feedback Primitives**
- Toast notification system
- Loading skeleton shapes
- Error message display
- Success message display
- Status badge (semantic colors)

**Deliverables:**
- `src/components/ui/Button.jsx`
- `src/components/ui/Input.jsx`
- `src/components/ui/Select.jsx`
- `src/components/ui/Toggle.jsx`
- `src/components/ui/Toast.jsx`
- `src/components/ui/Skeleton.jsx`
- `src/components/ui/Badge.jsx`
- `src/components/ui/NavItem.jsx`

### Phase 3: Core Components (Days 4-7)
**Goal:** Build the reusable components that appear most frequently across screens

#### Tasks:
**Data Display Components**
- **Stat Card**
  - Default variant
  - With trend variant
  - With explanation variant
  - Compact/mobile variants
  - Loading and error states
- **Memory List Row**
  - Default, hovered, selected states
  - With badge variant
  - With action menu variant
  - Warning state variant
  - Loading skeleton
- **Decision List Row**
  - Default, selected, resolved, flagged variants
  - Loading and error states
- **Agent Card**
  - Default, active, paused, inactive variants
  - Loading and error states
- **Content Grid**
  - Responsive grid wrapper
  - Card container component
  - List container component

**Layout Components**
- **Page Header**
  - Title, subtitle, right actions
  - Breadcrumb integration
  - Mobile collapse behavior
- **Top Utility Bar**
  - Global search
  - Utility icons (notifications, etc.)
  - User avatar/menu
  - Mobile adaptation
- **Sidebar Navigation**
  - Collapsible sidebar (icon-only mode)
  - Section headers and dividers
  - Scrollable content area
  - Mobile drawer/bottom nav adaptation

**Overlay Components**
- **Detail Drawer System**
  - Memory detail variant
  - Agent detail variant
  - Decision detail variant
  - Graph detail variant
  - Filter panel variant
  - All states (open/loading/empty/error/closing)
  - Backdrop and body scroll locking
- **Modal System**
  - Base modal component
  - Confirmation dialog variant
  - Form modal variant
  - Info modal variant
  - All standard states
  - Focus trapping and escape handling

**Deliverables:**
- `src/components/data/StatCard.jsx`
- `src/components/data/MemoryRow.jsx`
- `src/components/data/DecisionRow.jsx`
- `src/components/data/AgentCard.jsx`
- `src/components/layout/PageHeader.jsx`
- `src/components/layout/TopBar.jsx`
- `src/components/layout/SidebarNav.jsx`
- `src/components/overlays/DetailDrawer.jsx`
- `src/components/overlays/Modal.jsx`

### Phase 4: Layout & Shells (Days 7-9)
**Goal:** Build the structural layouts that everything fits into

#### Tasks:
**Desktop App Shell**
- Fixed top bar (height, z-index, background)
- Collapsible left sidebar (240px/60px widths)
- Main content area with max-width centering
- Optional right detail drawer (320px width)
- CSS Grid or Flexbox layout
- Responsive behavior (sidebar collapse at tablet)
- Proper z-index management

**Mobile App Shell**
- Fixed top bar (touch-friendly height)
- Stacked content area (full width)
- Bottom action bar or menu
- Modal/drawer behavior for overlays
- Safe area handling (notch, home indicator)
- Touch-optimized spacing and targets

**Layout Patterns**
- Page header + action bar pattern
- Filterable list pattern (toolbar + list)
- Detail drawer pattern (trigger + panel)
- Split view pattern (main + sidebar)
- Stacked content pattern (mobile navigation)
- Empty state pattern (illustration + action)
- Loading state pattern (skeleton + placeholder)

**Deliverables:**
- `src/layout/DesktopShell.jsx`
- `src/layout/MobileShell.jsx`
- `src/layout/patterns/PageHeaderWithActions.jsx`
- `src/layout/patterns/FilterableList.jsx`
- `src/layout/patterns/DetailDrawerTrigger.jsx`
- `src/layout/patterns/SplitView.jsx`

### Phase 5: Page Templates (Days 9-11)
**Goal:** Build reusable page structures that specific screens will instantiate

#### Tasks:
**Dashboard Template**
- Full-width stat card row
- Two-column layout (main + sidebar)
- Responsive behavior (stack on mobile)
- Loading and error states
- Refresh/pull-to-refresh capability

**List Template**
- Header with title/actions/search
- Filter bar (chips, dropdowns, date pickers)
- Main list area with virtual scrolling
- Empty/loading/error states
- Infinite scroll or pagination
- Selection modes (single, multiple)

**Detail Template**
- Header with back action and title
- Main content area (scrollable if needed)
- Action bar (primary/secondary actions)
- Related information sections
- Loading and error states
- Edit/save/cancel workflow

**Form Template**
- Form layout (vertical or inline)
- Field grouping and spacing
- Validation display
- Submit/cancel actions
- Loading and disabled states
- Reset functionality

**Deliverables:**
- `src/templates/DashboardTemplate.jsx`
- `src/templates/ListTemplate.jsx`
- `src/templates/DetailTemplate.jsx`
- `src/templates/FormTemplate.jsx`

### Phase 6: Screen Implementation (Days 11-16)
**Goal:** Build the specific screens using templates and components

#### Tasks:
**Overview Dashboard (Desktop)**
- Stat cards (memories, connections, clarity, trust)
- Recent activity list
- Quick actions
- Memory highlights
- Responsive sidebar

**Memory Search (Desktop)**
- Search bar with filters
- Filter chip bar
- Memory list (virtualized)
- Selected memory detail drawer
- Bulk actions toolbar
- Export/share options

**Memory Detail (Desktop & Mobile)**
- Memory header (title, type, source)
- Content display (text, media, links)
- Metadata panel (timestamps, size, etc.)
- Relationships section (linked memories, agents)
- Actions toolbar (share, export, delete, etc.)
- Comments/discussion section
- Mobile-optimized layout

**Graph Explorer (Desktop)**
- Graph visualization canvas
- Controls (zoom, pan, layout algorithms)
- Node/edge selection behavior
- Detail drawer integration
- Filter and search controls
- Export options (image, data)
- Mobile preview mode

**Provenance / Audit View (Desktop)**
- Timeline view (vertical or horizontal)
- Filter controls (date, event type, agent)
- Event details expansion
- Export capabilities
- Mobile adaptation

**Decisions Log (Desktop)**
- Decision list with filtering
- Selected decision detail drawer
- Bulk decision actions
- Export capabilities
- Status-based grouping

**Agents Panel (Desktop)**
- Agent list with status indicators
- Selected agent detail drawer
- Agent controls (start, pause, restart)
- Performance metrics
- Resource usage display

**Mobile Screens**
- Home (dashboard equivalent)
- Memory detail (optimized for touch)
- Quick capture flow (voice, text, image, location)
- Graph preview (simplified interaction)
- Settings (account, preferences, notifications)

**Deliverables:**
- `src/pages/Desktop/OverviewDashboard.jsx`
- `src/pages/Desktop/MemorySearch.jsx`
- `src/pages/Desktop/MemoryDetail.jsx`
- `src/pages/Desktop/GraphExplorer.jsx`
- `src/pages/Desktop/ProvenanceView.jsx`
- `src/pages/Desktop/DecisionsLog.jsx`
- `src/pages/Desktop/AgentsPanel.jsx`
- `src/pages/Mobile/Home.jsx`
- `src/pages/Mobile/MemoryDetail.jsx`
- `src/pages/Mobile/QuickCapture.jsx`
- `src/pages/Mobile/GraphPreview.jsx`
- `src/pages/Mobile/Settings.jsx`

### Phase 7: Integration & State (Days 16-18)
**Goal:** Connect components to application state and routing

#### Tasks:
**State Management**
- Choose state solution (Redux, Zustand, Context, etc.)
- Implement memory store
- Implement UI state (loading, errors, filters)
- Implement user/session state
- Implement preferences state
- Devtools integration

**Routing**
- Define route structure
- Implement navigation guards
- Implement route transitions
- Implement scroll restoration
- Implement deep linking
- Implement 404 handling

**Data Layer**
- API service layer
- Request/response transformation
- Caching strategy
- Optimistic updates
- Error handling and retry
- WebSocket/real-time updates (if applicable)

**Forms & Validation**
- Form state management
- Validation schemas (Zod, Joi, etc.)
- Field-level validation
- Cross-field validation
- Async validation
- Error display and focus management

**Deliverables:**
- `src/store/index.jsx` (or equivalent)
- `src/services/api.jsx`
- `src/hooks/useMemory.jsx`
- `src/hooks/useUIState.jsx`
- `src/routes/index.jsx`
- `src/middleware/auth.jsx`

### Phase 8: Polish & QA (Days 18-20)
**Goal:** Add refinements, test thoroughly, and prepare for release

#### Tasks:
**Animations & Transitions**
- Page transition animations
- Modal open/close animations
- Drawer slide animations
- Button press feedback
- Input focus animations
- List item animations
- Loading state animations
- Empty state illustrations
- Error state illustrations

**Micro-interactions**
- Hover effects on interactive elements
- Focus rings and outlines
- Active states on navigation
- Selected states on lists/rows
- Disabled state styling
- Loading skeletons
- Skeleton to content transitions

**Accessibility QA**
- Screen reader testing
- Keyboard navigation audit
- Color contrast verification
- Touch target size testing
- Focus order validation
- ARIA label implementation
- Skip link implementation
- Landmark region usage

**Performance QA**
- Bundle size analysis
- Lazy loading verification
- Image optimization check
- Font loading strategy
- Critical CSS extraction
- Render blocking analysis
- Memory leak testing

**Cross-browser Testing**
- Chrome latest
- Firefox latest
- Safari latest
- Edge latest
- Mobile Chrome/Safari
- Responsive breakpoint testing

**Deliverables:**
- Animation library or motion components
- Accessibility test report
- Performance budget report
- Browser compatibility matrix
- QA checklist sign-off

---

## Component Priority Matrix

### High Priority (Build First)
These components appear in 5+ screens or are structural:
- Button (all variants)
- Input (text, search)
- Nav Item
- Stat Card
- Memory List Row
- Page Header
- Top Utility Bar
- Sidebar Nav
- Detail Drawer
- Modal

### Medium Priority (Build Second)
These components appear in 3-4 screens:
- Decision List Row
- Agent Card
- Filter Chip
- Tabs
- Toggle Switch
- Content Grid
- Loading Skeleton
- Empty State
- Status Badge

### Lower Priority (Build Later)
These components appear in 1-2 screens or are specialized:
- Graph Node Detail Panel
- Provenance Timeline Item
- Recent Activity Row
- Dropdown
- Radio Button Group
- Checkbox Group
- Slider
- Toast Notification
- Confirmation Dialog

---

## Development Environment Setup

### Recommended Tech Stack
- **Framework:** Next.js 13+ (App Router) or React 18
- **Styling:** CSS Modules with CSS Variables OR Styled Components
- **State Management:** Zustand or Redux Toolkit
- **Form Handling:** React Hook Form + Zod
- **Data Fetching:** SWR or React Query
- **Icons:** Heroicons or custom SVG sprite
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint + Prettier
- **Type Safety:** TypeScript (strongly recommended)

### Essential DevTools
- React DevTools
- Redux DevTools (if using Redux)
- Lighthouse (performance/audit)
- axe-core (accessibility)
- Storybook (component documentation)
- Figma to Code plugin (if available)

### File Structure Recommendation
```
src/
├── assets/           # Images, icons, fonts
├── components/       # Reusable components
│   ├── ui/           # Primitives (Button, Input, etc.)
│   ├── data/         # Data display components
│   ├── layout/       # Layout components
│   ├── overlays/     # Overlay components
│   └── templates/    # Page templates
├── layout/           # App shells
├── pages/            # Page implementations
│   ├── desktop/      # Desktop-specific pages
│   └── mobile/       # Mobile-specific pages
├── store/            # State management
├── services/         # API and data services
├── hooks/            # Custom React hooks
├── routes/           # Route definitions
├── styles/           # CSS and design tokens
├── utils/            # Utility functions
└── tests/            # Test files
```

---

## Quality Gates & Checkpoints

### After Each Phase
Run these checks before proceeding to the next phase:

#### Phase 1 (Foundations) Checkpoint
- [ ] All design tokens implemented as CSS variables
- [ ] Base styles applied consistently
- [ ] Utility classes functional
- [ ] Dark mode preparation complete
- [ ] Token export/import working

#### Phase 2 (Primitives) Checkpoint
- [ ] All button variants and states functional
- [ ] All input types working with validation
- [ ] Toggle and select components working
- [ ] Toast system operational
- [ ] Loading skeletons displaying correctly
- [ ] Accessibility basics met (focus, contrast)

#### Phase 3 (Core Components) Checkpoint
- [ ] Stat cards displaying correctly in grid
- [ ] Memory rows interactive with states
- [ ] Page headers consistent across uses
- [ ] Top bar functioning correctly
- [ ] Sidebar nav collapsible
- [ ] Detail drawer opening/closing
- [ ] Modal trapping focus correctly
- [ ] All components using design tokens

#### Phase 4 (Layout) Checkpoint
- [ ] Desktop shell layout correct
- [ ] Mobile shell layout correct
- [ ] Sidebar collapse working at breakpoint
- [ ] Main content max-width respected
- [ ] Right drawer positioning correct
- [ ] Mobile bottom bar functioning
- [ ] Layout patterns reusable
- [ ] No layout shifting on state changes

#### Phase 5 (Templates) Checkpoint
- [ ] Dashboard template flexible
- [ ] List template handles empty/loading/error
- [ ] Detail template accommodates various content
- [ ] Form template handles validation
- [ ] Templates compose correctly with components
- [ ] Responsive behavior working
- [ ] No hardcoded dimensions in templates

#### Phase 6 (Screens) Checkpoint
- [ ] All screens buildable from templates/components
- [ ] Navigation between screens working
- [ ] State updates reflected in UI
- [ ] Data loading/showing correctly
- [ ] Error states handled gracefully
- [ ] Empty states actionable
- [ ] Mobile views usable and accessible
- [ ] Desktop views functional and efficient

#### Phase 7 (Integration) Checkpoint
- [ ] State management connected to UI
- [ ] Data fetching and displaying correctly
- [ ] Forms submitting and validating
- [ ] Routing navigating correctly
- [ ] URL updates reflecting state
- [ ] Deep linking working
- [ ] Performance acceptable
- [ ] Error boundaries functioning

#### Phase 8 (Polish) Checkpoint
- [ ] Animations smooth and performant
- [ ] Micro-interactions present and helpful
- [ ] Accessibility fully compliant (WCAG 2.1 AA)
- [ ] Performance within budget
- [ ] Cross-browser compatible
- [ ] Mobile touch targets adequate
- [ ] No console errors in production build
- [ ] Build size within limits

---

## Estimated Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1: Foundations | 2 days | Design tokens, base styles, utilities |
| 2: Primitives | 2 days | Button, input, toggle, toast, skeleton |
| 3: Core Components | 3 days | Stat card, memory row, page header, sidebar, detail drawer, modal |
| 4: Layout | 2 days | Desktop/mobile shells, layout patterns |
| 5: Templates | 2 days | Dashboard, list, detail, form templates |
| 6: Screens | 5 days | All desktop and mobile screen implementations |
| 7: Integration | 2 days | State management, routing, data layer |
| 8: Polish & QA | 2 days | Animations, accessibility, performance, testing |
| **Total** | **18 days** | **Production-ready implementation** |

### Parallel Work Options
- **Design & Dev:** Design team can refine Figma while dev builds foundations
- **Frontend & Backend:** API development can proceed in parallel with UI
- **Testing:** QA can write test cases while development proceeds
- **Documentation:** Tech writing can create user docs during build

### Risk Mitigation
- **Early Integration:** Connect to mock API early to validate data flow
- **Component Storybook:** Build components in Storybook for isolated testing
- **Design Reviews:** Weekly check-ins between design and dev
- **Automated Testing:** Catch regressions early
- **Performance Budgets:** Set and monitor from day one
- **Accessibility First:** Test with screen readers from primitive stage

---

## Success Criteria

### ✅ Implementation Complete When:
1. **All Screens Built:** Every wireframe screen implemented exactly
2. **Component Reuse:** 90%+ of UI uses instances from component library
3. **Design Token Usage:** 0 hardcoded colors, spacing, or typography values
4. **Responsive Behavior:** All breakpoints work as specified
5. **State Coverage:** All documented states implemented and functional
6. **Accessibility:** WCAG 2.1 AA compliant
7. **Performance:** Meets performance budgets (LCP < 2.5s, etc.)
8. **Testing:** >80% component test coverage, E2E tests for critical flows
9. **Documentation:** Usage guidelines clear and followed by team
10. **Handoff Complete:** Design team can verify implementation matches specs

### 📊 Quality Metrics to Track
- **Component Reuse Rate:** % of UI elements that are component instances
- **Design Token Compliance:** % of values that use tokens vs hardcoded
- **State Implementation:** % of documented states that are functional
- **Accessibility Score:** Automated and manual audit results
- **Performance Scores:** Lighthouse metrics (performance, accessibility, best practices)
- **Test Coverage:** Unit, integration, and end-to-end test percentages
- **Build Speed:** Development server and production build times
- **Bundle Size:** JavaScript and CSS payload sizes

---

## Team Collaboration Guidelines

### Design-Dev Communication
- **Weekly Sync:** 30-minute design/development check-in
- **Component Reviews:** Review new components before they go live
- **State Reviews:** Review complex state interactions
- **QA Pairing:** Designers test with developers for usability feedback
- **Documentation Updates:** Keep specs current with implementation

### Issue Tracking
- **Component Issues:** Tag with `component:` prefix
- **Layout Issues:** Tag with `layout:` prefix
- **Token Issues:** Tag with `token:` prefix
- **State Issues:** Tag with `state:` prefix
- **Accessibility Issues:** Tag with `a11y:` prefix
- **Performance Issues:** Tag with `perf:` prefix

### Definition of Done
For each component/screen:
- [ ] Implemented according to spec
- [ ] All variants and states functional
- [ ] Uses design tokens exclusively
- [ ] Responsive behavior implemented
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Tested (unit + integration tests)
- [ ] Documented in Storybook (if used)
- [ ] Reviewed by peer
- [ ] Approved by design lead
- [ ] Ready for QA

---

## Next Steps After Implementation

### Phase 9: Evolution & Maintenance
- **Design System Updates:** Regular updates based on user feedback
- **Component Audits:** Quarterly review for bloat and consistency
- **Performance Optimization:** Ongoing based on real-world data
- **Accessibility Maintenance:** Ongoing compliance as features add
- **Documentation Updates:** Keep pace with implementation changes
- **Team Training:** Onboard new members to design system usage

### Phase 10: Scaling Considerations
- **Theme Support:** Multiple themes (brand variations, dark/light)
- **Internationalization:** Right-to-left language support
- **Platform Expansion:** Tablet-specific optimizations
- **Design System Contribution:** Clear process for team contributions
- **Versioning:** Semantic versioning for breaking changes
- **Deprecation Policy:** Clear timeline for removing old patterns

---

*Following this build order ensures the Allura application is built on a solid foundation of reusable components, consistent design tokens, and clear architectural patterns—resulting in faster development, fewer bugs, and a more maintainable codebase.*