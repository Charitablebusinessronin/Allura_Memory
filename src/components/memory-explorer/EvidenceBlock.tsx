"use client"

import type { ReactNode } from "react"

interface EvidenceBlockProps {
  content?: string
  children?: ReactNode
}

/**
 * EvidenceBlock — cream evidence section inside the detail pane
 * Per spec §4b: ONLY place --dashboard-evidence-bg is used
 * Monospace font, cream background, dark text
 */
export function EvidenceBlock({ content, children }: EvidenceBlockProps) {
  if (!content && !children) return null

  return (
    <section className="memory-explorer__evidence">
      {content ? (
        <pre style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "var(--font-family-mono)",
          fontSize: "inherit",
          color: "var(--dashboard-evidence-text)",
        }}>
          {content}
        </pre>
      ) : children}
    </section>
  )
}
