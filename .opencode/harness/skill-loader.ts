/**
 * Skill Loader — Surgical Team Delegation
 *
 * Loads skills from AGENT-SKILLS-REGISTRY.md
 * Brooks decides which agent executes each skill.
 *
 * Pattern: Load → Propose to Brooks → Brooks decides routing
 */

import * as fs from "fs";
import * as path from "path";

export interface SkillMapping {
  [skillName: string]: {
    path: string;
    executor?: string; // Preferred executor, but Brooks overrides
    description: string;
  };
}

export interface SkillLoaderConfig {
  registryPath: string;
  skillsPath: string;
}

class SkillLoader {
  private registry: SkillMapping | null = null;
  private config: SkillLoaderConfig;

  constructor(config?: Partial<SkillLoaderConfig>) {
    this.config = {
      registryPath: path.join(
        process.cwd(),
        "_bmad-output/AGENT-SKILLS-REGISTRY.md"
      ),
      skillsPath: path.join(process.cwd(), ".opencode/skills"),
      ...config,
    };
  }

  /**
   * Load the registry from AGENT-SKILLS-REGISTRY.md
   * For now, parse manually (can be enhanced to parse Markdown frontmatter)
   */
  private loadRegistry(): SkillMapping {
    if (this.registry) return this.registry;

    // Hardcoded for now — in production, parse AGENT-SKILLS-REGISTRY.md
    this.registry = {
      "code-review": {
        path: ".opencode/skills/code-review/SKILL.md",
        executor: "oracle", // Prefers read-only consultant
        description: "Review code for architecture, patterns, edge cases",
      },
      "task-creator": {
        path: ".opencode/skills/task-creator/SKILL.md",
        description: "Create structured tasks with memory integration",
      },
      "task-update": {
        path: ".opencode/skills/task-update/SKILL.md",
        executor: "atlas", // Prefers orchestrator
        description: "Update task status and ownership",
      },
      "quick-update": {
        path: ".opencode/skills/quick-update/SKILL.md",
        executor: "scribe",
        description: "Quick documentation updates",
      },
      "allura-menu": {
        path: ".opencode/skills/allura-menu/SKILL.md",
        executor: "atlas",
        description: "Interactive menu for common workflows",
      },
      validate: {
        path: ".opencode/skills/validate-repo/SKILL.md",
        description: "Comprehensive repo validation",
      },
      optimize: {
        path: ".opencode/skills/optimize/SKILL.md",
        description: "Performance, security, edge case analysis",
      },
      debug: {
        path: ".opencode/skills/debug/SKILL.md",
        description: "Systematic debugging protocol",
      },
    };

    return this.registry;
  }

  /**
   * Propose a skill to Brooks
   * Brooks decides which agent executes it
   */
  proposeSkill(
    skillName: string
  ): {
    found: boolean;
    skill?: SkillMapping[string];
    proposal: string;
  } {
    const registry = this.loadRegistry();
    const skill = registry[skillName];

    if (!skill) {
      return {
        found: false,
        proposal: `Skill not found: ${skillName}. Available: ${Object.keys(registry).join(", ")}`,
      };
    }

    const preferredExecutor = skill.executor
      ? ` Suggested executor: @${skill.executor}`
      : "";

    const proposal = `
🎯 Skill Proposal

Skill: ${skillName}
Description: ${skill.description}
Location: ${skill.path}${preferredExecutor}

Brooks, who should execute this?
→ skill-load ${skillName} --executor oracle
`;

    return {
      found: true,
      skill,
      proposal,
    };
  }

  /**
   * Load a skill for a specific executor
   * Routes to that agent
   */
  loadSkill(
    skillName: string,
    executor: string = "brooks"
  ): {
    success: boolean;
    instruction: string;
  } {
    const registry = this.loadRegistry();
    const skill = registry[skillName];

    if (!skill) {
      return {
        success: false,
        instruction: `Skill not found: ${skillName}`,
      };
    }

    // Verify the skill file exists
    const skillPath = path.join(process.cwd(), skill.path);
    if (!fs.existsSync(skillPath)) {
      return {
        success: false,
        instruction: `Skill file not found: ${skill.path}`,
      };
    }

    // Return instruction for harness to route to agent
    return {
      success: true,
      instruction: `Load ${skillName} → route to @${executor}`,
    };
  }

  /**
   * List all available skills
   */
  listSkills(): string {
    const registry = this.loadRegistry();
    let output = "# Available Skills\n\n";

    Object.entries(registry).forEach(([name, skill]) => {
      output += `## ${name}\n`;
      output += `${skill.description}\n`;
      if (skill.executor) {
        output += `Preferred executor: @${skill.executor}\n`;
      }
      output += `\n`;
    });

    return output;
  }

  /**
   * Get skill metadata (for CLI inspection)
   */
  getSkill(skillName: string): SkillMapping[string] | null {
    const registry = this.loadRegistry();
    return registry[skillName] || null;
  }
}

// Export singleton
export const skillLoader = new SkillLoader();

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const skillName = args[1];

  switch (command) {
    case "propose":
      if (!skillName) {
        console.log("Usage: skill-loader propose <skill-name>");
        break;
      }
      const proposal = skillLoader.proposeSkill(skillName);
      console.log(proposal.proposal);
      break;

    case "load":
      if (!skillName) {
        console.log("Usage: skill-loader load <skill-name> [--executor name]");
        break;
      }
      const executor = args[args.indexOf("--executor") + 1] || "brooks";
      const load = skillLoader.loadSkill(skillName, executor);
      console.log(load.instruction);
      break;

    case "list":
      console.log(skillLoader.listSkills());
      break;

    case "info":
      if (!skillName) {
        console.log("Usage: skill-loader info <skill-name>");
        break;
      }
      const info = skillLoader.getSkill(skillName);
      console.log(JSON.stringify(info, null, 2));
      break;

    default:
      console.log(
        "Usage: skill-loader [propose|load|list|info] [skill-name] [options]"
      );
  }
}
