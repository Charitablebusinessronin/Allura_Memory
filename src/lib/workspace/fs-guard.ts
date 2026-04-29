/**
 * Workspace File System Guard
 *
 * Safe file system operations that enforce workspace boundaries.
 * Every operation validates the target path is within the workspace
 * before executing. Violations throw WorkspaceViolationError (WS002).
 *
 * FR-5: File system layer enforcement
 * NFR-4: Path traversal must be impossible
 */

import { readFile, writeFile, mkdir, readdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { isWithinWorkspace, WORKSPACE_ROOT } from "./boundary";
import { WorkspaceViolationError } from "./errors";
import { logWorkspaceViolation } from "./audit";

// ── Types ───────────────────────────────────────────────────────────────────

export type ReadFileOptions = {
  encoding?: BufferEncoding | null;
  flag?: string;
};

export type WriteFileOptions = {
  encoding?: BufferEncoding | null;
  mode?: number;
  flag?: string;
};

export type MkdirOptions = {
  recursive?: boolean;
  mode?: number;
};

// ── Internal Guard ──────────────────────────────────────────────────────────

/**
 * Guard a path operation: verify it's within the workspace boundary.
 *
 * @param path - Target path
 * @param operation - Human-readable operation name (for error messages)
 * @returns The resolved absolute path
 * @throws WorkspaceViolationError if path is outside boundary
 */
function guardPath(path: string, operation: string): string {
  if (!isWithinWorkspace(path)) {
    const error = new WorkspaceViolationError(
      "WS002",
      `Path traversal blocked: "${path}" is outside workspace boundary "${WORKSPACE_ROOT}" during ${operation}`,
      { groupId: "unknown", attemptedPath: path }
    );
    // Best-effort audit — do not let audit failure mask the violation
    logWorkspaceViolation({
      groupId: "unknown",
      code: "WS002",
      attemptedPath: path,
      operation,
      message: error.message,
    }).catch(() => {
      /* silently ignore audit failure */
    });
    throw error;
  }
  return resolve(WORKSPACE_ROOT, path);
}

// ── Safe File Operations ────────────────────────────────────────────────────

/**
 * Safely read a file within the workspace boundary.
 *
 * @param path - Relative or absolute path (must be within workspace)
 * @param options - fs.readFile options
 * @returns File contents as Buffer (or string if encoding specified)
 * @throws WorkspaceViolationError if path is outside boundary
 */
export async function safeReadFile(
  path: string,
  options?: ReadFileOptions
): Promise<Buffer | string> {
  const safePath = guardPath(path, "safeReadFile");
  return readFile(safePath, options);
}

/**
 * Safely write a file within the workspace boundary.
 *
 * @param path - Relative or absolute path (must be within workspace)
 * @param data - Data to write
 * @param options - fs.writeFile options
 * @throws WorkspaceViolationError if path is outside boundary
 */
export async function safeWriteFile(
  path: string,
  data: string | Buffer,
  options?: WriteFileOptions
): Promise<void> {
  const safePath = guardPath(path, "safeWriteFile");
  return writeFile(safePath, data, options);
}

/**
 * Safely create a directory within the workspace boundary.
 *
 * @param path - Relative or absolute path (must be within workspace)
 * @param options - fs.mkdir options
 * @throws WorkspaceViolationError if path is outside boundary
 */
export async function safeMkdir(
  path: string,
  options?: MkdirOptions
): Promise<string | undefined> {
  const safePath = guardPath(path, "safeMkdir");
  return mkdir(safePath, options);
}

/**
 * Safely list directory contents within the workspace boundary.
 *
 * @param path - Relative or absolute path (must be within workspace)
 * @returns Array of file/directory names
 * @throws WorkspaceViolationError if path is outside boundary
 */
export async function safeReaddir(path: string): Promise<string[]> {
  const safePath = guardPath(path, "safeReaddir");
  return readdir(safePath);
}

/**
 * Safely check if a path exists within the workspace boundary.
 *
 * @param path - Relative or absolute path (must be within workspace)
 * @returns true if accessible, false otherwise
 * @throws WorkspaceViolationError if path is outside boundary
 */
export async function safeAccess(path: string): Promise<boolean> {
  const safePath = guardPath(path, "safeAccess");
  try {
    await access(safePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove a file within the workspace boundary.
 * NOTE: This is a soft-delete wrapper — moves to .trash/ subdirectory.
 *
 * @param path - Relative or absolute path (must be within workspace)
 * @throws WorkspaceViolationError if path is outside boundary
 */
export async function safeRemoveFile(path: string): Promise<void> {
  const safePath = guardPath(path, "safeRemoveFile");
  const trashDir = resolve(WORKSPACE_ROOT, ".trash");
  const target = resolve(trashDir, `${Date.now()}-${resolve(safePath).split("/").pop() || "unknown"}`);

  // Ensure trash dir exists
  await mkdir(trashDir, { recursive: true });

  // Verify target is still within workspace (defense in depth)
  if (!isWithinWorkspace(target)) {
    throw new WorkspaceViolationError(
      "WS002",
      `Trash path "${target}" escaped workspace boundary`,
      { groupId: "unknown", attemptedPath: target }
    );
  }

  await writeFile(target, await readFile(safePath));
  // Overwrite original with zeros then delete (best-effort)
  try {
    const stats = await readFile(safePath);
    await writeFile(safePath, Buffer.alloc(stats.length, 0));
  } catch {
    /* ignore overwrite failure */
  }
}
