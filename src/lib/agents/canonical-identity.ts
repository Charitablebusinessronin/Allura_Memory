import { AGENT_IDS } from "./agent-manifest";

interface CanonicalAgentIdentity {
  id: string;
  name: string;
  aliases: string[];
}

const activeAgentRegistry: Record<string, { name: string; aliases?: string[] }> = {
  brooks: { name: "Frederick P. Brooks Jr.", aliases: ["orchestrator", "primary", "triage"] },
  jobs: { name: "Steve Jobs", aliases: ["intent-gate"] },
  pike: { name: "Rob Pike", aliases: ["interface", "simplicity"] },
  fowler: { name: "Martin Fowler", aliases: ["refactor", "drift"] },
  scout: { name: "Scout", aliases: ["recon", "discovery", "explore"] },
  woz: { name: "Steve Wozniak", aliases: ["builder"] },
  bellard: { name: "Fabrice Bellard", aliases: ["perf", "diagnostics"] },
  carmack: { name: "John Carmack", aliases: ["optimization", "latency"] },
  knuth: { name: "Donald Knuth", aliases: ["data", "schema", "algorithm"] },
  hightower: { name: "Kelsey Hightower", aliases: ["devops", "infrastructure"] },
  norvig: { name: "Peter Norvig", aliases: ["reasoner", "planning", "prometheus"] },
  hassabis: { name: "Demis Hassabis", aliases: ["context", "atlas"] },
  karpathy: { name: "Andrej Karpathy", aliases: ["knowledge", "oracle"] },
  "jim-simons": { name: "Jim Simons", aliases: ["memory", "librarian"] },
  "fei-fei-li-vision": {
    name: "Fei-Fei Li",
    aliases: ["fei-fei-li", "vision", "multimodal", "multimodal-looker"],
  },
  sutskever: { name: "Ilya Sutskever", aliases: ["strategy", "metis"] },
  torvalds: { name: "Linus Torvalds", aliases: ["critique", "momus", "pragmatist"] },
  operator: { name: "Operator", aliases: ["helper", "sisyphus-junior"] },
};

const legacyAgentRegistry: Record<string, { name: string; aliases?: string[] }> = {
  dijkstra: { name: "Edsger Dijkstra", aliases: ["reviewer", "correctness"] },
  turing: { name: "Alan Turing", aliases: ["architect"] },
  "berners-lee": { name: "Tim Berners-Lee", aliases: [] },
  hopper: { name: "Grace Hopper", aliases: ["explorer"] },
  cerf: { name: "Vint Cerf", aliases: ["coordinator"] },
  liskov: { name: "Barbara Liskov", aliases: ["abstraction"] },
  hinton: { name: "Geoffrey Hinton", aliases: ["pattern"] },
};

const aliasLookup = Object.entries({ ...activeAgentRegistry, ...legacyAgentRegistry }).reduce<
  Map<string, CanonicalAgentIdentity>
>((lookup, [id, entry]) => {
  const identity: CanonicalAgentIdentity = {
    id,
    name: entry.name,
    aliases: entry.aliases ?? [],
  };

  for (const alias of [id, entry.name, ...(entry.aliases ?? [])]) {
    lookup.set(alias.trim().toLowerCase(), identity);
  }

  return lookup;
}, new Map());

export const MANIFEST_AGENT_IDS = AGENT_IDS;

export const LEGACY_AGENT_IDS = Object.keys(legacyAgentRegistry) as Array<keyof typeof legacyAgentRegistry>;

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
