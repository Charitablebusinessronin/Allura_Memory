/**
 * Durham design tokens — reference layer.
 *
 * All color values point to CSS custom properties defined in
 * src/styles/presets/durham.css. This lets the theme system
 * respond to dark-mode switches without JS re-renders.
 */

export const DURHAM_TOKENS = {
  deepGraphite: "var(--durham-deep-graphite)",
  richNavy: "var(--durham-rich-navy)",
  steelBlue: "var(--durham-steel-blue)",
  warmSlate: "var(--durham-warm-slate)",
  amberOchre: "var(--durham-amber-ochre)",
  softAmber: "var(--durham-soft-amber)",
  mist: "var(--durham-mist)",
  warmMist: "var(--durham-warm-mist)",
  mutedText: "var(--durham-muted-text)",
  secondaryText: "var(--durham-secondary-text)",
  tertiaryText: "var(--durham-tertiary-text)",
  captionText: "var(--durham-caption-text)",
  border: "var(--durham-border)",
  borderLight: "var(--durham-border-light)",
  surface: "var(--durham-surface)",
  undoAmberBg: "var(--durham-undo-amber-bg)",
  undoAmberBorder: "var(--durham-undo-amber-border)",
  undoAmberText: "var(--durham-undo-amber-text)",
  hoverAmberBg: "var(--durham-hover-amber-bg)",
  hoverNavy: "var(--durham-hover-navy)",
  panelSubtle: "var(--durham-panel-subtle)",
  innerBorder: "var(--durham-inner-border)",
  innerBorderAlt: "var(--durham-inner-border-alt)",
  rawBg: "var(--durham-raw-bg)",
  rawText: "var(--durham-raw-text)",
  shadowBase: "var(--durham-shadow-base)",
  pageBg: "var(--durham-page-bg)",
  inputBorder: "var(--durham-input-border)",
  subtleText: "var(--durham-subtle-text)",
  confidenceBorder: "var(--durham-confidence-border)",
  confidenceBg: "var(--durham-confidence-bg)",
  confidenceText: "var(--durham-confidence-text)",
  statusSuccessBorder: "var(--durham-status-success-border)",
  statusSuccessBg: "var(--durham-status-success-bg)",
  statusSuccessText: "var(--durham-status-success-text)",
  statusPendingBorder: "var(--durham-status-pending-border)",
  statusPendingBg: "var(--durham-status-pending-bg)",
  statusPendingText: "var(--durham-status-pending-text)",
  statusFailedBorder: "var(--durham-status-failed-border)",
  statusFailedBg: "var(--durham-status-failed-bg)",
  statusFailedText: "var(--durham-status-failed-text)",
  statusDefaultBorder: "var(--durham-status-default-border)",
  statusDefaultBg: "var(--durham-status-default-bg)",
  statusDefaultText: "var(--durham-status-default-text)",
} as const

// Keep legacy DURHAM_COLORS for any consumer that still imports it
export const DURHAM_COLORS = {
  deepGraphite: "var(--durham-deep-graphite)",
  warmSlate: "var(--durham-warm-slate)",
  steelBlue: "var(--durham-steel-blue)",
  richNavy: "var(--durham-rich-navy)",
  amberOchre: "var(--durham-amber-ochre)",
  softAmber: "var(--durham-soft-amber)",
  mist: "var(--durham-mist)",
  warmMist: "var(--durham-warm-mist)",
} as const

// Gradients reference CSS vars for theme-reactivity
export const DURHAM_GRADIENTS = {
  page: "linear-gradient(180deg, var(--durham-warm-mist) 0%, #ffffff 34%, var(--durham-mist) 100%)",
  panel: "linear-gradient(180deg, rgb(255 255 255 / 0.95) 0%, rgb(240 238 242 / 0.88) 100%)",
  ink: "linear-gradient(135deg, var(--durham-rich-navy) 0%, var(--durham-warm-slate) 100%)",
} as const
