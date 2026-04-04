import { describe, it, expect } from "vitest";
import { extractWorkflows } from "../../scripts/opencode-registry/extract-workflows";
import { join } from "path";

describe("extractWorkflows", () => {
  const projectRoot = join(process.cwd());

  it("extracts at least 30 workflows", async () => {
    const workflows = await extractWorkflows(projectRoot);
    expect(workflows).toBeInstanceOf(Array);
    expect(workflows.length).toBeGreaterThanOrEqual(30);
  });

  it("includes known workflow code CP (Create PRD)", async () => {
    const workflows = await extractWorkflows(projectRoot);
    const createPrd = workflows.find((w) => w.code === "CP");
    expect(createPrd).toBeDefined();
    expect(createPrd?.name).toBe("Create PRD");
    expect(createPrd?.required).toBe(true);
  });

  it("has workflows from multiple modules (bmm, tea, wds, bmb, core)", async () => {
    const workflows = await extractWorkflows(projectRoot);
    const modules = new Set(workflows.map((w) => w.module));
    expect(modules.has("bmm")).toBe(true);
    expect(modules.has("tea")).toBe(true);
    expect(modules.has("wds")).toBe(true);
    expect(modules.has("bmb")).toBe(true);
    expect(modules.has("core")).toBe(true);
  });

  it("each workflow has required fields populated", async () => {
    const workflows = await extractWorkflows(projectRoot);
    expect(workflows.length).toBeGreaterThan(0);

    for (const wf of workflows) {
      expect(wf.code).toBeDefined();
      expect(typeof wf.code).toBe("string");
      expect(wf.code.length).toBeGreaterThan(0);

      expect(wf.sourcePath).toBeDefined();
      expect(typeof wf.sourcePath).toBe("string");
      expect(wf.sourcePath).toContain("module-help.csv");

      expect(wf.status).toBe("active");

      expect(wf.module).toBeDefined();
      expect(["bmm", "tea", "wds", "bmb", "core"]).toContain(wf.module);
    }
  });

  it("derives phases correctly for known workflows", async () => {
    const workflows = await extractWorkflows(projectRoot);
    const createPrd = workflows.find((w) => w.code === "CP");
    expect(createPrd?.phase).toBe("2-planning");

    const sprintPlanning = workflows.find((w) => w.code === "SP" && w.module === "bmm");
    expect(sprintPlanning?.phase).toBe("4-implementation");

    const wdsDesign = workflows.find((w) => w.code === "OS");
    expect(wdsDesign?.phase).toBe("2-wds-design");
  });

  it("marks required workflows correctly", async () => {
    const workflows = await extractWorkflows(projectRoot);
    const requiredWorkflows = workflows.filter((w) => w.required === true);
    expect(requiredWorkflows.length).toBeGreaterThan(0);

    // CP (Create PRD) should be required
    const createPrd = workflows.find((w) => w.code === "CP");
    expect(createPrd?.required).toBe(true);

    // CA (Create Architecture) should be required
    const createArch = workflows.find((w) => w.code === "CA");
    expect(createArch?.required).toBe(true);
  });
});
