/**
 * Auth Roles Tests
 *
 * Tests for the role hierarchy, permission checks, and role utilities.
 *
 * Reference: Phase 7 benchmark — RBAC with curator/admin/viewer roles
 */

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  checkPermission,
  isValidRole,
  parseRole,
  roleLevel,
  rolesAtOrAbove,
  rolesBelow,
  ROLE_DESCRIPTIONS,
} from "@/lib/auth/roles";
import { ALLURA_ROLES, ROLE_LEVEL } from "@/lib/auth/types";

// ── Role Hierarchy ──────────────────────────────────────────────────────────

describe("Role Hierarchy", () => {
  it("should define roles in ascending order: viewer < curator < admin", () => {
    expect(ROLE_LEVEL.viewer).toBeLessThan(ROLE_LEVEL.curator);
    expect(ROLE_LEVEL.curator).toBeLessThan(ROLE_LEVEL.admin);
  });

  it("should have exactly 3 roles", () => {
    expect(ALLURA_ROLES).toHaveLength(3);
    expect(ALLURA_ROLES).toContain("viewer");
    expect(ALLURA_ROLES).toContain("curator");
    expect(ALLURA_ROLES).toContain("admin");
  });

  it("should assign correct numeric levels", () => {
    expect(roleLevel("viewer")).toBe(0);
    expect(roleLevel("curator")).toBe(1);
    expect(roleLevel("admin")).toBe(2);
  });
});

// ── Permission Checks ───────────────────────────────────────────────────────

describe("hasPermission", () => {
  it("should allow viewer to do viewer things", () => {
    expect(hasPermission("viewer", "viewer")).toBe(true);
  });

  it("should deny viewer from doing curator things", () => {
    expect(hasPermission("viewer", "curator")).toBe(false);
  });

  it("should deny viewer from doing admin things", () => {
    expect(hasPermission("viewer", "admin")).toBe(false);
  });

  it("should allow curator to do viewer things", () => {
    expect(hasPermission("curator", "viewer")).toBe(true);
  });

  it("should allow curator to do curator things", () => {
    expect(hasPermission("curator", "curator")).toBe(true);
  });

  it("should deny curator from doing admin things", () => {
    expect(hasPermission("curator", "admin")).toBe(false);
  });

  it("should allow admin to do viewer things", () => {
    expect(hasPermission("admin", "viewer")).toBe(true);
  });

  it("should allow admin to do curator things", () => {
    expect(hasPermission("admin", "curator")).toBe(true);
  });

  it("should allow admin to do admin things", () => {
    expect(hasPermission("admin", "admin")).toBe(true);
  });
});

// ── Detailed Permission Check ────────────────────────────────────────────────

describe("checkPermission", () => {
  it("should return allowed=true when user has sufficient role", () => {
    const result = checkPermission("admin", "viewer");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.requiredRole).toBe("viewer");
    expect(result.actualRole).toBe("admin");
  });

  it("should return allowed=false with reason when user lacks role", () => {
    const result = checkPermission("viewer", "admin");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("viewer");
    expect(result.reason).toContain("admin");
    expect(result.requiredRole).toBe("admin");
    expect(result.actualRole).toBe("viewer");
  });

  it("should return allowed=true when roles are equal", () => {
    const result = checkPermission("curator", "curator");
    expect(result.allowed).toBe(true);
  });
});

// ── Role Validation ─────────────────────────────────────────────────────────

describe("isValidRole", () => {
  it("should validate correct role strings", () => {
    expect(isValidRole("viewer")).toBe(true);
    expect(isValidRole("curator")).toBe(true);
    expect(isValidRole("admin")).toBe(true);
  });

  it("should reject invalid role strings", () => {
    expect(isValidRole("superadmin")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole("VIEWER")).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
    expect(isValidRole(123)).toBe(false);
  });
});

// ── Role Parsing ────────────────────────────────────────────────────────────

describe("parseRole", () => {
  it("should parse valid role strings", () => {
    expect(parseRole("viewer")).toBe("viewer");
    expect(parseRole("curator")).toBe("curator");
    expect(parseRole("admin")).toBe("admin");
  });

  it("should fall back to default for invalid roles", () => {
    expect(parseRole("superadmin")).toBe("viewer");
    expect(parseRole("")).toBe("viewer");
    expect(parseRole(null)).toBe("viewer");
    expect(parseRole(undefined)).toBe("viewer");
  });

  it("should use custom fallback when provided", () => {
    expect(parseRole("invalid", "curator")).toBe("curator");
    expect(parseRole(null, "admin")).toBe("admin");
  });
});

// ── Role Collections ─────────────────────────────────────────────────────────

describe("rolesAtOrAbove", () => {
  it("should return all roles at or above viewer", () => {
    const roles = rolesAtOrAbove("viewer");
    expect(roles).toContain("viewer");
    expect(roles).toContain("curator");
    expect(roles).toContain("admin");
    expect(roles).toHaveLength(3);
  });

  it("should return curator and admin for curator level", () => {
    const roles = rolesAtOrAbove("curator");
    expect(roles).toContain("curator");
    expect(roles).toContain("admin");
    expect(roles).toHaveLength(2);
  });

  it("should return only admin for admin level", () => {
    const roles = rolesAtOrAbove("admin");
    expect(roles).toContain("admin");
    expect(roles).toHaveLength(1);
  });
});

describe("rolesBelow", () => {
  it("should return viewer and curator for admin", () => {
    const roles = rolesBelow("admin");
    expect(roles).toContain("viewer");
    expect(roles).toContain("curator");
    expect(roles).toHaveLength(2);
  });

  it("should return only viewer for curator", () => {
    const roles = rolesBelow("curator");
    expect(roles).toContain("viewer");
    expect(roles).toHaveLength(1);
  });

  it("should return empty array for viewer", () => {
    const roles = rolesBelow("viewer");
    expect(roles).toHaveLength(0);
  });
});

// ── Role Descriptions ───────────────────────────────────────────────────────

describe("ROLE_DESCRIPTIONS", () => {
  it("should have descriptions for all roles", () => {
    for (const role of ALLURA_ROLES) {
      expect(ROLE_DESCRIPTIONS[role]).toBeDefined();
      expect(typeof ROLE_DESCRIPTIONS[role]).toBe("string");
      expect(ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(0);
    }
  });

  it("should describe viewer as read-only", () => {
    expect(ROLE_DESCRIPTIONS.viewer.toLowerCase()).toContain("view");
  });

  it("should describe curator as approval role", () => {
    expect(ROLE_DESCRIPTIONS.curator.toLowerCase()).toContain("approve");
  });

  it("should describe admin as full access", () => {
    expect(ROLE_DESCRIPTIONS.admin.toLowerCase()).toContain("full");
  });
});