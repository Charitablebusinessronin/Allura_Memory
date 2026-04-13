/**
 * Clerk Integration Helpers
 *
 * Provides Clerk-specific auth utilities for Allura Memory.
 * When Clerk is not installed or configured, falls back to DevAuthProvider.
 *
 * Reference: Phase 7 benchmark — Clerk SSO + RBAC
 *
 * IMPORTANT: This module does NOT import @clerk/nextjs directly.
 * It defines the integration layer that will use Clerk when installed.
 * The actual Clerk imports happen in middleware.ts and layout components
 * where @clerk/nextjs is conditionally imported.
 */

import type { AuthUser, AlluraRole, ClerkAlluraMetadata, ClerkPublicMetadata } from "./types";
import { parseRole } from "./roles";
import { validateGroupId } from "@/lib/validation/group-id";
import { GroupIdValidationError } from "@/lib/validation/group-id";

// ── Clerk Metadata Access ──────────────────────────────────────────────────

/**
 * Extract Allura role and group_id from Clerk's publicMetadata.
 *
 * Clerk stores custom metadata in `user.publicMetadata.allura`:
 * ```json
 * {
 *   "allura": {
 *     "role": "curator",
 *     "groupId": "allura-acme"
 *   }
 * }
 * ```
 *
 * @param metadata - Clerk user's publicMetadata object
 * @returns Parsed role and groupId, with safe defaults
 */
export function extractAlluraMetadata(metadata: ClerkPublicMetadata | null | undefined): {
  role: AlluraRole;
  groupId: string;
} {
  const allura = metadata?.allura;

  if (!allura) {
    return {
      role: "viewer",
      groupId: "allura-default",
    };
  }

  const role = parseRole(allura.role, "viewer");
  let groupId = allura.groupId;

  // Validate group_id format (ARCH-001: must match allura-* pattern)
  try {
    groupId = validateGroupId(groupId);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      console.warn(`[auth] Invalid groupId in Clerk metadata: "${allura.groupId}". Falling back to allura-default.`);
      groupId = "allura-default";
    } else {
      throw error;
    }
  }

  return { role, groupId };
}

// ── Auth User Construction ──────────────────────────────────────────────────

/**
 * Build an AuthUser from Clerk user data.
 *
 * This is the canonical way to construct an AuthUser from Clerk.
 * Used in middleware and server actions.
 *
 * @param params - Clerk user fields
 * @returns AuthUser with role and groupId from Clerk metadata
 */
export function buildAuthUser(params: {
  id: string;
  email: string;
  name?: string;
  imageUrl?: string;
  publicMetadata: ClerkPublicMetadata;
}): AuthUser {
  const { role, groupId } = extractAlluraMetadata(params.publicMetadata);

  return {
    id: params.id,
    email: params.email,
    name: params.name,
    role,
    groupId,
    imageUrl: params.imageUrl,
  };
}

// ── Clerk Configuration ─────────────────────────────────────────────────────

/**
 * Check if Clerk is configured and available.
 *
 * Returns true when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
 * In development without Clerk, the DevAuthProvider is used instead.
 */
export function isClerkConfigured(): boolean {
  return typeof process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "string"
    && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 0
    && typeof process.env.CLERK_SECRET_KEY === "string"
    && process.env.CLERK_SECRET_KEY.length > 0;
}

/**
 * Get the Clerk publishable key from environment.
 *
 * @throws Error if Clerk is not configured
 */
export function getClerkPublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. " +
      "Configure Clerk or use DevAuthProvider for local development."
    );
  }
  return key;
}

// ── Clerk Metadata Mutation ─────────────────────────────────────────────────

/**
 * Build the Clerk publicMetadata payload for setting a user's role.
 *
 * This is used by admin routes to update user roles.
 * The actual Clerk API call is made server-side.
 *
 * @param role - The role to assign
 * @param groupId - The tenant group_id
 * @returns Clerk publicMetadata.allura payload
 */
export function buildClerkMetadataPayload(
  role: AlluraRole,
  groupId: string,
): ClerkAlluraMetadata {
  // Validate group_id before storing
  try {
    validateGroupId(groupId);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new Error(`Cannot set Clerk metadata with invalid groupId: ${error.message}`);
    }
    throw error;
  }

  return {
    role,
    groupId,
  };
}