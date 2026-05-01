/**
 * Allura Memory Dashboard — Semantic Design Tokens
 * Source: design/tokens.json
 * @deprecated Migrate to `@/lib/brand/allura.ts` for CSS custom property-based tokens.
 *   - Colors: use `ALLURA_TOKENS` (e.g., `ALLURA_TOKENS.blue`) or Tailwind `text-[var(--allura-blue)]`
 *   - Graph helpers: use `getGraphNodeColor()` / `getGraphNodeRadius()` from `@/lib/brand/allura.ts`
 *   - This file is retained for backward compatibility only and will be removed in a future release.
 */

export const tokens = {
  color: {
    primary: {
      default: "#1D4ED8",
      hover: "#1E40AF",
    },
    secondary: {
      default: "#FF5A2E",
      hover: "#E04D1F",
    },
    success: {
      default: "#157A4A",
      hover: "#166534",
    },
    surface: {
      default: "#FFFFFF",
      subtle: "#F6F4EF",
      muted: "#F3F4F6",
    },
    border: {
      subtle: "#E5E7EB",
      default: "#D1D5DB",
    },
    text: {
      primary: "#0F1115",
      secondary: "#6B7280",
      muted: "#9CA3AF",
      inverse: "#FFFFFF",
    },
    accent: {
      gold: "#C89B3C",
      goldHover: "#A87D2B",
      cream: "#F6F4EF",
    },
    graph: {
      agent: "#1D4ED8",
      project: "#C89B3C",
      outcome: "#157A4A",
      event: "#0F1115",
      insight: "#FF5A2E",
      memory: "#9CA3AF",
      edge: "#9CA3AF",
      edgeHover: "#1D4ED8",
      edgeAlpha: 0.6,
    },
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "48px",
  },
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    full: "9999px",
  },
  shadow: {
    sm: "0 1px 2px 0 rgba(15, 17, 21, 0.05)",
    md: "0 4px 6px -1px rgba(15, 17, 21, 0.1), 0 2px 4px -2px rgba(15, 17, 21, 0.1)",
    lg: "0 10px 15px -3px rgba(15, 17, 21, 0.1), 0 4px 6px -4px rgba(15, 17, 21, 0.1)",
  },
  typography: {
    fontFamily: {
      sans: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
      display: "'Montserrat', 'IBM Plex Sans', system-ui, -apple-system, sans-serif",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
    fontSize: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "30px",
      "4xl": "36px",
      "5xl": "48px",
      "6xl": "56px",
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.625,
    },
  },
} as const

/** Tailwind-safe semantic classes generated from tokens */
export const tokenClasses = {
  fontSans: "font-[family-name:var(--font-ibm-plex-sans)]",
} as const

/** Graph node color mapping by type */
export function getGraphNodeColor(type: string): string {
  switch (type.toLowerCase()) {
    case "agent":
      return tokens.color.graph.agent
    case "project":
      return tokens.color.graph.project
    case "outcome":
      return tokens.color.graph.outcome
    case "event":
      return tokens.color.graph.event
    case "insight":
      return tokens.color.graph.insight
    case "memory":
      return tokens.color.graph.memory
    default:
      return tokens.color.graph.memory
  }
}

/** Graph node radius by tier */
export function getGraphNodeRadius(type: string): number {
  const t = type.toLowerCase()
  if (t === "agent" || t === "project") return 10
  if (t === "outcome" || t === "event" || t === "insight") return 7
  return 5
}
