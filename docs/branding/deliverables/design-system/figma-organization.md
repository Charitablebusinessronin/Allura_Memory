# Figma File Reorganization Guide

**Purpose:** Transform the current wireframe board into a structured, handoff-ready design system file  
**Target:** Figma File PAQpnxQZENNwbhmk5qxOjR  
**Method:** Reorganize existing content into logical pages and convert to components  

---

## Current State Analysis
The file currently contains:
- 8 pages of wireframes showing desktop and mobile screens
- Low-fidelity wireframes focused on structure and hierarchy
- Clear product grammar visible in repeated patterns
- No established component system or design foundations

## Recommended Reorganization

### Step 1: Create New Page Structure
Create these pages in exact order:

```
00 Cover & Overview
01 Foundations
02 Components
03 Patterns
04 Desktop Screens
05 Mobile Screens
06 States & Variants
07 Handoff Notes
```

### Step 2: Distribute Content by Page

#### Page 00: Cover & Overview
**Content:**
- Product name: Allura
- Tagline: "MEMORY THAT SHOWS ITS WORK"
- One-sentence product description
- Links to key user flows
- Version and date information
- Design system status badge

**Source:** Extract from current Page 1 (Cover) + add overview

#### Page 01: Foundations
**Content:**
- **Spacing Scale:** Visual ruler showing 4, 8, 12, 16, 24, 32, 40px
- **Typography Scale:** All text styles from xs to 6xl with usage examples
- **Color System:** 
  - Swatches with names and hex codes
  - Usage examples (text on backgrounds)
  - Semantic color applications
  - Accessibility pairings
- **Border Radius:** Visual examples of all radius values
- **Icon Sizes:** Icon set at different sizes
- **Shadow Levels:** Examples of each shadow on light/dark backgrounds
- **Grid System:** 12-column grid with gutter examples
- **Icon Library:** All icons used in the wireframes

**Source:** Extract from observations and wireframe analysis

#### Page 02: Components
**Organize as sub-sections or frames:**

**Navigation Components:**
- Sidebar Nav Item (all states)
- Top Utility Bar
- Page Header
- Breadcrumb

**Data Display Components:**
- Stat Card (all variants)
- Memory List Row (all states)
- Decision List Row
- Agent Card
- Content Grid Examples

**Control Components:**
- Button (all variants + states)
- Icon Button
- Search Input (states)
- Filter Chip (states)
- Tabs
- Dropdown
- Toggle

**Overlay Components:**
- Right Detail Drawer (states)
- Modal
- Confirmation Dialog
- Toast
- Empty State
- Loading Skeleton
- Error State

**Specialized Components:**
- Graph Node Detail Panel
- Provenance Timeline Item
- Recent Activity Row

**Source:** Extract repeated elements from all wireframe pages

#### Page 03: Patterns
**Content:**
- **App Shell Desktop:** Wireframe showing shell structure
- **App Shell Mobile:** Wireframe showing mobile shell
- **Page Header + Action Bar:** Reusable pattern
- **Filterable List Pattern:** How lists with filters work
- **Detail Drawer Pattern:** When and how drawers appear
- **Split View Pattern:** Main content + detail sidebar
- **Stacked Content Pattern:** Mobile navigation flow

**Source:** Identify recurring layout patterns across screens

#### Page 04: Desktop Screens
**Content (as component instances):**
- Overview Dashboard
- Memory Search
- Memory Detail
- Graph Explorer
- Provenance / Audit View
- Decisions Log
- Agents Panel

**Instructions:** Replace wireframes with actual component instances from Pages 02-03

#### Page 05: Mobile Screens
**Content (as component instances):**
- Home
- Memory Detail
- Quick Capture Flow
- Graph Preview
- Settings

**Instructions:** Replace wireframes with actual component instances

#### Page 06: States & Variants
**Content:**
- **Button States:** All variants in all states
- **Nav Item States:** All states for sidebar and top nav
- **Form States:** Input states (focus, error, disabled, loading)
- **Data States:** Empty, loading, error, success for lists/cards
- **Navigation States:** Expanded/collapsed sidebar states
- **Overlay States:** Open/closing/loading/empty/error for drawers/modals

**Purpose:** Comprehensive state reference for developers

#### Page 07: Handoff Notes
**Content:**
- Component usage guidelines
- Responsiveness notes
- Content priority rules
- Interaction expectations
- Build order recommendations
- QA checklist
- Design token reference
- Component library export instructions

**Source:** This document and component-specs.md

### Step 3: Conversion Process

#### For Each Repeated Element:
1. Select the element in its current wireframe context
2. Right-click → "Create component"
3. Name using slash notation (e.g., `Nav/Item/Default`)
4. Add description with usage notes
5. Create variants for states using the variant property
6. Replace all instances with the component
7. Move to appropriate Components page section

#### For Layout Patterns:
1. Identify the structural pattern
2. Create a frame representing the pattern
3. Name appropriately (e.g., `Pattern/App Shell/Desktop`)
4. Add description with usage guidelines
5. Replace wireframe sections with pattern instances where applicable

### Step 4: Validation Steps

#### After Reorganization:
1. **Wireframe Fidelity Check:** Ensure all original screens can be rebuilt exactly
2. **Component Instance Check:** Verify 90%+ of UI uses component instances
3. **Naming Consistency:** Verify all components follow slash notation
4. **State Coverage:** Verify all documented states exist as variants
5. **Responsiveness Logic:** Verify responsive behavior is documented
6. **Handoff Completeness:** Verify developer can build from components alone

### Step 5: Export Preparation

#### For Developer Handoff:
1. **Create Export Frame:** Single frame showing all components organized
2. **Add Spec Links:** Links to online spec or documentation
3. **Version Label:** Clear version and date
4. **Contact Info:** Design team contact for questions
5. **Export Settings:** Configure for SVG/PNG export at 2x

### Estimated Effort
- **Design Team:** 4-6 hours for complete reorganization
- **Validation:** 1-2 hours for QA against originals
- **Documentation:** 1-2 hours for handoff notes preparation
- **Total:** 6-10 hours for production-ready design system file

### Success Criteria
✅ All original screens rebuildable from components  
✅ 90%+ of UI uses component instances  
✅ Complete variant/state coverage documented  
✅ Clear naming convention applied throughout  
✅ Developer can implement without redrawing UI  
✅ Design tokens exported and documented  
✅ Responsive behavior clearly specified  
✅ Handoff notes answer common implementation questions  

---

## Immediate Actions (Next 30 Minutes)

1. **Create Page 00: Cover & Overview** - 5 minutes
2. **Create Page 01: Foundations** - 15 minutes  
   - Spacing scale visual
   - Typography scale
   - Color swatches
3. **Create Page 02: Components - Navigation** - 10 minutes
   - Sidebar nav item component
   - Top utility bar
   - Page header
4. **Validate 3 Screens** - 5 minutes
   - Verify Overview Dashboard rebuilds correctly
   - Verify Memory Search uses components
   - Verify Page Header consistency

### Expected Outcome After 30 Minutes:
- Structured file foundation established
- Core navigation components created and validated
- Clear path forward for remaining component extraction
- Design system reorganization underway