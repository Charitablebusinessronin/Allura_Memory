import { describe, it, expect } from "vitest";
import { extractCommands } from "../../scripts/opencode-registry/extract-commands";
import { join } from "path";

describe("extractCommands", () => {
  const projectRoot = join(process.cwd());

  it("returns a non-empty array of commands", async () => {
    const commands = await extractCommands(projectRoot);
    expect(commands).toBeInstanceOf(Array);
    expect(commands.length).toBeGreaterThan(0);
  });

  it("extracts at least 15 commands", async () => {
    const commands = await extractCommands(projectRoot);
    expect(commands.length).toBeGreaterThanOrEqual(15);
  });

  it("includes known commands like context, test, bmad, commit", async () => {
    const commands = await extractCommands(projectRoot);
    const ids = commands.map((c) => c.id);

    expect(ids).toContain("context");
    expect(ids).toContain("test");
    expect(ids).toContain("bmad");
    expect(ids).toContain("commit");
  });

  it("each command has required fields populated", async () => {
    const commands = await extractCommands(projectRoot);

    commands.forEach((cmd) => {
      expect(cmd.id).toBeDefined();
      expect(cmd.sourcePath).toBeDefined();
      expect(cmd.status).toBeDefined();
      expect(cmd.skills).toBeInstanceOf(Array);
      expect(cmd.agents).toBeInstanceOf(Array);
    });
  });

  it("each command has a valid category", async () => {
    const commands = await extractCommands(projectRoot);
    const validCategories = [
      "memory",
      "knowledge",
      "tenant",
      "audit",
      "agent",
      "sync",
    ];

    commands.forEach((cmd) => {
      expect(validCategories).toContain(cmd.category);
    });
  });

  it("maps context commands to knowledge category", async () => {
    const commands = await extractCommands(projectRoot);
    const contextCmd = commands.find((c) => c.id === "context");
    expect(contextCmd).toBeDefined();
    expect(contextCmd?.category).toBe("knowledge");
  });

  it("maps test commands to audit category", async () => {
    const commands = await extractCommands(projectRoot);
    const testCmd = commands.find((c) => c.id === "test");
    expect(testCmd).toBeDefined();
    expect(testCmd?.category).toBe("audit");
  });

  it("maps bmad commands to agent category", async () => {
    const commands = await extractCommands(projectRoot);
    const bmadCmd = commands.find((c) => c.id === "bmad");
    expect(bmadCmd).toBeDefined();
    expect(bmadCmd?.category).toBe("agent");
  });

  it("sets status to active on all commands", async () => {
    const commands = await extractCommands(projectRoot);
    commands.forEach((cmd) => {
      expect(cmd.status).toBe("active");
    });
  });

  it("HITL detection works — commands without HITL markers return false", async () => {
    const commands = await extractCommands(projectRoot);
    const commitCmd = commands.find((c) => c.id === "commit");
    expect(commitCmd).toBeDefined();
    expect(commitCmd?.requiresHitl).toBe(false);
  });

  it("extracts intent from frontmatter description or title", async () => {
    const commands = await extractCommands(projectRoot);
    const contextCmd = commands.find((c) => c.id === "context");
    expect(contextCmd?.intent).toBeDefined();
    expect(contextCmd?.intent?.length).toBeGreaterThan(0);
  });

  it("includes nested commands (openagents, prompt-engineering)", async () => {
    const commands = await extractCommands(projectRoot);
    const ids = commands.map((c) => c.id);

    expect(ids).toContain("check-context-deps");
    expect(ids).toContain("prompt-enhancer");
  });
});
