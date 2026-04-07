if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}

/**
 * Harbor → ADAS Adapter
 *
 * Converts AutoAgent Harbor benchmark tasks into ADAS DomainConfig + ForwardFn.
 * Harbor tasks define real Allura behaviors (Neo4j traversal, tenant isolation,
 * curator pipeline) that ADAS can hill-climb on.
 *
 * Harbor task format:
 *   task.toml        — metadata, timeout, pass_threshold
 *   instruction.md   — agent prompt / task description
 *   tests/test.py    — verifier that writes reward (0.0–1.0) to /logs/reward.txt
 *   tests/test.sh    — shell entrypoint for the verifier
 */

import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";
import type { DomainConfig, ForwardFn } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface HarborTaskScoring {
  method: string;
  pass_threshold: number;
}

export interface HarborTaskEnvironment {
  requires_neo4j?: boolean;
  requires_postgres?: boolean;
  group_id?: string;
}

export interface HarborTaskMeta {
  tags?: string[];
  invariants?: string[];
}

export interface HarborTaskManifest {
  /** Parsed from [task] section of task.toml */
  task: {
    name: string;
    description: string;
    version: string;
    domain: string;
    timeout_sec: number;
    max_turns: number;
  };
  scoring: HarborTaskScoring;
  environment: HarborTaskEnvironment;
  metadata?: HarborTaskMeta;
  /** Absolute path to the task directory */
  taskDir: string;
  /** Contents of instruction.md */
  instruction: string;
}

// =============================================================================
// TOML parser (minimal — only handles the Harbor task.toml schema)
// =============================================================================

function parseToml(content: string): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  let currentSection = "__root__";

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // Section header: [task], [scoring], etc.
    const sectionMatch = line.match(/^\[(\w+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) result[currentSection] = {};
      continue;
    }

    // Key = value
    const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const raw = kvMatch[2].trim();

    let value: unknown;

    if (raw === "true") value = true;
    else if (raw === "false") value = false;
    else if (/^\d+$/.test(raw)) value = parseInt(raw, 10);
    else if (/^\d+\.\d+$/.test(raw)) value = parseFloat(raw);
    else if (raw.startsWith('"') && raw.endsWith('"')) value = raw.slice(1, -1);
    else if (raw.startsWith("[")) {
      // Array of strings: ["a", "b", "c"]
      value = raw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    } else {
      value = raw;
    }

    if (!result[currentSection]) result[currentSection] = {};
    result[currentSection][key] = value;
  }

  return result;
}

// =============================================================================
// Load Harbor task from directory
// =============================================================================

/**
 * Load and parse a Harbor task directory into a HarborTaskManifest.
 *
 * @param taskDir - Absolute or relative path to the Harbor task directory
 */
export function loadHarborTask(taskDir: string): HarborTaskManifest {
  const absDir = resolve(taskDir);

  const tomlPath = join(absDir, "task.toml");
  if (!existsSync(tomlPath)) {
    throw new Error(`Harbor task.toml not found at: ${tomlPath}`);
  }

  const instructionPath = join(absDir, "instruction.md");
  if (!existsSync(instructionPath)) {
    throw new Error(`Harbor instruction.md not found at: ${instructionPath}`);
  }

  const tomlContent = readFileSync(tomlPath, "utf-8");
  const parsed = parseToml(tomlContent);

  const task = parsed["task"] ?? {};
  const scoring = parsed["scoring"] ?? {};
  const environment = parsed["environment"] ?? {};
  const metadata = parsed["metadata"];

  if (!task["name"]) throw new Error(`task.toml missing [task].name in ${absDir}`);
  if (!task["domain"]) throw new Error(`task.toml missing [task].domain in ${absDir}`);
  if (scoring["pass_threshold"] === undefined) {
    throw new Error(`task.toml missing [scoring].pass_threshold in ${absDir}`);
  }

  const instruction = readFileSync(instructionPath, "utf-8");

  return {
    task: {
      name: String(task["name"]),
      description: String(task["description"] ?? ""),
      version: String(task["version"] ?? "1.0.0"),
      domain: String(task["domain"]),
      timeout_sec: Number(task["timeout_sec"] ?? 30),
      max_turns: Number(task["max_turns"] ?? 10),
    },
    scoring: {
      method: String(scoring["method"] ?? "deterministic"),
      pass_threshold: Number(scoring["pass_threshold"]),
    },
    environment: {
      requires_neo4j: Boolean(environment["requires_neo4j"]),
      requires_postgres: Boolean(environment["requires_postgres"]),
      group_id: environment["group_id"] ? String(environment["group_id"]) : undefined,
    },
    metadata: metadata
      ? {
          tags: Array.isArray(metadata["tags"]) ? (metadata["tags"] as string[]) : [],
          invariants: Array.isArray(metadata["invariants"])
            ? (metadata["invariants"] as string[])
            : [],
        }
      : undefined,
    taskDir: absDir,
    instruction,
  };
}

// =============================================================================
// Convert Harbor manifest → ADAS DomainConfig
// =============================================================================

/**
 * Convert a HarborTaskManifest into an ADAS DomainConfig.
 *
 * The Harbor reward score (0.0–1.0) maps directly to ADAS accuracy.
 * Accuracy is weighted 0.80 so ADAS hill-climbs primarily on benchmark correctness.
 */
export function harborToDomainConfig(manifest: HarborTaskManifest): DomainConfig {
  return {
    domainId: `harbor:${manifest.task.name}`,
    name: manifest.task.name,
    description: manifest.task.description,
    // Single ground truth case: the full instruction is the "input",
    // pass_threshold string is the "expectedOutput" sentinel.
    // The ForwardFn returns the raw reward (0.0–1.0); compareResults
    // in the harness does numeric comparison via the HarborForwardFn wrapper.
    groundTruth: [
      {
        id: "harbor-run",
        input: manifest.instruction,
        expectedOutput: String(manifest.scoring.pass_threshold),
        criteria: `Harbor reward >= ${manifest.scoring.pass_threshold}`,
      },
    ],
    minAccuracy: manifest.scoring.pass_threshold,
    // Harbor score IS the accuracy signal — weight it heavily
    accuracyWeight: 0.8,
    costWeight: 0.1,
    latencyWeight: 0.1,
    maxLatency: manifest.task.timeout_sec * 1000,
  };
}

// =============================================================================
// Harbor ForwardFn — executes verifier and returns reward score
// =============================================================================

/**
 * Create a ForwardFn that runs the Harbor verifier (tests/test.py) and
 * returns the numeric reward written to /logs/reward.txt.
 *
 * The ForwardFn receives the agent's instruction text as input.
 * It spawns `python3 tests/test.py` inside the task directory so the
 * verifier can connect to the live DBs via environment variables.
 *
 * In CI / Docker environments, the verifier runs inside the Harbor container.
 * In local ADAS runs, it runs directly with the host Python + DB envvars.
 *
 * @param taskDir - Path to the Harbor task directory
 * @param timeoutMs - Maximum execution time (default: task.timeout_sec * 1000)
 */
export function createHarborForwardFn(
  taskDir: string,
  timeoutMs?: number
): ForwardFn<string, number> {
  const absDir = resolve(taskDir);
  const testScript = join(absDir, "tests", "test.py");

  if (!existsSync(testScript)) {
    throw new Error(`Harbor test.py not found at: ${testScript}`);
  }

  const logsDir = process.env["HARBOR_LOGS_DIR"] ?? "/tmp/harbor-logs";
  const rewardFile = join(logsDir, "reward.txt");

  return async (_input: string): Promise<number> => {
    // Ensure logs dir exists
    spawnSync("mkdir", ["-p", logsDir], { encoding: "utf-8" });

    // Remove stale reward file
    spawnSync("rm", ["-f", rewardFile], { encoding: "utf-8" });

    const result = spawnSync("python3", [testScript], {
      env: {
        ...process.env,
        LOGS_DIR: logsDir,
      },
      timeout: timeoutMs ?? 60_000,
      encoding: "utf-8",
    });

    if (result.stdout) process.stdout.write(`[harbor] ${result.stdout}`);
    if (result.stderr) process.stderr.write(`[harbor] ${result.stderr}`);

    // Read reward written by verifier
    if (!existsSync(rewardFile)) {
      console.warn(`[harbor-adapter] reward.txt not found after test run (${testScript})`);
      return 0.0;
    }

    const raw = readFileSync(rewardFile, "utf-8").trim();
    const score = parseFloat(raw);

    if (isNaN(score)) {
      console.warn(`[harbor-adapter] reward.txt contained non-numeric value: "${raw}"`);
      return 0.0;
    }

    return Math.min(1.0, Math.max(0.0, score));
  };
}

// =============================================================================
// Convenience: load + convert in one call
// =============================================================================

/**
 * Load a Harbor task directory and return both the DomainConfig and ForwardFn
 * ready to pass into the ADAS evaluation harness.
 */
export function loadHarborDomain(taskDir: string): {
  domain: DomainConfig;
  forwardFn: ForwardFn<string, number>;
  manifest: HarborTaskManifest;
} {
  const manifest = loadHarborTask(taskDir);
  const domain = harborToDomainConfig(manifest);
  const forwardFn = createHarborForwardFn(taskDir, manifest.task.timeout_sec * 1000);
  return { domain, forwardFn, manifest };
}
