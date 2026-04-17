interface CanonicalAgentIdentity {
  id: string;
  name: string;
  aliases: string[];
}

// Agent registry aligned with AGENT_MANIFEST (src/lib/agents/agent-manifest.ts)
// The manifest is the single source of truth. This registry adds aliases for
// backward compatibility with older group_id conventions.
// Manifest-only agents (jobs, ralph, fowler, bellard, woz) have no legacy aliases.
const agentRegistry: Record<string, { name: string; aliases?: string[] }> = {
  "brooks": { name: "Frederick Brooks", aliases: ["orchestrator", "primary", "triage"] },
  "jobs": { name: "Steve Jobs", aliases: ["intent-gate"] },
  "ralph": { name: "Ralph", aliases: ["loop", "autonomous"] },
  "pike": { name: "Rob Pike", aliases: ["interface", "simplicity"] },
  "fowler": { name: "Martin Fowler", aliases: ["refactor", "drift"] },
  "scout": { name: "Scout", aliases: ["recon", "discovery"] },
  "woz": { name: "Steve Wozniak", aliases: ["builder"] },
  "bellard": { name: "Fabrice Bellard", aliases: ["perf", "diagnostics"] },
  "dijkstra": { name: "Edsger Dijkstra", aliases: ["reviewer", "correctness"] },
  "knuth": { name: "Donald Knuth", aliases: ["deep-worker", "algorithm"] },
  // Legacy aliases preserved for backward compatibility with older events
  "turing": { name: "Alan Turing", aliases: ["architect"] },
   "berners-lee": { name: "Tim Berners-Lee", aliases: [] },
  "hopper": { name: "Grace Hopper", aliases: ["explorer"] },
  "cerf": { name: "Vint Cerf", aliases: ["coordinator"] },
  "torvalds": { name: "Linus Torvalds", aliases: ["pragmatist"] },
  "liskov": { name: "Barbara Liskov", aliases: ["abstraction"] },
  "hinton": { name: "Geoffrey Hinton", aliases: ["vision", "pattern"] },
};

const aliasLookup = Object.entries(agentRegistry).reduce<Map<string, CanonicalAgentIdentity>>((lookup, [id, entry]) => {
  const identity: CanonicalAgentIdentity = {
    id,
    name: entry.name,
    aliases: entry.aliases ?? [],
  };

  const aliases = [id, entry.name, ...(entry.aliases ?? [])];

  aliases.forEach((alias) => {
    lookup.set(alias.trim().toLowerCase(), identity);
  });

  return lookup;
}, new Map());

/** Canonical agent IDs from the AGENT_MANIFEST — the first 10 are active. */
const MANIFEST_AGENT_IDS = [
  "brooks", "jobs", "ralph", "pike", "fowler",
  "scout", "woz", "bellard", "dijkstra", "knuth",
] as const;

/** Legacy agent IDs — still resolvable but not in active manifest. */
const LEGACY_AGENT_IDS = [
  "turing", "berners-lee", "hopper", "cerf", "torvalds", "liskov", "hinton",
] as const;

function titleCaseFromId(agentId: string): string {
  return agentId
    .split(/[-.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function resolveCanonicalAgentIdentity(agentId: string): CanonicalAgentIdentity {
  const normalizedAgentId = agentId.trim();
  const identity = aliasLookup.get(normalizedAgentId.toLowerCase());

  if (identity) {
    return identity;
  }

  return {
    id: normalizedAgentId,
    name: titleCaseFromId(normalizedAgentId),
    aliases: [],
  };
}

export function canonicalizeAgentId(agentId: string): string {
  return resolveCanonicalAgentIdentity(agentId).id;
}
