/**
 * Allura Memory Auth Types
 *
 * TypeScript types for the authentication and authorization system.
 * Clerk is the auth provider; DevAuthProvider bypasses in development.
 *
 * Reference: Phase 7 benchmark — Clerk SSO + RBAC
 */

// ── Role Definitions ──────────────────────────────────────────────────────

/**
 * Hierarchical roles for Allura Memory.
 *
 * Role hierarchy (highest to lowest):
 *   admin > curator > viewer
 *
 * - admin:   Full access including admin routes, user management, system config
 * - curator: Can approve/reject proposals, manage knowledge promotion
 * - viewer:  Can view memories, search, read traces and insights
 */
export const ALLURA_ROLES = ["viewer", "curator", "admin"] as const;
export type AlluraRole = (typeof ALLURA_ROLES)[number];

/**
 * Role hierarchy level — higher number = more permissions.
 * Used for permission checks: `roleLevel(userRole) >= roleLevel(requiredRole)`.
 */
export const ROLE_LEVEL: Record<AlluraRole, number> = {
  viewer: 0,
  curator: 1,
  admin: 2,
} as const;

// ── Auth User ─────────────────────────────────────────────────────────────

/**
 * Authenticated user identity.
 *
 * `groupId` is derived from the user's tenant membership and replaces
 * the hardcoded `allura-default` pattern used in UI components.
 */
export interface AuthUser {
  /** Unique user ID from Clerk (or dev fallback) */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name?: string;
  /** User's role within the current tenant */
  role: AlluraRole;
  /** Tenant group_id derived from auth (format: allura-*) */
  groupId: string;
  /** URL to user's avatar image */
  imageUrl?: string;
}

// ── Permission Check Result ────────────────────────────────────────────────

export interface PermissionCheckResult {
  /** Whether the user has the required permission */
  allowed: boolean;
  /** Human-readable reason if denied */
  reason?: string;
  /** The role that was checked */
  requiredRole: AlluraRole;
  /** The user's actual role */
  actualRole: AlluraRole;
}

// ── Route Protection ──────────────────────────────────────────────────────

/**
 * Route protection configuration.
 *
 * Each entry maps a URL pattern to the minimum role required.
 * Routes not listed here are public (no auth required).
 */
export interface RouteProtection {
  /** URL pattern (supports Next.js matcher syntax) */
  pattern: string;
  /** Minimum role required to access this route */
  requiredRole: AlluraRole;
  /** HTTP methods to protect (defaults to all methods) */
  methods?: string[];
}

// ── Auth Provider ──────────────────────────────────────────────────────────

/**
 * Auth provider interface.
 *
 * ClerkAuthProvider implements this for production.
 * DevAuthProvider implements this for local development.
 */
export interface AuthProvider {
  /** Get the current authenticated user, or null if unauthenticated */
  getCurrentUser(): Promise<AuthUser | null>;
  /** Check if the current user has at least the required role */
  hasRole(requiredRole: AlluraRole): Promise<boolean>;
  /** Get the group_id for the current user's tenant */
  getGroupId(): Promise<string>;
}

// ── Clerk Metadata Types ───────────────────────────────────────────────────

/**
 * Shape of Clerk's publicMetadata where we store Allura roles.
 *
 * Stored at: user.publicMetadata.allura
 */
export interface ClerkAlluraMetadata {
  /** Primary role for the user */
  role: AlluraRole;
  /** Tenant group_id this user belongs to */
  groupId: string;
  /** Additional roles if user has multiple (optional) */
  roles?: AlluraRole[];
}

/**
 * Clerk user's publicMetadata shape.
 */
export interface ClerkPublicMetadata {
  allura?: ClerkAlluraMetadata;
}

// ── Dev Auth Config ────────────────────────────────────────────────────────

/**
 * Development-mode auth configuration.
 *
 * When NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set, the system
 * falls back to DevAuthProvider using these env vars.
 */
export interface DevAuthConfig {
  /** Whether dev auth bypass is enabled */
  enabled: boolean;
  /** Default role for dev users */
  defaultRole: AlluraRole;
  /** Default group_id for dev users */
  defaultGroupId: string;
  /** Default user ID for dev users */
  defaultUserId: string;
  /** Default email for dev users */
  defaultEmail: string;
}