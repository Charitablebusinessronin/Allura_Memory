import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_SOURCE_DIRS,
  DEFAULT_SUMMARY_LENGTH,
  SNAPSHOT_DEFAULT_OUTPUT_DIR,
  SNAPSHOT_JSON_FILENAME,
  SNAPSHOT_METADATA_FILENAME,
  SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_FILE_SUFFIX,
  type SnapshotBuildArtifacts,
  type SnapshotBuildOptions,
  type SnapshotBuildStats,
  type SnapshotEntry,
  type SnapshotFileHashes,
  type SnapshotMetadata,
  SnapshotBuildError,
} from "./helpers/snapshot-types";

interface InternalBuildOptions extends SnapshotBuildOptions {
  cwd: string;
}

type SnapshotEntryMap = Record<string, SnapshotEntry>;

export async function runSnapshotBuilderCli(argv?: string[]): Promise<SnapshotBuildArtifacts> {
  const start = Date.now();
  const options = parseArgs(argv ?? process.argv.slice(2), process.cwd());
  const resolvedOutputDir = options.outputDir;

  const previousMetadata = options.incremental
    ? await readPreviousMetadata(resolvedOutputDir)
    : undefined;
  const metadataCompatible =
    previousMetadata?.schemaVersion === SNAPSHOT_SCHEMA_VERSION;

  if (options.incremental && previousMetadata && !metadataCompatible) {
    console.warn(
      `Snapshot metadata schema mismatch (found v${previousMetadata.schemaVersion}, expected v${SNAPSHOT_SCHEMA_VERSION}). Running full rebuild.`,
    );
  }

  const canUseIncrementalCache = options.incremental && metadataCompatible;
  const previousHashes = canUseIncrementalCache ? previousMetadata.fileHashes : {};
  const previousEntries = canUseIncrementalCache
    ? await readPreviousSnapshotEntries(resolvedOutputDir)
    : {};

  await fs.mkdir(resolvedOutputDir, { recursive: true });
  const collectedFiles = await collectMarkdownFiles(options.sourceDirs);
  const { entries, stats } = await buildEntries(
    collectedFiles,
    options,
    previousHashes,
    previousEntries,
  );
  const metadata = buildMetadata(entries, options);

  stats.durationMs = Date.now() - start;

  await writeJson(path.join(resolvedOutputDir, SNAPSHOT_JSON_FILENAME), entries);
  await writeJson(path.join(resolvedOutputDir, SNAPSHOT_METADATA_FILENAME), metadata);

  return { entries, metadata, stats };
}

function parseArgs(args: string[], cwd: string): InternalBuildOptions {
  const options: InternalBuildOptions = {
    sourceDirs: [],
    outputDir: path.resolve(cwd, SNAPSHOT_DEFAULT_OUTPUT_DIR),
    incremental: true,
    groupId: "roninmemory",
    summaryLength: DEFAULT_SUMMARY_LENGTH,
    priorityOverrides: {},
    cwd,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--source": {
        const dir = args[i + 1];
        if (!dir) {
          throw new SnapshotBuildError("--source requires a directory", "CONFIG");
        }
        options.sourceDirs.push(path.resolve(cwd, dir));
        i += 1;
        break;
      }
      case "--output": {
        const outDir = args[i + 1];
        if (!outDir) {
          throw new SnapshotBuildError("--output requires a directory", "CONFIG");
        }
        options.outputDir = path.resolve(cwd, outDir);
        i += 1;
        break;
      }
      case "--group-id": {
        const groupId = args[i + 1];
        if (!groupId) {
          throw new SnapshotBuildError("--group-id requires a value", "CONFIG");
        }
        options.groupId = groupId;
        i += 1;
        break;
      }
      case "--max-summary-chars":
      case "--summary-length": {
        const value = args[i + 1];
        if (!value) {
          throw new SnapshotBuildError(
            "--max-summary-chars/--summary-length requires a number",
            "CONFIG",
          );
        }
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new SnapshotBuildError(
            "Summary length must be a positive integer",
            "CONFIG",
          );
        }
        options.summaryLength = parsed;
        i += 1;
        break;
      }
      case "--no-incremental": {
        options.incremental = false;
        break;
      }
      case "--priority-override": {
        const mapping = args[i + 1];
        if (!mapping) {
          throw new SnapshotBuildError(
            "--priority-override requires '<path>=<priority>'",
            "CONFIG",
          );
        }
        const { key, priority } = parsePriorityOverride(mapping, cwd);
        options.priorityOverrides ??= {};
        options.priorityOverrides[key] = priority;
        i += 1;
        break;
      }
      default:
        throw new SnapshotBuildError(`Unknown argument: ${arg}`, "CONFIG");
    }
  }

  if (options.sourceDirs.length === 0) {
    options.sourceDirs = DEFAULT_SOURCE_DIRS.map((dir) => path.resolve(cwd, dir));
  }

  return options;
}

function parsePriorityOverride(
  mapping: string,
  cwd: string,
): { key: string; priority: number } {
  const separatorIndex = mapping.lastIndexOf("=");
  if (separatorIndex <= 0 || separatorIndex === mapping.length - 1) {
    throw new SnapshotBuildError(
      "--priority-override requires '<path>=<priority>'",
      "CONFIG",
    );
  }

  const rawPath = mapping.slice(0, separatorIndex).trim();
  const rawPriority = mapping.slice(separatorIndex + 1).trim();
  const parsedPriority = Number.parseInt(rawPriority, 10);

  if (rawPath.length === 0 || Number.isNaN(parsedPriority)) {
    throw new SnapshotBuildError(
      "--priority-override requires a valid path and numeric priority",
      "CONFIG",
    );
  }

  const normalizedPath = normalizeRelativePath(rawPath, cwd);
  return { key: normalizedPath, priority: parsedPriority };
}

function normalizeRelativePath(targetPath: string, cwd: string): string {
  const resolved = path.isAbsolute(targetPath) ? targetPath : path.resolve(cwd, targetPath);
  const relative = path.relative(cwd, resolved);
  return relative.split(path.sep).join("/");
}

async function readPreviousMetadata(outputDir: string): Promise<SnapshotMetadata | undefined> {
  const metadataPath = path.join(outputDir, SNAPSHOT_METADATA_FILENAME);
  try {
    const content = await fs.readFile(metadataPath, "utf-8");
    return JSON.parse(content) as SnapshotMetadata;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return undefined;
    }
    throw new SnapshotBuildError(`Failed to read metadata: ${err.message}`, "IO");
  }
}

async function readPreviousSnapshotEntries(outputDir: string): Promise<SnapshotEntryMap> {
  const snapshotPath = path.join(outputDir, SNAPSHOT_JSON_FILENAME);
  try {
    const content = await fs.readFile(snapshotPath, "utf-8");
    const entries = JSON.parse(content) as SnapshotEntry[];
    return entries.reduce<SnapshotEntryMap>((acc, entry) => {
      acc[entry.relativePath] = entry;
      return acc;
    }, {});
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return {};
    }
    throw new SnapshotBuildError(`Failed to read snapshot cache: ${err.message}`, "IO");
  }
}

async function collectMarkdownFiles(sourceDirs: string[]): Promise<string[]> {
  const files = await Promise.all(
    sourceDirs.map(async (dir) => {
      const resolved = path.resolve(dir);
      return walkDirectory(resolved);
    }),
  );
  return files.flat();
}

async function walkDirectory(dir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new SnapshotBuildError(`Source directory not found: ${dir}`, "IO");
    }
    throw new SnapshotBuildError(`Failed to read source directory ${dir}: ${err.message}`, "IO");
  }
  const collected: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...(await walkDirectory(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(SNAPSHOT_FILE_SUFFIX)) {
      collected.push(fullPath);
    }
  }

  return collected;
}

async function buildEntries(
  files: string[],
  options: InternalBuildOptions,
  previousHashes: SnapshotFileHashes,
  previousEntries: SnapshotEntryMap,
): Promise<{ entries: SnapshotEntry[]; stats: SnapshotBuildStats }> {
  const counters: SnapshotBuildStats = {
    scanned: files.length,
    added: 0,
    updated: 0,
    skipped: 0,
    durationMs: 0,
  };

  const entries = await Promise.all(
    files.map(async (filePath) => {
      const relativePath = path
        .relative(options.cwd, filePath)
        .split(path.sep)
        .join("/");
      const fileStats = await fs.stat(filePath);
      const lastModifiedIso = fileStats.mtime.toISOString();
      const cachedEntry = previousEntries[relativePath];
      const priority = resolvePriority(relativePath, options.priorityOverrides);

      if (
        options.incremental &&
        cachedEntry &&
        cachedEntry.lastModified === lastModifiedIso
      ) {
        statsCounter(counters, "skipped");
        return reuseEntryFromCache(cachedEntry, cachedEntry.hash, lastModifiedIso, priority);
      }

      const hash = await hashFile(filePath);
      const previousHash = previousHashes[relativePath];
      const changeType: "added" | "updated" | "skipped" = !previousHash
        ? "added"
        : previousHash === hash
          ? "skipped"
          : "updated";
      statsCounter(counters, changeType);

      if (changeType === "skipped" && options.incremental && cachedEntry) {
        return reuseEntryFromCache(cachedEntry, hash, lastModifiedIso, priority);
      }

      const content = await fs.readFile(filePath, "utf-8");
      return {
        path: relativePath,
        relativePath,
        title: deriveTitle(content, filePath),
        summary: deriveSummary(content, options.summaryLength),
        tags: [],
        lastModified: lastModifiedIso,
        hash,
        priority,
      } satisfies SnapshotEntry;
    }),
  );

  return {
    entries: entries.sort((a: SnapshotEntry, b: SnapshotEntry) =>
      a.relativePath.localeCompare(b.relativePath),
    ),
    stats: counters,
  };
}

function statsCounter(stats: SnapshotBuildStats, field: "added" | "updated" | "skipped"): void {
  stats[field] += 1;
}

function reuseEntryFromCache(
  entry: SnapshotEntry,
  hash: string,
  lastModifiedIso: string,
  priority: number,
): SnapshotEntry {
  return {
    ...entry,
    hash,
    lastModified: lastModifiedIso,
    priority,
  } satisfies SnapshotEntry;
}

function resolvePriority(
  relativePath: string,
  overrides?: Record<string, number>,
): number {
  if (!overrides) {
    return 0;
  }
  return overrides[relativePath] ?? 0;
}

async function hashFile(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hasher = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => {
      hasher.update(chunk);
    });

    stream.on("error", (error) => {
      reject(new SnapshotBuildError(`Failed to hash file ${filePath}: ${(error as Error).message}`, "IO"));
    });

    stream.on("end", () => {
      resolve(`sha256:${hasher.digest("hex")}`);
    });
  });
}

function deriveTitle(content: string, fallbackPath: string): string {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().startsWith("#")) {
      return line.replace(/^#+\s*/, "").trim() || fallbackFilename(fallbackPath);
    }
  }

  return fallbackFilename(fallbackPath);
}

function deriveSummary(content: string, summaryLength: number): string {
  const sanitized = content
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

  const paragraphs = sanitized
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const firstParagraph = paragraphs[0] ?? "";
  return firstParagraph.slice(0, summaryLength);
}

function fallbackFilename(filePath: string): string {
  return path.basename(filePath).replace(path.extname(filePath), "");
}

function buildMetadata(entries: SnapshotEntry[], options: SnapshotBuildOptions): SnapshotMetadata {
  const fileHashes = entries.reduce<Record<string, string>>((acc, entry) => {
    acc[entry.relativePath] = entry.hash;
    return acc;
  }, {});

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceDirs: options.sourceDirs,
    groupId: options.groupId,
    fileHashes,
  } satisfies SnapshotMetadata;
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function formatProcessedFilesSummary(stats: SnapshotBuildStats): string {
  const base = `Processed ${stats.scanned} files`;
  const breakdown = `(added: ${stats.added}, updated: ${stats.updated}, skipped: ${stats.skipped})`;
  const duration = Number.isFinite(stats.durationMs) ? ` in ${Math.round(stats.durationMs)}ms` : "";
  return `${base} ${breakdown}${duration}`.trim();
}

function logProcessedFilesSummary(stats: SnapshotBuildStats): void {
  console.log(formatProcessedFilesSummary(stats));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSnapshotBuilderCli()
    .then(({ stats }) => {
      logProcessedFilesSummary(stats);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
