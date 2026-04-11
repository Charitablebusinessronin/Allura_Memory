/**
 * Agent Manifest — Single source of truth for all Allura agents.
 *
 * This module unifies three previously conflicting taxonomies:
 *   1. `.opencode/agent/` persona definitions (8 agents)
 *   2. `scripts/agents/` executable scripts (3 scripts)
 *   3. `.claude/rules/agent-routing.md` routing rules (8 different personas)
 *
 * The canonical set uses the persona names from `.opencode/agent/` as the
 * source of truth, supplemented by script-only agents (dijkstra, knuth) that
 * already have executable scripts at `scripts/agents/`.
 *
 * CI routing replaces the static bash `case` statement in
 * `.github/workflows/agent-hooks.yml` with a data-driven lookup via
 * `dynamic-router.ts`.
 *
 * @module agent-manifest
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Category distinguishes the agent's scope within the surgical team. */
export type AgentCategory =
  | "primary"
  | "core"
  | "code"
  | "development"
  | "system-builder";

/** GitHub event types that can trigger agent scripts. */
export type CiEventName = "pull_request" | "push" | "issues";

/** A single CI route: which event + action triggers which agent. */
export interface CiRoute {
  /** GitHub webhook event name. */
  event: CiEventName;
  /**
   * GitHub webhook action filter.
   * For pull_request: "opened", "synchronize", "reopened"
   * For issues: "opened", "edited"
   * For push: "*" (any push to watched branches)
   */
  action: string;
}

/** Full entry for a single agent in the manifest. */
export interface AgentManifestEntry {
  /** Unique agent identifier matching `.opencode/agent/` persona key. */
  id: string;
  /** Full persona name (e.g. "Frederick Brooks", "Edsger Dijkstra"). */
  persona: string;
  /** One-line role description (e.g. "Chief Architect", "Code Review"). */
  role: string;
  /** Surgical team category. */
  category: AgentCategory;
  /**
   * Path to the agent's executable script, relative to project root.
   * Only agents that participate in CI have a script.
   */
  scriptPath?: string;
  /**
   * CI event routes that should be dispatched to this agent.
   * Empty array means the agent is invoked interactively (not via CI).
   */
  ciRoutes: CiRoute[];
  /** Brief description of what the agent does. */
  description: string;
}

// ── Manifest Data ────────────────────────────────────────────────────────

const manifestEntries: Array<AgentManifestEntry> = [
  // ── Primary ──────────────────────────────────────────────────────────
  {
    id: "brooks",
    persona: "Frederick Brooks",
    role: "Chief Architect",
    category: "primary",
    scriptPath: "scripts/agents/brooks-triage.ts",
    ciRoutes: [
      { event: "issues", action: "opened" },
      { event: "issues", action: "edited" },
    ],
    description:
      "Architectural integrity owner. Final sign-off on architecture and routing policy. Routes issue events for triage.",
  },
  {
    id: "jobs",
    persona: "Steve Jobs",
    role: "Intent Gate",
    category: "primary",
    ciRoutes: [],
    description:
      "Converts requests into crisp objectives, constraints, and acceptance criteria. No execution until intent is signed off.",
  },

  // ── Core Subagents ────────────────────────────────────────────────────
  {
    id: "ralph",
    persona: "Ralph",
    role: "Loop Runner",
    category: "core",
    ciRoutes: [],
    description:
      "Autonomous agentic loop for iterative task completion. Wraps any AI coding agent in a self-correcting loop until completion promise is detected.",
  },
  {
    id: "pike",
    persona: "Rob Pike",
    role: "Interface Review",
    category: "core",
    ciRoutes: [],
    description:
      "Reviews surface area, concurrency hazards, and API ergonomics. Vetoes unnecessary complexity.",
  },
  {
    id: "fowler",
    persona: "Martin Fowler",
    role: "Refactor Gate",
    category: "core",
    scriptPath: "scripts/agents/fowler-refactor-gate.ts",
    ciRoutes: [
      { event: "push", action: "*" },
    ],
    description:
      "Ensures changes are incremental, reversible, and don't add debt. Static analysis: complexity, duplication, debt scan, gate verdict. Routes push events for refactor review.",
  },
  {
    id: "scout",
    persona: "Scout",
    role: "Recon",
    category: "core",
    ciRoutes: [],
    description:
      "Fast recon and discovery agent. Scans repos, finds paths, patterns, and configs. Produces Scout Report so nobody guesses.",
  },

  // ── Code Subagents ───────────────────────────────────────────────────
  {
    id: "woz",
    persona: "Steve Wozniak",
    role: "Builder",
    category: "code",
    ciRoutes: [],
    description:
      "Primary builder. Implements the Brooks plan with minimal ceremony. Ships working code, tests, and clean diffs.",
  },
  {
    id: "bellard",
    persona: "Fabrice Bellard",
    role: "Perf Diagnostics",
    category: "code",
    ciRoutes: [],
    description:
      "Performance + deep diagnostics specialist. Measurement-first approach. Only invoked when speed, correctness under constraints, or low-level weirdness matters.",
  },
  {
    id: "dijkstra",
    persona: "Edsger Dijkstra",
    role: "Code Review",
    category: "code",
    scriptPath: "scripts/agents/dijkstra-review.ts",
    ciRoutes: [
      { event: "pull_request", action: "opened" },
      { event: "pull_request", action: "synchronize" },
      { event: "pull_request", action: "reopened" },
    ],
    description:
      "Code review specialist. Structural correctness, simplicity, elegant solutions. Routes pull_request events for review.",
  },
  {
    id: "knuth",
    persona: "Donald Knuth",
    role: "Deep Analysis",
    category: "code",
    scriptPath: "scripts/agents/knuth-analyze.ts",
    ciRoutes: [
      { event: "push", action: "*" },
    ],
    description:
      "Deep analysis specialist. Literate programming, algorithmic complexity, and complexity analysis. Routes push events for analysis.",
  },
];

/**
 * Immutable map from agent ID to its manifest entry.
 * This is the single source of truth for all agent definitions.
 *
 * To add a new agent:
 *   1. Add an entry to `manifestEntries` above
 *   2. Create a persona file in `.opencode/agent/` (if interactive)
 *   3. Create a script in `scripts/agents/` (if CI-routed)
 *   4. Run `bun run typecheck` to verify
 */
export const AGENT_MANIFEST: ReadonlyMap<string, AgentManifestEntry> =
  new Map(manifestEntries.map((entry) => [entry.id, entry]));

// ── Convenience Lookups ──────────────────────────────────────────────────

/** All agent IDs in the manifest. */
export const AGENT_IDS: ReadonlyArray<string> = Array.from(AGENT_MANIFEST.keys());

/** Agents that have executable scripts (participate in CI). */
export const CI_AGENTS: ReadonlyArray<AgentManifestEntry> = manifestEntries.filter(
  (entry) => entry.scriptPath !== undefined
);

/** Agents grouped by category. */
export const AGENTS_BY_CATEGORY: ReadonlyMap<AgentCategory, ReadonlyArray<AgentManifestEntry>> =
  new Map(
    (["primary", "core", "code", "development", "system-builder"] as const).map((cat) => [
      cat,
      manifestEntries.filter((entry) => entry.category === cat),
    ])
  );

/**
 * Look up an agent by ID. Throws if not found.
 * Use this when you need a guaranteed agent reference.
 */
export function getAgentById(id: string): AgentManifestEntry {
  const entry = AGENT_MANIFEST.get(id);
  if (!entry) {
    throw new Error(`Agent not found in manifest: "${id}". Available: ${AGENT_IDS.join(", ")}`);
  }
  return entry;
}

/**
 * Look up agents by CI event. Returns all agents whose ciRoutes
 * match the given event and action. Supports wildcard action "*".
 */
export function getAgentsForEvent(
  event: CiEventName,
  action: string
): ReadonlyArray<AgentManifestEntry> {
  return manifestEntries.filter((entry) =>
    entry.ciRoutes.some(
      (route) => route.event === event && (route.action === "*" || route.action === action)
    )
  );
}