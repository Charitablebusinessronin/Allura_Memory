/**
 * Tenant Group ID Validation Tests
 * ARCH-001: Enforce allura-{org} tenant naming convention
 */

import { describe, expect, it } from "vitest";
import {
  validateTenantGroupId,
  isKnownWorkspace,
  validateKnownWorkspace,
  ALLURA_WORKSPACES,
  TENANT_ERROR_CODE,
} from "./tenant-group-id";
import { GroupIdValidationError } from "./group-id";

describe("validateTenantGroupId", () => {
  describe("valid allura-{org} formats", () => {
    it("accepts allura-faith-meats", () => {
      expect(() => validateTenantGroupId("allura-faith-meats")).not.toThrow();
      expect(validateTenantGroupId("allura-faith-meats")).toBe("allura-faith-meats");
    });

    it("accepts allura-creative", () => {
      expect(() => validateTenantGroupId("allura-creative")).not.toThrow();
      expect(validateTenantGroupId("allura-creative")).toBe("allura-creative");
    });

    it("accepts allura-personal", () => {
      expect(() => validateTenantGroupId("allura-personal")).not.toThrow();
    });

    it("accepts allura-nonprofit", () => {
      expect(() => validateTenantGroupId("allura-nonprofit")).not.toThrow();
    });

    it("accepts allura-audits", () => {
      expect(() => validateTenantGroupId("allura-audits")).not.toThrow();
    });

    it("accepts allura-haccp", () => {
      expect(() => validateTenantGroupId("allura-haccp")).not.toThrow();
    });

    it("accepts allura-default (for testing)", () => {
      expect(() => validateTenantGroupId("allura-default")).not.toThrow();
    });

    it("accepts custom allura-{org} formats", () => {
      // Should accept any valid allura-{org} pattern
      expect(() => validateTenantGroupId("allura-custom-org")).not.toThrow();
      expect(() => validateTenantGroupId("allura-new-tenant")).not.toThrow();
    });
  });

  describe("rejects non-allura formats", () => {
    it("rejects 'roninmemory' with RK-01 error code", () => {
      expect(() => validateTenantGroupId("roninmemory")).toThrow(GroupIdValidationError);
      
      try {
        validateTenantGroupId("roninmemory");
      } catch (error) {
        expect(error).toBeInstanceOf(GroupIdValidationError);
        expect((error as GroupIdValidationError).message).toContain("RK-01");
        expect((error as GroupIdValidationError).message).toContain("allura-{org}");
      }
    });

    it("rejects 'roninclaw-memory' with RK-01 error code", () => {
      expect(() => validateTenantGroupId("roninclaw-memory")).toThrow(GroupIdValidationError);
      
      try {
        validateTenantGroupId("roninclaw-memory");
      } catch (error) {
        expect((error as GroupIdValidationError).message).toContain("RK-01");
        expect((error as GroupIdValidationError).message).toContain("allura-{org}");
      }
    });

    it("rejects UUID format with RK-01", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(() => validateTenantGroupId(uuid)).toThrow(GroupIdValidationError);
      
      try {
        validateTenantGroupId(uuid);
      } catch (error) {
        expect((error as GroupIdValidationError).message).toContain("RK-01");
      }
    });

    it("rejects 'allura' without org suffix", () => {
      expect(() => validateTenantGroupId("allura")).toThrow(GroupIdValidationError);
      
      try {
        validateTenantGroupId("allura");
      } catch (error) {
        expect((error as GroupIdValidationError).message).toContain("allura-{org}");
      }
    });

    it("rejects uppercase ALLURA-FAITH-MEATS", () => {
      expect(() => validateTenantGroupId("ALLURA-FAITH-MEATS")).toThrow(GroupIdValidationError);
    });

    it("rejects null", () => {
      expect(() => validateTenantGroupId(null)).toThrow(GroupIdValidationError);
    });

    it("rejects undefined", () => {
      expect(() => validateTenantGroupId(undefined)).toThrow(GroupIdValidationError);
    });

    it("rejects empty string", () => {
      expect(() => validateTenantGroupId("")).toThrow(GroupIdValidationError);
    });

    it("rejects number", () => {
      expect(() => validateTenantGroupId(123)).toThrow(GroupIdValidationError);
    });
  });

  describe("error code enforcement", () => {
    it("includes error code RK-01 in all validation errors", () => {
      const invalidIds = [
        "roninmemory",
        "roninclaw-memory",
        "INVALID",
        "allura",
      ];

      invalidIds.forEach((id) => {
        try {
          validateTenantGroupId(id);
          expect.fail(`Expected ${id} to throw`);
        } catch (error) {
          expect((error as GroupIdValidationError).message).toContain("RK-01");
        }
      });
    });
  });

  describe("trimming and normalization", () => {
    it("trims whitespace", () => {
      expect(validateTenantGroupId("  allura-faith-meats  ")).toBe("allura-faith-meats");
    });

    it("rejects whitespace-only", () => {
      expect(() => validateTenantGroupId("   ")).toThrow(GroupIdValidationError);
    });
  });
});

describe("isKnownWorkspace", () => {
  it("returns true for known workspaces", () => {
    expect(isKnownWorkspace("allura-faith-meats")).toBe(true);
    expect(isKnownWorkspace("allura-creative")).toBe(true);
    expect(isKnownWorkspace("allura-personal")).toBe(true);
    expect(isKnownWorkspace("allura-nonprofit")).toBe(true);
    expect(isKnownWorkspace("allura-audits")).toBe(true);
    expect(isKnownWorkspace("allura-haccp")).toBe(true);
    expect(isKnownWorkspace("allura-default")).toBe(true);
  });

  it("returns false for unknown workspaces", () => {
    expect(isKnownWorkspace("allura-custom")).toBe(false);
    expect(isKnownWorkspace("roninmemory")).toBe(false);
    expect(isKnownWorkspace("other-workspace")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isKnownWorkspace("ALLURA-FAITH-MEATS")).toBe(true);
    expect(isKnownWorkspace("Allura-Creative")).toBe(true);
  });
});

describe("validateKnownWorkspace", () => {
  it("accepts known workspaces", () => {
    expect(() => validateKnownWorkspace("allura-faith-meats")).not.toThrow();
    expect(validateKnownWorkspace("allura-faith-meats")).toBe("allura-faith-meats");
  });

  it("rejects unknown workspaces", () => {
    expect(() => validateKnownWorkspace("allura-custom")).toThrow(GroupIdValidationError);
    
    try {
      validateKnownWorkspace("allura-custom");
    } catch (error) {
      expect((error as GroupIdValidationError).message).toContain("Unknown workspace");
    }
  });

  it("rejects non-allura formats", () => {
    expect(() => validateKnownWorkspace("roninmemory")).toThrow();
  });
});

describe("exports", () => {
  it("exports ALLURA_WORKSPACES array", () => {
    expect(ALLURA_WORKSPACES).toContain("allura-faith-meats");
    expect(ALLURA_WORKSPACES).toContain("allura-creative");
    expect(ALLURA_WORKSPACES.length).toBe(7);
  });

  it("exports TENANT_ERROR_CODE as RK-01", () => {
    expect(TENANT_ERROR_CODE).toBe("RK-01");
  });
});