import { describe, it, expect } from "vitest";
import { extractSkills } from "../../scripts/opencode-registry/extract-skills";
import { join } from "path";

describe("extractSkills", () => {
  const projectRoot = join(process.cwd());

  it("extracts at least 50 skills", async () => {
    const skills = await extractSkills(projectRoot);
    expect(skills).toBeInstanceOf(Array);
    expect(skills.length).toBeGreaterThanOrEqual(50);
  });

  it("includes known skill bmad-party-mode", async () => {
    const skills = await extractSkills(projectRoot);
    const partyMode = skills.find((s) => s.id === "bmad-party-mode");
    expect(partyMode).toBeDefined();
    expect(partyMode?.category).toBe("bmad");
    expect(partyMode?.status).toBe("active");
  });

  it("includes known skill bmad-brainstorming", async () => {
    const skills = await extractSkills(projectRoot);
    const brainstorming = skills.find((s) => s.id === "bmad-brainstorming");
    expect(brainstorming).toBeDefined();
    expect(brainstorming?.category).toBe("bmad");
    expect(brainstorming?.status).toBe("active");
  });

  it("populates required fields on every skill", async () => {
    const skills = await extractSkills(projectRoot);
    expect(skills.length).toBeGreaterThan(0);

    for (const skill of skills) {
      expect(skill.id).toBeDefined();
      expect(typeof skill.id).toBe("string");
      expect(skill.id.length).toBeGreaterThan(0);

      expect(skill.sourcePath).toBeDefined();
      expect(typeof skill.sourcePath).toBe("string");
      expect(skill.sourcePath).toContain("SKILL.md");

      expect(skill.status).toBe("active");

      expect(Array.isArray(skill.agents)).toBe(true);

      expect(skill.requiredTools).toBeDefined();
      expect(Array.isArray(skill.requiredTools)).toBe(true);
    }
  });

  it("categorizes bmad skills correctly", async () => {
    const skills = await extractSkills(projectRoot);
    // Exclude tea/testarch skills which start with "bmad-" but should be "tea"
    const bmadSkills = skills.filter(
      (s) => s.id.startsWith("bmad-") && !s.id.startsWith("bmad-testarch") && !s.id.startsWith("bmad-tea")
    );
    expect(bmadSkills.length).toBeGreaterThan(0);
    bmadSkills.forEach((s) => {
      expect(s.category).toBe("bmad");
    });
  });

  it("categorizes wds skills correctly", async () => {
    const skills = await extractSkills(projectRoot);
    const wdsSkills = skills.filter((s) => s.id.startsWith("wds-"));
    expect(wdsSkills.length).toBeGreaterThan(0);
    wdsSkills.forEach((s) => {
      expect(s.category).toBe("wds");
    });
  });

  it("categorizes tea/testarch skills as 'tea' not 'bmad'", async () => {
    const skills = await extractSkills(projectRoot);
    const teaSkills = skills.filter(
      (s) => s.id.startsWith("bmad-testarch") || s.id.startsWith("bmad-tea")
    );
    expect(teaSkills.length).toBeGreaterThan(0);
    teaSkills.forEach((s) => {
      expect(s.category).toBe("tea");
    });
  });

  it("detects required tools from skill content", async () => {
    const skills = await extractSkills(projectRoot);
    // At least some skills should have detected tools
    const skillsWithTools = skills.filter((s) => (s.requiredTools?.length ?? 0) > 0);
    expect(skillsWithTools.length).toBeGreaterThan(0);
    // Verify detected tools are valid enum values
    const validTools = ["read", "write", "edit", "bash", "grep", "task"];
    for (const skill of skillsWithTools) {
      for (const tool of skill.requiredTools!) {
        expect(validTools).toContain(tool);
      }
    }
  });

  it("strips YAML quotes from frontmatter descriptions", async () => {
    const skills = await extractSkills(projectRoot);
    for (const skill of skills) {
      if (skill.description) {
        // Should not start/end with YAML single or double quotes
        // (but escaped quotes inside the string are fine)
        expect(skill.description).not.toMatch(/^'[^']*'$/);
        expect(skill.description).not.toMatch(/^"[^"]*"$/);
      }
    }
  });

  it("extracts displayName from frontmatter or falls back to id", async () => {
    const skills = await extractSkills(projectRoot);
    for (const skill of skills) {
      expect(skill.displayName).toBeDefined();
      expect(typeof skill.displayName).toBe("string");
      expect(skill.displayName!.length).toBeGreaterThan(0);
    }
  });
});
