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
  low_confidence: { bg: "var(--allura-orange)", text: "#FFFFFF", label: "Low Confidence" },
} as const