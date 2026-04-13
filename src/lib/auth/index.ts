/**
 * Auth Barrel Export
 *
 * Central import point for all auth modules.
 *
 * Usage:
 *   import { hasPermission, getAuthConfig, DevAuthProvider } from "@/lib/auth";
 */

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  AlluraRole,
  AuthUser,
  AuthProvider,
  ClerkAlluraMetadata,
  ClerkPublicMetadata,
  DevAuthConfig,
  PermissionCheckResult,
  RouteProtection,
} from "./types";

export {
  ALLURA_ROLES,
  ROLE_LEVEL,
} from "./types";

// ── Role Utilities ──────────────────────────────────────────────────────────
export {
  hasPermission,
  checkPermission,
  isValidRole,
  parseRole,
  roleLevel,
  rolesAtOrAbove,
  rolesBelow,
  ROLE_DESCRIPTIONS,
} from "./roles";

// ── Clerk Integration ───────────────────────────────────────────────────────
export {
  extractAlluraMetadata,
  buildAuthUser,
  isClerkConfigured,
  getClerkPublishableKey,
  buildClerkMetadataPayload,
} from "./clerk";

// ── Configuration ───────────────────────────────────────────────────────────
export {
  authEnvSchema,
  getAuthConfig,
  clearAuthConfig,
  isClerkEnabled,
  isDevAuthActive,
  getDevAuthConfig,
  PROTECTED_ROUTES,
  PUBLIC_ROUTES,
  AUTH_ROUTES,
} from "./config";

export type { AuthEnvConfig } from "./config";

// ── Dev Auth ────────────────────────────────────────────────────────────────
export {
  DevAuthProvider,
  devAuthProvider,
  isDevAuthEnabled,
  getDevUserSync,
} from "./dev-auth";

// ── API Auth Helpers ─────────────────────────────────────────────────────────
export {
  getAuthUser,
  requireAuth,
  requireRole,
  unauthorizedResponse,
  forbiddenResponse,
  getGroupIdFromAuth,
} from "./api-auth";