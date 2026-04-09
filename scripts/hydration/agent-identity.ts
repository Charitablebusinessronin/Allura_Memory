import fs from "node:fs";
import path from "node:path";

export const DEFAULT_NOTION_GROUP_ID = "allura-roninmemory";

interface AgentMetadataEntry {
  id: string;
  name: string;
  aliases?: string[];
}

interface AgentMetadataFile {
  agents?: Record<string, AgentMetadataEntry>;
}

export type AgentMetadataLookup = Record<string, AgentMetadataEntry>;

function normalizeAgentKey(agentId: string): string {
  return agentId.trim().toLowerCase();
}

function getAgentMetadataPath(baseDir: string): string {
  return path.join(baseDir, ".opencode", "config", "agent-metadata.json");
}

export function deriveAgentIdFromFilePath(baseDir: string, filePath: string): string {
  const agentDir = path.join(baseDir, ".opencode", "agent");
  const relativePath = path.relative(agentDir, filePath);
  const parsedPath = path.parse(relativePath);

  return parsedPath.name;
}

export function loadAgentMetadataLookup(baseDir: string): AgentMetadataLookup {
  const metadataPath = getAgentMetadataPath(baseDir);
  const metadataContent = fs.readFileSync(metadataPath, "utf-8");
  const parsedMetadata = JSON.parse(metadataContent) as AgentMetadataFile;

  return parsedMetadata.agents ?? {};
}

function resolveMetadataByAlias(
  agentId: string,
  metadataLookup: AgentMetadataLookup,
): AgentMetadataEntry | undefined {
  const normalizedAgentId = normalizeAgentKey(agentId);

  return Object.values(metadataLookup).find((entry) => {
    const aliases = [entry.id, entry.name, ...(entry.aliases ?? [])];
    return aliases.some((alias) => normalizeAgentKey(alias) === normalizedAgentId);
  });
}

function titleCaseFromId(agentId: string): string {
  return agentId
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function resolveAgentIdentity(
  baseDir: string,
  filePath: string,
  metadataLookup: AgentMetadataLookup,
  fallbackName?: string,
): AgentMetadataEntry {
  const agentId = deriveAgentIdFromFilePath(baseDir, filePath);
  const metadataEntry = resolveMetadataByAlias(agentId, metadataLookup);

  if (metadataEntry) {
    return metadataEntry;
  }

  return {
    id: agentId,
    name: fallbackName || titleCaseFromId(agentId),
  };
}
