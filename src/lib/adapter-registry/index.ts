/**
 * Adapter Registry — Barrel Export
 *
 * Story 0: Adapter Source-of-Truth & Policy Registry
 *
 * Public API for the adapter registry system.
 *
 * Usage:
 * ```typescript
 * import { createDefaultRegistry, getAdapter, validateRegistry } from "@/lib/adapter-registry"
 * import type { AdapterDeclaration } from "@/lib/adapter-registry"
 *
 * const registry = createDefaultRegistry()
 * const adapter = getAdapter(registry, "notion-work-board")
 * ```
 */

export * from "./types"
export * from "./registry"
