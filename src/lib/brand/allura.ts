/**
 * Allura design tokens — reference layer.
 *
 * All color values point to CSS custom properties defined in
 * src/styles/presets/allura.css.
 */

export const ALLURA_TOKENS = {
  deepNavy: "var(--allura-deep-navy)",
  coral: "var(--allura-coral)",
  trustGreen: "var(--allura-trust-green)",
  clarityBlue: "var(--allura-clarity-blue)",
  pureWhite: "var(--allura-pure-white)",
  inkBlack: "var(--allura-ink-black)",
  warmGray: "var(--allura-warm-gray)",

  navy5: "var(--allura-navy-5)",
  navy10: "var(--allura-navy-10)",
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
  active: { bg: "var(--allura-trust-green)", text: "#FFFFFF", label: "Active" },
  proposed: { bg: "var(--allura-clarity-blue)", text: "#FFFFFF", label: "Proposed" },
  forgotten: { bg: "var(--allura-warm-gray)", text: "#FFFFFF", label: "Forgotten" },
  low_confidence: { bg: "var(--allura-coral)", text: "#FFFFFF", label: "Low Confidence" },
} as const