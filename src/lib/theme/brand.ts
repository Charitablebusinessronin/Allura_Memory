/**
 * Brand tokens for Allura Memory governance dashboard.
 * 
 * Design system based on the prescribed color palette:
 * - Blue #1D4ED8 (primary, action, trust)
 * - Orange #FF5A2E (secondary, emphasis, urgency)
 * - Green #157A4A (success, approval, positive)
 * - Charcoal #111827 (accent, text, depth)
 * - Gold #C89B3C (insight, high-value, achievement)
 * - Cream #F5F1E6 (background, neutral, soft contrast)
 */

// Brand color tokens (hex)
export const BRAND = {
  blue: "#1D4ED8",
  orange: "#FF5A2E",
  green: "#157A4A",
  charcoal: "#111827",
  gold: "#C89B3C",
  cream: "#F5F1E6",
} as const;

// Brand color CSS variables
export const BRAND_VS = {
  blue: "var(--brand-blue)",
  orange: "var(--brand-orange)",
  green: "var(--brand-green)",
  charcoal: "var(--brand-charcoal)",
  gold: "var(--brand-gold)",
  cream: "var(--brand-cream)",
} as const;

// Type definitions for UI tokens
export type BrandTokens = keyof typeof BRAND;
export type BrandVariableTokens = keyof typeof BRAND_VS;

// Status colors (derived from brand palette)
export const STATUS = {
  success: BRAND.green,
  warning: BRAND.orange,
  error: "#EF4444", // red from shadcn defaults
  info: BRAND.blue,
  active: BRAND.green,
  pending: BRAND.orange,
  completed: BRAND.blue,
  deprecated: "#6B7280", // gray-500
  superseded: BRAND.blue,
  draft: BRAND.charcoal,
  archived: BRAND.charcoal,
};

// Status badges
export const STATUS_BADGE = {
  success: { variant: "default" as const, text: "Active" },
  warning: { variant: "outline" as const, text: "Pending" },
  error: { variant: "destructive" as const, text: "Error" },
  info: { variant: "default" as const, text: "Info" },
  active: { variant: "default" as const, text: "Active" },
  pending: { variant: "outline" as const, text: "Pending" },
  completed: { variant: "default" as const, text: "Completed" },
  deprecated: { variant: "secondary" as const, text: "Deprecated" },
  superseded: { variant: "outline" as const, text: "Superseded" },
  draft: { variant: "secondary" as const, text: "Draft" },
  archived: { variant: "outline" as const, text: "Archived" },
};

// Gradient definitions for cards
export const CARD_GRADIENTS = {
  primary: {
    from: BRAND.blue,
    to: "#1E3A8A",
  },
  secondary: {
    from: BRAND.orange,
    to: "#EA580C",
  },
  success: {
    from: BRAND.green,
    to: "#166534",
  },
  insight: {
    from: BRAND.gold,
    to: "#B45309",
  },
  dark: {
    from: BRAND.charcoal,
    to: "#020617",
  },
};

// Layout tokens
export const LAYOUT = {
  sidebarWidth: "260px",
  sidebarCollapsedWidth: "80px",
  headerHeight: "48px",
  contentPadding: "24px",
  borderRadius: "8px",
  cardRadius: "12px",
};

// Typography tokens
export const TYPOGRAPHY = {
  h1: "text-3xl font-bold",
  h2: "text-2xl font-semibold",
  h3: "text-xl font-medium",
  h4: "text-lg font-medium",
  body: "text-base",
  bodySmall: "text-sm",
  caption: "text-xs",
};

// Spacing tokens
export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
};

// Animation tokens
export const ANIMATION = {
  duration: "300ms",
  curve: "cubic-bezier(0.4, 0, 0.2, 1)",
};
