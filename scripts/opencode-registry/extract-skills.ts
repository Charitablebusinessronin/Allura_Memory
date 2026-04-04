import { readFile, readdir } from "fs/promises";
import { join, basename } from "path";
import type { CanonicalSkill, SkillCategory, RequiredTool } from "../../src/lib/opencode-registry/types";

function parseFrontmatter(yaml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yaml.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

function mapSkillCategory(skillId: string): SkillCategory {
  if (skillId.startsWith("bmad-")) return "bmad";
  if (skillId.startsWith("wds-")) return "wds";
  if (skillId.includes("testarch") || skillId.includes("tea")) return "tea";
  if (skillId.includes("review")) return "review";
  if (skillId.includes("test")) return "testing";
  if (skillId.includes("deploy") || skillId.includes("ci")) return "deployment";
  return "context";
}

function extractRequiredTools(content: string): RequiredTool[] {
  const tools: RequiredTool[] = [];
  if (content.includes("Read(") || content.includes("read tool")) tools.push("read");
  if (content.includes("Write(") || content.includes("write tool")) tools.push("write");
  if (content.includes("Edit(") || content.includes("edit tool")) tools.push("edit");
  if (content.includes("Bash(") || content.includes("bash tool")) tools.push("bash");
  if (content.includes("Grep(") || content.includes("grep tool")) tools.push("grep");
  if (content.includes("Task(") || content.includes("task tool")) tools.push("task");
  return tools;
}

export async function extractSkills(projectRoot: string): Promise<CanonicalSkill[]> {
  const skills: CanonicalSkill[] = [];

  const skillsDir = join(projectRoot, ".opencode", "skills");
  const skillDirs = await readdir(skillsDir);

  for (const dir of skillDirs) {
    if (dir === ".DS_Store") continue;

    const skillPath = join(skillsDir, dir, "SKILL.md");
    try {
      const content = await readFile(skillPath, "utf-8");
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = frontmatterMatch ? parseFrontmatter(frontmatterMatch[1]) : {};

      skills.push({
        id: dir,
        displayName: frontmatter.name || dir,
        category: mapSkillCategory(dir),
        description: frontmatter.description,
        sourcePath: skillPath,
        requiredTools: extractRequiredTools(content),
        status: "active",
        agents: [],
        usageCount: 0,
      });
    } catch {
      // Skip directories without SKILL.md
    }
  }

  return skills;
}

if (import.meta.main) {
  const projectRoot = process.cwd();
  const skills = await extractSkills(projectRoot);
  console.log(JSON.stringify(skills, null, 2));
}
