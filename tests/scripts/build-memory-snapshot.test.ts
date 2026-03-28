import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fsPromises } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  SNAPSHOT_SCHEMA_VERSION,
  type SnapshotBuildStats,
  type SnapshotEntry,
  type SnapshotMetadata,
} from "../../scripts/helpers/snapshot-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_SOURCE = path.resolve(__dirname, "../fixtures/docs-sample/docs");

interface CliResult {
  entries: SnapshotEntry[];
  metadata: SnapshotMetadata;
  stats?: SnapshotBuildStats;
}

interface CliModule {
  runSnapshotBuilderCli: (args?: string[]) => Promise<CliResult>;
}

async function runCli(args: string[]) {
  const module = await import("../../scripts/build-memory-snapshot");
  const typedModule = module as CliModule;
  if (typeof typedModule.runSnapshotBuilderCli !== "function") {
    throw new Error("runSnapshotBuilderCli export missing");
  }

  return typedModule.runSnapshotBuilderCli(args);
}

describe("build-memory-snapshot CLI", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(path.join(tmpdir(), "snapshot-test-"));
  });

  afterEach(async () => {
    if (outputDir) {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("writes snapshot and metadata for fixture docs", async () => {
    await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
      "--group-id",
      "test-group",
    ]);

    const snapshotPath = path.join(outputDir, "index.json");
    const metadataPath = path.join(outputDir, "index.meta.json");

    const snapshotContent = await readFile(snapshotPath, "utf-8");
    const metadataContent = await readFile(metadataPath, "utf-8");

    const snapshotEntries = JSON.parse(snapshotContent);
    expect(Array.isArray(snapshotEntries)).toBe(true);
    expect(snapshotEntries.length).toBeGreaterThan(0);
    expect(snapshotEntries[0]).toHaveProperty("title");

    const metadata = JSON.parse(metadataContent);
    expect(metadata.groupId).toBe("test-group");
    expect(metadata.sourceDirs).toContain(FIXTURE_SOURCE);
    expect(typeof metadata.generatedAt).toBe("string");
  });

  it("extracts summaries from the first paragraph of each doc", async () => {
    const result = await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    const overviewEntry = result.entries.find((entry) => entry.path.endsWith("README.md"));

    expect(overviewEntry?.summary).toContain("Roninmemory is a memory orchestration platform");
    expect(overviewEntry?.summary.startsWith("Roninmemory")).toBe(true);
  });

  it("truncates summaries according to the requested max summary length", async () => {
    const result = await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
      "--max-summary-chars",
      "20",
    ]);

    const overviewEntry = result.entries.find((entry) => entry.path.endsWith("README.md"));

    expect(overviewEntry?.summary).toBe("Roninmemory is a mem");
    expect(overviewEntry?.summary.length).toBe(20);
  });

  it("supports the legacy --summary-length flag as an alias", async () => {
    const result = await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
      "--summary-length",
      "25",
    ]);

    const overviewEntry = result.entries.find((entry) => entry.path.endsWith("README.md"));

    expect(overviewEntry?.summary.length).toBe(25);
  });

  it("skips unchanged files when metadata indicates no updates", async () => {
    await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    const rerun = await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    expect(rerun.stats?.skipped).toBeGreaterThan(0);
    expect(rerun.stats?.added).toBe(0);
    expect(rerun.stats?.updated).toBe(0);
  });

  it("avoids re-reading doc content for unchanged files in incremental mode", async () => {
    await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    const readSpy = vi.spyOn(fsPromises, "readFile");
    try {
      await runCli([
        "--source",
        FIXTURE_SOURCE,
        "--output",
        outputDir,
      ]);

      const docReads = readSpy.mock.calls.filter(([target]) => {
        return typeof target === "string" && target.startsWith(FIXTURE_SOURCE);
      });

      expect(docReads.length).toBe(0);
    } finally {
      readSpy.mockRestore();
    }
  });

  it("reports added file counts via stats on initial run", async () => {
    const result = await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    expect(result.stats?.added).toBe(result.entries.length);
    expect(result.stats?.scanned).toBe(result.entries.length);
  });

  it("throws a descriptive error when a source directory is missing", async () => {
    await expect(
      runCli([
        "--source",
        path.join(FIXTURE_SOURCE, "missing"),
        "--output",
        outputDir,
      ]),
    ).rejects.toThrow(/source directory/i);
  });

  it("forces a full rebuild when snapshot metadata schema mismatches", async () => {
    await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    const metadataPath = path.join(outputDir, "index.meta.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));
    metadata.schemaVersion = SNAPSHOT_SCHEMA_VERSION + 1;
    await fsPromises.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");

    const rerun = await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    expect(rerun.stats?.added).toBe(rerun.entries.length);
    expect(rerun.stats?.skipped).toBe(0);
  });

  it("reuses cached hashes when metadata hash entries drift but docs are unchanged", async () => {
    await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    const metadataPath = path.join(outputDir, "index.meta.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));
    const firstPath = Object.keys(metadata.fileHashes)[0];
    metadata.fileHashes[firstPath] = "sha256:deadbeef";
    await fsPromises.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");

    const rerun = await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
    ]);

    expect(rerun.stats?.skipped).toBe(rerun.entries.length);
    expect(rerun.stats?.updated).toBe(0);
  });

  it("applies priority overrides for matching doc paths", async () => {
    const overviewOverride = path
      .relative(process.cwd(), path.join(FIXTURE_SOURCE, "roninmemory", "README.md"))
      .split(path.sep)
      .join("/");

    const result = await runCli([
      "--source",
      FIXTURE_SOURCE,
      "--output",
      outputDir,
      "--priority-override",
      `${overviewOverride}=7`,
    ]);

    const overviewEntry = result.entries.find((entry) =>
      entry.relativePath.endsWith("README.md"),
    );
    const blueprintEntry = result.entries.find((entry) =>
      entry.relativePath.endsWith("BLUEPRINT.md"),
    );

    expect(overviewEntry?.priority).toBe(7);
    expect(blueprintEntry?.priority).toBe(0);
  });
});
