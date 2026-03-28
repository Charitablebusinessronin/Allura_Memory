import { createHash } from "node:crypto";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_JSON_FILENAME = "index.json";
export const SNAPSHOT_METADATA_FILENAME = "index.meta.json";
export const SNAPSHOT_INGESTION_METADATA_FILENAME = "ingestion.meta.json";
export const SNAPSHOT_INGESTION_SCHEMA_VERSION = 1;
export const SNAPSHOT_DEFAULT_OUTPUT_DIR = "memory-bank";
export const DEFAULT_SOURCE_DIRS = [
  "docs/roninmemory",
  "docs/Carlos_plan_framework",
];
export const DEFAULT_SUMMARY_LENGTH = 500;

export type SnapshotFileHashes = Record<string, string>;

export interface SnapshotEntry {
  path: string;
  relativePath: string;
  title: string;
  summary: string;
  tags: string[];
  lastModified: string;
  hash: string;
  priority: number;
}

export interface SnapshotMetadata {
  schemaVersion: number;
  generatedAt: string;
  sourceDirs: string[];
  groupId: string;
  fileHashes: SnapshotFileHashes;
}

export interface SnapshotIngestionMetadata {
  schemaVersion: number;
  groupId?: string;
  ingestedAt?: string;
  entryHashes: SnapshotFileHashes;
}

export interface SnapshotIngestionMetadataHistoryFile {
  schemaVersion: number;
  history: SnapshotIngestionMetadata[];
}

export interface SnapshotBuildOptions {
  sourceDirs: string[];
  outputDir: string;
  incremental: boolean;
  groupId: string;
  summaryLength: number;
  priorityOverrides?: Record<string, number>;
}

export interface SnapshotBuildStats {
  scanned: number;
  added: number;
  updated: number;
  skipped: number;
  durationMs: number;
}

export interface SnapshotBuildArtifacts {
  entries: SnapshotEntry[];
  metadata: SnapshotMetadata;
  stats: SnapshotBuildStats;
}

export class SnapshotBuildError extends Error {
  public readonly code: "CONFIG" | "IO" | "UNKNOWN";

  constructor(message: string, code: "CONFIG" | "IO" | "UNKNOWN" = "UNKNOWN") {
    super(message);
    this.name = "SnapshotBuildError";
    this.code = code;
  }
}

export const SNAPSHOT_FILE_SUFFIX = ".md";

export function hashContent(content: string): string {
  const digest = createHash("sha256").update(content).digest("hex");
  return `sha256:${digest}`;
}
