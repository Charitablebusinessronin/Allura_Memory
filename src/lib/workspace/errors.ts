/**
 * Workspace Isolation Errors
 *
 * Typed errors for workspace boundary violations.
 * Every violation carries a code for programmatic handling and audit correlation.
 */

/**
 * Error codes for workspace violations.
 */
export type WorkspaceViolationCode = "WS001" | "WS002" | "WS003" | "WS004";

/**
 * Error thrown when a workspace boundary is violated.
 *
 * Codes:
 * - WS001: group_id is not in the allowed list (boundary violation)
 * - WS002: Path traversal attempt detected (path outside workspace)
 * - WS003: Missing group_id (required but not provided)
 * - WS004: Database query group_id mismatch (expected vs actual)
 */
export class WorkspaceViolationError extends Error {
  public readonly code: WorkspaceViolationCode;
  public readonly groupId: string;
  public readonly attemptedPath?: string;
  public readonly expectedGroupId?: string;
  public readonly actualGroupId?: string;

  constructor(
    code: WorkspaceViolationCode,
    message: string,
    options: {
      groupId: string;
      attemptedPath?: string;
      expectedGroupId?: string;
      actualGroupId?: string;
    }
  ) {
    super(message);
    this.name = "WorkspaceViolationError";
    this.code = code;
    this.groupId = options.groupId;
    this.attemptedPath = options.attemptedPath;
    this.expectedGroupId = options.expectedGroupId;
    this.actualGroupId = options.actualGroupId;
  }
}
