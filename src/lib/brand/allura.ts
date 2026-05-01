/**
 * Allura design tokens — reference layer (v2.0)
 *
 * All color values point to CSS custom properties defined in
 * src/styles/brand-tokens.css (canonical) and src/styles/presets/allura.css.
 *
 * Backward compatibility: Legacy keys preserved via CSS variable aliases in
 * brand-tokens.css (--allura-deep-navy, --allura-trust-green, etc.).
 */

export const ALLURA_TOKENS = {
  // Canonical brand tokens (v2.0)
  blue:        "var(--allura-blue)",
  blueHover:   "var(--allura-blue-hover)",
  orange:      "var(--allura-orange)",
  orangeHover: "var(--allura-orange-hover)",
  green:       "var(--allura-green)",
  greenHover:  "var(--allura-green-hover)",
  gold:        "var(--allura-gold)",
  goldHover:   "var(--allura-gold-hover)",
  charcoal:    "var(--allura-charcoal)",
  cream:       "var(--allura-cream)",
  white:       "var(--allura-white)",
  gray100:     "var(--allura-gray-100)",
  gray200:     "var(--allura-gray-200)",
  gray300:     "var(--allura-gray-300)",
  gray400:     "var(--allura-gray-400)",
  gray500:     "var(--allura-gray-500)",
  gray600:     "var(--allura-gray-600)",
  gray700:     "var(--allura-gray-700)",
  gray800:     "var(--allura-gray-800)",

  // ── Backward compatibility aliases (deprecated, map to canonical) ──
  deepNavy:   "var(--allura-deep-navy)",   // maps to --allura-blue
  coral:      "var(--allura-coral)",      // maps to --allura-orange
  trustGreen: "var(--allura-trust-green)",// maps to --allura-green
  clarityBlue:"var(--allura-clarity-blue)",// maps to --allura-blue
  pureWhite:  "var(--allura-pure-white)", // maps to --allura-white
  inkBlack:   "var(--allura-ink-black)",  // maps to --allura-charcoal
  warmGray:   "var(--allura-warm-gray)",  // maps to --allura-gray-500

  navy5:   "var(--allura-navy-5)",
  navy10:  "var(--allura-navy-10)",
  coral10: "var(--allura-coral-10)",
  coral20: "var(--allura-coral-20)",

  shadowCard: "var(--allura-shadow-card)",
  shadowHover: "var(--allura-shadow-hover)",
  shadowModal: "var(--allura-shadow-modal)",

  radiusCard: "var(--allura-radius-card)",
  radiusBadge: "var(--allura-radius-badge)",
  radiusButton: "var(--allura-radius-button)",
  radiusInput: "var(--allura-radius-input)",

  statusActive: "var(--allura-status-active)",
  statusProposed: "var(--allura-status-proposed)",
  statusForgotten: "var(--allura-status-forgotten)",
  statusWarning: "var(--allura-status-warning)",
} as const

export type AlluraStatus = "active" | "proposed" | "forgotten" | "low_confidence"

export const ALLURA_STATUS_MAP: Record<AlluraStatus, { bg: string; text: string; label: string }> = {
  active: { bg: "var(--allura-green)", text: "#FFFFFF", label: "Active" },
  proposed: { bg: "var(--allura-blue)", text: "#FFFFFF", label: "Proposed" },
  forgotten: { bg: "var(--allura-gray-500)", text: "#FFFFFF", label: "Forgotten" },
  low_confidence: { bg: "var(--allura-orange)", text: "var(--allura-orange-on-text)", label: "Low Confidence" },
} as const

// ── CSS Variables mapping (semantic names → CSS var strings) ──
export const ALLURA_CSS_VARS = {
  blue: "var(--allura-blue)",
  blueHover: "var(--allura-blue-hover)",
  orange: "var(--allura-orange)",
  orangeHover: "var(--allura-orange-hover)",
  green: "var(--allura-green)",
  greenHover: "var(--allura-green-hover)",
  gold: "var(--allura-gold)",
  goldHover: "var(--allura-gold-hover)",
  charcoal: "var(--allura-charcoal)",
  cream: "var(--allura-cream)",
  white: "var(--allura-white)",
  gray100: "var(--allura-gray-100)",
  gray200: "var(--allura-gray-200)",
  gray300: "var(--allura-gray-300)",
  gray400: "var(--allura-gray-400)",
  gray500: "var(--allura-gray-500)",
  gray600: "var(--allura-gray-600)",
  gray700: "var(--allura-gray-700)",
  gray800: "var(--allura-gray-800)",
  surfaceDefault: "var(--allura-white)",
  shadowCard: "var(--allura-shadow-card)",
  shadowHover: "var(--allura-shadow-hover)",
  shadowModal: "var(--allura-shadow-modal)",
  borderDefault: "var(--allura-border-2)",
  borderSubtle: "var(--allura-border-1)",
  textPrimary: "var(--allura-charcoal)",
  textSecondary: "var(--allura-text-2)",
  textMuted: "var(--allura-text-3)",
  radiusCard: "var(--allura-radius-card)",
  radiusBadge: "var(--allura-radius-badge)",
  radiusButton: "var(--allura-radius-button)",
  radiusInput: "var(--allura-radius-input)",
} as const

// ── Graph node colors (migrated from tokens.ts graph.color.graph.*) ──
const GRAPH_NODE_COLORS: Record<string, string> = {
  agent: "var(--allura-blue)",
  project: "var(--allura-gold)",
  outcome: "var(--allura-green)",
  event: "var(--allura-charcoal)",
  insight: "var(--allura-orange)",
  memory: "var(--allura-gray-500)",
}

// ── Helper: Resolve CSS var to hex at runtime (SSR-safe fallback) ──
export function getResolvedColor(name: string): string {
  if (typeof window === "undefined") {
    // SSR: return hardcoded fallback
    return GRAPH_NODE_COLORS[name]?.replace("var(--", "")?.replace(")", "") ?? "#9CA3AF"
  }
  try {
    const el = document.documentElement
    // Normalize name to match CSS var prefix
    const varName = name.replace(/^allura-/, "")
    const cssVar = `--allura-${varName}`
    const value = window.getComputedStyle(el).getPropertyValue(cssVar).trim()
    if (value) return value
  } catch {
    // Silent fallback
  }
  // Fallback to hardcoded hex
  const fallback = GRAPH_NODE_COLORS[name]
  if (fallback) return fallback.replace("var(--", "")?.replace(")", "")
  return "#9CA3AF"
}

// ── Graph node color by type (runtime resolution) ──
export function getGraphNodeColor(type: string): string {
  const key = type.toLowerCase()
  const cssVar = GRAPH_NODE_COLORS[key]
  if (!cssVar) return getResolvedColor("memory")
  return getResolvedColor(key)
}

// ── Graph node radius by type (keeps existing logic) ──
export function getGraphNodeRadius(type: string): number {
  const t = type.toLowerCase()
  if (t === "agent" || t === "project") return 10
  if (t === "outcome" || t === "event" || t === "insight") return 7
  return 5
}