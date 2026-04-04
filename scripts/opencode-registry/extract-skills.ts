import { glob } from "glob";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import type { CanonicalSkill, SkillCategory, RequiredTool } from "../../src/lib/opencode-registry/types";

function parseFrontmatter(yaml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = yaml.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      // Strip YAML quotes (single and double)
      let value = match[2].trim();
      if ((value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      result[match[1]] = value;
    }
  }
  return result;
}

function mapSkillCategory(skillId: string): SkillCategory {
  // Check tea/testarch BEFORE bmad to avoid short-circuit
  if (skillId.startsWith("bmad-testarch") || skillId.startsWith("bmad-tea")) return "tea";
  if (skillId.startsWith("bmad-")) return "bmad";
  if (skillId.startsWith("wds-")) return "wds";
  if (skillId.includes("review")) return "review";
  if (skillId.includes("test")) return "testing";
  if (skillId.includes("deploy") || skillId.includes("ci")) return "deployment";
  return "context";
}

function extractRequiredTools(content: string): RequiredTool[] {
  const tools: RequiredTool[] = [];
  // Match tool references in various formats:
  // - `Read` tool, Read tool, use Read, use the Read tool
  // - Read(, Read(, tool: Read
  const toolPatterns: Array<[RegExp, RequiredTool]> = [
    [/\bRead\b|\bread tool\b/i, "read"],
    [/\bWrite\b|\bwrite tool\b/i, "write"],
    [/\bEdit\b|\bedit tool\b/i, "edit"],
    [/\bBash\b|\bbash tool\b/i, "bash"],
    [/\bGrep\b|\bgrep tool\b/i, "grep"],
    [/\bTask\b|\btask tool\b/i, "task"],
  ];

  for (const [pattern, tool] of toolPatterns) {
    if (pattern.test(content)) {
      tools.push(tool);
    }
  }
  return tools;
}

export async function extractSkills(projectRoot: string): Promise<CanonicalSkill[]> {
  const skills: CanonicalSkill[] = [];

  const skillFiles = await glob(".opencode/skills/*/SKILL.md", {
    cwd: projectRoot,
    absolute: true,
  });

  for (const skillPath of skillFiles) {
    const skillDir = basename(join(skillPath, ".."));
    const content = await readFile(skillPath, "utf-8");

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? parseFrontmatter(frontmatterMatch[1]) : {};

    skills.push({
      id: skillDir,
      displayName: frontmatter.name || skillDir,
      category: mapSkillCategory(skillDir),
      description: frontmatter.description,
      sourcePath: skillPath,
      requiredTools: extractRequiredTools(content),
      status: "active",
      agents: [],
      usageCount: 0,
    });
  }

  return skills;
}

// CLI entry point
if (import.meta.main) {
  const projectRoot = process.cwd();
  const skills = await extractSkills(projectRoot);
  console.log(JSON.stringify(skills, null, 2));
}
