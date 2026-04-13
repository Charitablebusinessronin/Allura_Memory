/**
 * SDK Barrel Export — Re-exports from @allura/sdk
 *
 * Provides a unified import path for the main application to use the
 * Allura SDK client. Uses relative paths to the packages/sdk/src directory
 * since the package is not yet published to npm.
 *
 * Usage:
 *   import { AlluraClient, createServerClient } from "@/lib/sdk";
 *
 * Install @allura/sdk as a workspace package to enable direct imports:
 *   bun add @allura/sdk (workspace:*)
 */

// ── Client ──────────────────────────────────────────────────────────────────

export { AlluraClient } from "../../../packages/sdk/src/client";

// ── Types ────────────────────────────────────────────────────────────────────

export type {
  // Core scalars
  GroupId,
  MemoryId,
  UserId,
  MemoryContent,
  ConfidenceScore,
  StorageLocation,
  PromotionMode,
  MemoryProvenance,
  MemoryStatus,
  MemorySortOrder,
  // Config
  AlluraClientConfig,
  // Request params
  MemoryAddParams,
  MemorySearchParams,
  MemoryGetParams,
  MemoryListParams,
  MemoryDeleteParams,
  // Responses
  MemoryAddResponse,
  MemorySearchResult,
  MemorySearchResponse,
  MemoryGetResponse,
  MemoryListResponse,
  MemoryDeleteResponse,
  MemoryResponseMeta,
  HealthResponse,
} from "../../../packages/sdk/src/types";

// ── Errors ───────────────────────────────────────────────────────────────────

export {
  AlluraError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ConnectionError,
  RetryExhaustedError,
} from "../../../packages/sdk/src/errors";

// ── Auth Helpers ─────────────────────────────────────────────────────────────

export { resolveAuthToken, requireAuthToken, createAuthHeader } from "../../../packages/sdk/src/auth";

// ── Utilities ────────────────────────────────────────────────────────────────

export {
  validateGroupId as validateSdkGroupId,
  withRetry,
  calculateBackoff,
  isRetryable,
  buildHeaders,
  normalizeBaseUrl,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRIES,
} from "../../../packages/sdk/src/utils";