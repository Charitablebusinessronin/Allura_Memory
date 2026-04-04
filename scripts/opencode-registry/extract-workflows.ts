import { glob } from "glob";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CanonicalWorkflow, WorkflowModule, WorkflowPhase } from "../../src/lib/opencode-registry/types";

interface BMadHelpEntry {
  module: string;
  skill: string;
  displayName: string;
  menuCode: string;
  description: string;
  action: string;
  args: string;
  phase: string;
  after: string;
  before: string;
  required: string;
  outputLocation: string;
  outputs: string;
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

function parseCSV(content: string): BMadHelpEntry[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const entries: BMadHelpEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    let entry: BMadHelpEntry;

    if (values.length === 13) {
      entry = {
        module: values[0],
        skill: values[1],
        displayName: values[2],
        menuCode: values[3],
        description: values[4],
        action: values[5],
        args: values[6],
        phase: values[7],
        after: values[8],
        before: values[9],
        required: values[10],
        outputLocation: values[11],
        outputs: values[12],
      };
    } else {
      entry = {
        module: values[0],
        skill: values[1],
        displayName: values[2],
        menuCode: values[3],
        description: values[4],
        action: values[5],
        args: "",
        phase: values[6],
        after: values[7],
        before: values[8],
        required: values[9],
        outputLocation: values[10],
        outputs: values[11],
      };
    }

    entries.push(entry);
  }

  return entries;
}

function derivePhase(phaseStr?: string): WorkflowPhase | undefined {
  if (!phaseStr) return undefined;
  const p = phaseStr.toLowerCase();
  if (p === "anytime" || p === "0-learning") return undefined;
  if (p === "1-analysis") return "1-analysis";
  if (p === "2-planning") return "2-planning";
  if (p === "3-solutioning") return "3-solutioning";
  if (p === "4-implementation") return "4-implementation";
  if (p === "0-wds-pitch") return "0-wds-pitch";
  if (p === "1-wds-strategy") return "1-wds-strategy";
  if (p === "2-wds-design") return "2-wds-design";
  if (p === "3-wds-build") return "3-wds-build";
  return undefined;
}

export async function extractWorkflows(projectRoot: string): Promise<CanonicalWorkflow[]> {
  const workflows: CanonicalWorkflow[] = [];

  const helpFiles = await glob("_bmad/*/module-help.csv", {
    cwd: projectRoot,
    absolute: true,
  });

  for (const helpPath of helpFiles) {
    const content = await readFile(helpPath, "utf-8");
    const entries = parseCSV(content);

    const moduleName = helpPath.split("/").slice(-2, -1)[0] as WorkflowModule;

    for (const entry of entries) {
      workflows.push({
        code: entry.menuCode,
        name: entry.displayName,
        module: entry.module ? (moduleName) : moduleName,
        phase: derivePhase(entry.phase),
        description: entry.description || undefined,
        agent: entry.skill || undefined,
        required: entry.required === "true",
        sourcePath: helpPath,
        status: "active",
      });
    }
  }

  return workflows;
}

// CLI entry point
if (import.meta.main) {
  const projectRoot = process.cwd();
  const workflows = await extractWorkflows(projectRoot);
  console.log(JSON.stringify(workflows, null, 2));
}
