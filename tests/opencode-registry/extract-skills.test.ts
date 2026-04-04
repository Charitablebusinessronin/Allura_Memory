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
    const bmadSkills = skills.filter((s) => s.id.startsWith("bmad-"));
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

  it("extracts displayName from frontmatter or falls back to id", async () => {
    const skills = await extractSkills(projectRoot);
    for (const skill of skills) {
      expect(skill.displayName).toBeDefined();
      expect(typeof skill.displayName).toBe("string");
      expect(skill.displayName!.length).toBeGreaterThan(0);
    }
  });
});
