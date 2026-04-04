import { glob } from "glob";
import { readFile } from "fs/promises";
import { basename } from "path";
import type { CanonicalCommand, CommandCategory } from "../../src/lib/opencode-registry/types";

function parseFrontmatter(yaml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = yaml.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      let value = match[2].trim();
      if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
      ) {
        value = value.slice(1, -1);
      }
      result[match[1]] = value;
    }
  }
  return result;
}

function mapCommandCategory(cmdName: string): CommandCategory {
  if (cmdName.includes("memory") || cmdName.includes("sync")) return "sync";
  if (cmdName.includes("context")) return "knowledge";
  if (cmdName.includes("test")) return "audit";
  if (cmdName.includes("bmad") || cmdName.includes("agent")) return "agent";
  return "memory";
}

export async function extractCommands(
  projectRoot: string,
): Promise<CanonicalCommand[]> {
  const commands: CanonicalCommand[] = [];

  const commandFiles = await glob(".opencode/command/**/*.md", {
    cwd: projectRoot,
    absolute: true,
  });

  for (const cmdPath of commandFiles) {
    const cmdName = basename(cmdPath, ".md");
    const content = await readFile(cmdPath, "utf-8");

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch
      ? parseFrontmatter(frontmatterMatch[1])
      : {};
    const titleMatch = content.match(/^#\s+(.+)$/m);

    commands.push({
      id: cmdName,
      intent: frontmatter.description || titleMatch?.[1] || cmdName,
      category: mapCommandCategory(cmdName),
      sourcePath: cmdPath,
      inputSchema: frontmatter.inputSchema,
      outputSchema: frontmatter.outputSchema,
      requiresHitl:
        content.includes("HITL") || content.includes("human-in-the-loop"),
      status: "active",
      skills: [],
      agents: [],
    });
  }

  return commands;
}

// CLI entry point
if (import.meta.main) {
  const projectRoot = process.cwd();
  const commands = await extractCommands(projectRoot);
  console.log(JSON.stringify(commands, null, 2));
}
