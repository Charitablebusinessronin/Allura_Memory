interface CanonicalAgentIdentity {
  id: string;
  name: string;
  aliases: string[];
}

// Agent registry derived from .opencode/agent/core/*.json
const agentRegistry: Record<string, { name: string; aliases?: string[] }> = {
  "brooks": { name: "Frederick Brooks", aliases: ["orchestrator", "primary"] },
  "knuth": { name: "Donald Knuth", aliases: ["algorithm", "deep-worker"] },
  "turing": { name: "Alan Turing", aliases: ["architect", "curator"] },
  "berners-lee": { name: "Tim Berners-Lee", aliases: ["librarian", "curator"] },
  "hopper": { name: "Grace Hopper", aliases: ["scout", "explorer"] },
  "cerf": { name: "Vint Cerf", aliases: ["coordinator", "state-keeper"] },
  "torvalds": { name: "Linus Torvalds", aliases: ["builder", "pragmatist"] },
  "liskov": { name: "Barbara Liskov", aliases: ["abstraction", "curator"] },
  "dijkstra": { name: "Edsger Dijkstra", aliases: ["reviewer", "correctness"] },
  "hinton": { name: "Geoffrey Hinton", aliases: ["vision", "pattern"] }
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
