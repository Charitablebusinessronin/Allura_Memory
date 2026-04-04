import { readFile } from "fs/promises";
import { join } from "path";
import type { CanonicalAgent, AgentType } from "../../src/lib/opencode-registry/types";

interface AgentMetadataEntry {
  id: string;
  name: string;
  category?: string;
  type?: string;
  persona?: { name?: string };
  dependencies?: string[];
}

interface AgentMetadataFile {
  agents: Record<string, AgentMetadataEntry>;
}

function mapOpenCodeType(type?: string, category?: string): AgentType {
  if (category?.includes("subagents")) return "Specialist";
  if (type === "agent") return "OpenAgent";
  return "Worker";
}

function mapBMadType(name: string): AgentType {
  if (name.startsWith("wds-")) return "WDS Persona";
  return "BMad Persona";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function extractAgents(projectRoot: string): Promise<CanonicalAgent[]> {
  const agents: CanonicalAgent[] = [];

  const metadataPath = join(projectRoot, ".opencode/config/agent-metadata.json");
  const metadataContent = await readFile(metadataPath, "utf-8");
  const metadata: AgentMetadataFile = JSON.parse(metadataContent);

  for (const [id, agent] of Object.entries(metadata.agents)) {
    agents.push({
      id,
      displayName: agent.persona?.name || agent.name,
      persona: agent.persona?.name,
      type: mapOpenCodeType(agent.type, agent.category),
      category: agent.category as CanonicalAgent["category"],
      status: "active",
      sourcePath: metadataPath,
      skills: agent.dependencies?.filter((d) => d.startsWith("skill:")) || [],
      commands: [],
      workflows: [],
      configFile: metadataPath,
      groupId: "roninmemory",
    });
  }

  const manifestPath = join(projectRoot, "_bmad/_config/agent-manifest.csv");
  const manifestContent = await readFile(manifestPath, "utf-8");
  const lines = manifestContent.trim().split("\n");
  if (lines.length < 2) return agents;

  const headers = parseCSVLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });

    agents.push({
      id: row.name,
      displayName: row.displayName || row.name,
      persona: row.displayName,
      type: mapBMadType(row.name),
      category: row.module as CanonicalAgent["category"],
      status: "active",
      sourcePath: join(projectRoot, row.path || ""),
      skills: [],
      commands: [],
      workflows: [],
      configFile: manifestPath,
      groupId: "roninmemory",
    });
  }

  return agents;
}

if (import.meta.main) {
  const projectRoot = process.cwd();
  const agents = await extractAgents(projectRoot);
  console.log(JSON.stringify(agents, null, 2));
}
