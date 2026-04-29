/**
 * Workspace Boundary Definition
 *
 * Defines the workspace boundary contract and provides safe path resolution.
 * Prevents path traversal attacks (e.g., ../../../etc/passwd) by resolving
 * real paths and enforcing a strict prefix check.
 *
 * FR-5: Workspace isolation as a product boundary
 * NFR-4: Path traversal must be impossible
 */

import { homedir } from "node:os";
import { resolve, normalize, isAbsolute } from "node:path";

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * Default workspace root directory.
 * Override with WORKSPACE_ROOT environment variable.
 */
export const WORKSPACE_ROOT: string =
  process.env.WORKSPACE_ROOT || resolve(homedir(), ".openclaw/workspace");

/**
 * Allowed group_id prefixes for tenant isolation.
 * ARCH-001: All group_ids MUST match ^allura-[a-z0-9-]+$.
 */
export const ALLOWED_GROUP_ID_PATTERN = /^allura-[a-z0-9-]+$/;

/**
 * Default list of allowed group_ids (can be overridden via env).
 * In strict mode, only these group_ids are permitted.
 */
export function getAllowedGroupIds(): string[] {
  const env = process.env.ALLOWED_GROUP_IDS;
  if (env) {
    return env.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // Default: allow any valid allura-* group_id (permissive by default at boundary level)
  // The middleware enforces stricter rules if needed.
  return [];
}

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Workspace boundary descriptor.
 */
export interface WorkspaceBoundary {
  /** Unique workspace identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Absolute paths allowed within this workspace */
  allowedPaths: string[];
  /** Allowed group_ids for this workspace */
  allowedGroupIds: string[];
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Result of a workspace path resolution.
 */
export interface ResolvedWorkspacePath {
  /** The resolved absolute path */
  absolutePath: string;
  /** Whether the path is within the workspace boundary */
  withinBoundary: boolean;
  /** The workspace root used for resolution */
  workspaceRoot: string;
}

// ── Path Validation ───────────────────────────────────────────────────────────

/**
 * Resolve a relative path against the workspace root and verify it does not
 * escape the boundary via path traversal.
 *
 * Algorithm:
 * 1. Normalize the input path (collapse .. and .)
 * 2. If relative, resolve against WORKSPACE_ROOT
 * 3. Verify the resolved path starts with WORKSPACE_ROOT
 *
 * @param relativePath - Path relative to workspace root (or absolute)
 * @param workspaceRoot - Optional override for workspace root
 * @returns Resolved path info including boundary check
 * @throws Error if path is invalid
 */
export function resolveWorkspacePath(
  relativePath: string,
  workspaceRoot: string = WORKSPACE_ROOT
): ResolvedWorkspacePath {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("Path must be a non-empty string");
  }

  // Reject null bytes
  if (relativePath.includes("\0")) {
    throw new Error("Path contains null bytes");
  }

  // Normalize: collapse . and .., resolve to absolute
  const normalizedInput = normalize(relativePath);

  // If absolute, use as-is; otherwise resolve against workspace root
  const absolutePath = isAbsolute(normalizedInput)
    ? normalizedInput
    : resolve(workspaceRoot, normalizedInput);

  // Normalize again after resolution to collapse any remaining traversals
  const finalPath = normalize(absolutePath);

  // Ensure the resolved path is within the workspace root
  // Add trailing separator to workspaceRoot to prevent prefix trickery
  const rootWithSep = workspaceRoot.endsWith("/") ? workspaceRoot : workspaceRoot + "/";
  const withinBoundary =
    finalPath === workspaceRoot || finalPath.startsWith(rootWithSep);

  return {
    absolutePath: finalPath,
    withinBoundary,
    workspaceRoot,
  };
}

/**
 * Check if a path is within the workspace boundary.
 *
 * @param path - Path to check
 * @param workspaceRoot - Optional override for workspace root
 * @returns true if path is within boundary
 */
export function isWithinWorkspace(
  path: string,
  workspaceRoot: string = WORKSPACE_ROOT
): boolean {
  try {
    const resolved = resolveWorkspacePath(path, workspaceRoot);
    return resolved.withinBoundary;
  } catch {
    return false;
  }
}

/**
 * Validate a group_id format.
 *
 * ARCH-001: All group_ids MUST match ^allura-[a-z0-9-]+$.
 *
 * @param groupId - The group_id to validate
 * @returns true if valid
 */
export function isValidWorkspaceGroupId(groupId: unknown): boolean {
  if (typeof groupId !== "string" || !groupId) return false;
  return ALLOWED_GROUP_ID_PATTERN.test(groupId);
}

/**
 * Check if a group_id is in the allowed list (if configured).
 *
 * @param groupId - The group_id to check
 * @returns true if allowed or no allowlist is configured
 */
export function isAllowedGroupId(groupId: string): boolean {
  const allowed = getAllowedGroupIds();
  if (allowed.length === 0) {
    // No explicit allowlist → allow any valid group_id
    return isValidWorkspaceGroupId(groupId);
  }
  return allowed.includes(groupId);
}

/**
 * Assert that a path is within the workspace boundary.
 *
 * @param path - Path to validate
 * @param workspaceRoot - Optional override
 * @throws Error if path is outside the workspace boundary
 */
export function assertWithinWorkspace(
  path: string,
  workspaceRoot: string = WORKSPACE_ROOT
): void {
  const resolved = resolveWorkspacePath(path, workspaceRoot);
  if (!resolved.withinBoundary) {
    throw new Error(
      `Path "${path}" is outside workspace boundary "${workspaceRoot}". ` +
        `Resolved to: "${resolved.absolutePath}"`
    );
  }
}

/**
 * Create a workspace boundary descriptor for a given group_id.
 *
 * @param groupId - Tenant identifier
 * @returns WorkspaceBoundary for the group
 */
export function createWorkspaceBoundary(groupId: string): WorkspaceBoundary {
  const workspacePath = resolve(WORKSPACE_ROOT, groupId);
  return {
    id: groupId,
    name: groupId,
    allowedPaths: [workspacePath],
    allowedGroupIds: [groupId],
    createdAt: new Date(),
  };
}
