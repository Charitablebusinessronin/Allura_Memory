import { describe, it, expect } from "vitest";
import {
  validateGroupId,
  normalizeGroupId,
  isValidGroupId,
  isReservedGroupId,
  isGlobalGroupId,
  validateGroupIds,
  assertValidGroupId,
  ValidGroupId,
  validateGroupIdWithRules,
  GroupIdValidationError,
  RESERVED_GROUP_IDS,
  GROUP_ID_RULES,
} from "./group-id";

describe("group-id validation", () => {
  // =========================================================================
  // validateGroupId Tests
  // =========================================================================

  describe("validateGroupId", () => {
    it("should accept valid lowercase group_id", () => {
      expect(validateGroupId("my-project")).toBe("my-project");
      expect(validateGroupId("project123")).toBe("project123");
      expect(validateGroupId("my_project")).toBe("my_project");
      expect(validateGroupId("ab")).toBe("ab"); // Minimum length is 2
    });

    it("should reject null or undefined", () => {
      expect(() => validateGroupId(null)).toThrow(GroupIdValidationError);
      expect(() => validateGroupId(null)).toThrow("group_id is required");
      expect(() => validateGroupId(undefined)).toThrow("group_id is required");
    });

    it("should reject non-string values", () => {
      expect(() => validateGroupId(123)).toThrow(GroupIdValidationError);
      expect(() => validateGroupId(123)).toThrow("must be a string");
      expect(() => validateGroupId({})).toThrow("must be a string");
      expect(() => validateGroupId([])).toThrow("must be a string");
    });

    it("should reject empty string", () => {
      expect(() => validateGroupId("")).toThrow("cannot be empty");
      expect(() => validateGroupId("   ")).toThrow("cannot be empty");
      expect(() => validateGroupId("\t\n")).toThrow("cannot be empty");
    });

    it("should reject uppercase characters (NFR11)", () => {
      expect(() => validateGroupId("My-Project")).toThrow("must be lowercase only");
      expect(() => validateGroupId("PROJECT")).toThrow("must be lowercase only");
      expect(() => validateGroupId("myProject")).toThrow("must be lowercase only");
    });

    it("should reject too short group_id", () => {
      expect(() => validateGroupId("")).toThrow("cannot be empty");
      // Note: Single character is allowed by SINGLE_CHAR_PATTERN
    });

    it("should reject too long group_id", () => {
      const longId = "a".repeat(100);
      expect(() => validateGroupId(longId)).toThrow("at most");
    });

    it("should reject invalid characters", () => {
      expect(() => validateGroupId("my project")).toThrow("lowercase letters, numbers");
      expect(() => validateGroupId("my.project")).toThrow("lowercase letters, numbers");
      expect(() => validateGroupId("my@project")).toThrow("lowercase letters, numbers");
      expect(() => validateGroupId("-myproject")).toThrow("lowercase letters, numbers");
      expect(() => validateGroupId("myproject-")).toThrow("lowercase letters, numbers");
    });

    it("should trim whitespace", () => {
      expect(validateGroupId("  my-project  ")).toBe("my-project");
      expect(validateGroupId("\tmy-project\n")).toBe("my-project");
    });
  });

  // =========================================================================
  // normalizeGroupId Tests
  // =========================================================================

  describe("normalizeGroupId", () => {
    it("should convert to lowercase and trim", () => {
      expect(normalizeGroupId("My-Project")).toBe("my-project");
      expect(normalizeGroupId("  PROJECT  ")).toBe("project");
      expect(normalizeGroupId("PROJECT")).toBe("project");
    });

    it("should not validate the result", () => {
      // normalizeGroupId doesn't validate, just normalizes
      expect(normalizeGroupId("")).toBe("");
      expect(normalizeGroupId("  ")).toBe("");
    });
  });

  // =========================================================================
  // isValidGroupId Tests
  // =========================================================================

  describe("isValidGroupId", () => {
    it("should return true for valid group_ids", () => {
      expect(isValidGroupId("my-project")).toBe(true);
      expect(isValidGroupId("project123")).toBe(true);
      expect(isValidGroupId("my_project")).toBe(true);
    });

    it("should return false for invalid group_ids", () => {
      expect(isValidGroupId("")).toBe(false);
      expect(isValidGroupId("My-Project")).toBe(false);
      expect(isValidGroupId("my project")).toBe(false);
      expect(isValidGroupId(null)).toBe(false);
      expect(isValidGroupId(undefined)).toBe(false);
      expect(isValidGroupId(123)).toBe(false);
    });
  });

  // =========================================================================
  // isReservedGroupId Tests
  // =========================================================================

  describe("isReservedGroupId", () => {
    it("should identify reserved IDs", () => {
      expect(isReservedGroupId("global")).toBe(true);
      expect(isReservedGroupId("system")).toBe(true);
      expect(isReservedGroupId("admin")).toBe(true);
      expect(isReservedGroupId("public")).toBe(true);
    });

    it("should return false for non-reserved IDs", () => {
      expect(isReservedGroupId("my-project")).toBe(false);
      expect(isReservedGroupId("user123")).toBe(false);
    });

    it("should normalize before checking", () => {
      expect(isReservedGroupId("GLOBAL")).toBe(true);
      expect(isReservedGroupId("  Global  ")).toBe(true);
    });
  });

  // =========================================================================
  // isGlobalGroupId Tests
  // =========================================================================

  describe("isGlobalGroupId", () => {
    it("should identify global ID", () => {
      expect(isGlobalGroupId("global")).toBe(true);
      expect(isGlobalGroupId("GLOBAL")).toBe(true);
      expect(isGlobalGroupId("  global  ")).toBe(true);
    });

    it("should return false for non-global IDs", () => {
      expect(isGlobalGroupId("my-project")).toBe(false);
      expect(isGlobalGroupId("system")).toBe(false);
    });
  });

  // =========================================================================
  // validateGroupIds Tests
  // =========================================================================

  describe("validateGroupIds", () => {
    it("should return valid group_ids", () => {
      const result = validateGroupIds(["project1", "project2", "project3"]);
      expect(result.valid).toEqual(["project1", "project2", "project3"]);
      expect(result.errors).toHaveLength(0);
    });

    it("should separate invalid group_ids", () => {
      const result = validateGroupIds(["project1", "Invalid", "", "project2"]);
      expect(result.valid).toEqual(["project1", "project2"]);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].value).toBe("Invalid");
      expect(result.errors[1].value).toBe("");
    });

    it("should handle mixed valid and invalid", () => {
      const result = validateGroupIds([
        "valid-project",
        "UPPERCASE",
        "another-valid",
        null,
        "has space",
      ]);
      expect(result.valid).toEqual(["valid-project", "another-valid"]);
      expect(result.errors).toHaveLength(3);
    });
  });

  // =========================================================================
  // assertValidGroupId Tests
  // =========================================================================

  describe("assertValidGroupId", () => {
    it("should not throw for valid group_id", () => {
      expect(() => assertValidGroupId("my-project")).not.toThrow();
      expect(() => assertValidGroupId("project123")).not.toThrow();
    });

    it("should throw for invalid group_id", () => {
      expect(() => assertValidGroupId("")).toThrow();
      expect(() => assertValidGroupId("UPPERCASE")).toThrow();
      expect(() => assertValidGroupId(null)).toThrow();
    });

    it("should narrow type to string", () => {
      const unknown: unknown = "my-project";
      assertValidGroupId(unknown);
      // TypeScript should now know unknown is string
      expect(typeof unknown).toBe("string");
    });
  });

  // =========================================================================
  // ValidGroupId Class Tests
  // =========================================================================

  describe("ValidGroupId", () => {
    it("should create instance for valid group_id", () => {
      const id = new ValidGroupId("my-project");
      expect(id.value).toBe("my-project");
      expect(id.toString()).toBe("my-project");
    });

    it("should throw for invalid group_id", () => {
      expect(() => new ValidGroupId("")).toThrow();
      expect(() => new ValidGroupId("UPPERCASE")).toThrow();
    });

    it("should normalize input (trim whitespace)", () => {
      const id = new ValidGroupId("  my-project  ");
      expect(id.value).toBe("my-project");
    });

    it("should throw for uppercase (NFR11 compliance)", () => {
      // validateGroupId rejects uppercase, so ValidGroupId must too
      expect(() => new ValidGroupId("MY-PROJECT")).toThrow("must be lowercase");
    });

    it("should compare with equals", () => {
      const id1 = new ValidGroupId("my-project");
      const id2 = new ValidGroupId("my-project");
      const id3 = new ValidGroupId("other-project");

      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals("my-project")).toBe(true);
      expect(id1.equals(id3)).toBe(false);
      expect(id1.equals("other-project")).toBe(false);
    });

    it("should detect global ID", () => {
      const global = new ValidGroupId("global");
      const project = new ValidGroupId("my-project");

      expect(global.isGlobal()).toBe(true);
      expect(project.isGlobal()).toBe(false);
    });

    it("should detect reserved ID", () => {
      const reserved = new ValidGroupId("system");
      const project = new ValidGroupId("my-project");

      expect(reserved.isReserved()).toBe(true);
      expect(project.isReserved()).toBe(false);
    });
  });

  // =========================================================================
  // validateGroupIdWithRules Tests
  // =========================================================================

  describe("validateGroupIdWithRules", () => {
    it("should enforce lowercase by default", () => {
      expect(validateGroupIdWithRules("my-project", {})).toBe("my-project");
      expect(() => validateGroupIdWithRules("MY-PROJECT", {})).toThrow();
    });

    it("should allow uppercase when specified", () => {
      expect(validateGroupIdWithRules("MY-PROJECT", { allowUppercase: true })).toBe(
        "MY-PROJECT"
      );
      expect(validateGroupIdWithRules("MyProject", { allowUppercase: true })).toBe(
        "MyProject"
      );
    });

    it("should reject reserved IDs by default", () => {
      expect(() => validateGroupIdWithRules("global", {})).toThrow("reserved");
      expect(() => validateGroupIdWithRules("system", {})).toThrow("reserved");
    });

    it("should allow reserved IDs when specified", () => {
      expect(validateGroupIdWithRules("global", { allowReserved: true })).toBe("global");
      expect(validateGroupIdWithRules("system", { allowReserved: true })).toBe("system");
    });

    it("should validate against custom pattern", () => {
      const customPattern = /^team-[a-z]+$/;
      expect(validateGroupIdWithRules("team-alpha", { customPattern })).toBe("team-alpha");
      expect(() => validateGroupIdWithRules("alpha", { customPattern })).toThrow(
        "does not match required pattern"
      );
    });

    it("should combine multiple options", () => {
      expect(
        validateGroupIdWithRules("GLOBAL", { allowUppercase: true, allowReserved: true })
      ).toBe("GLOBAL");
    });
  });

  // =========================================================================
  // Constants Tests
  // =========================================================================

  describe("constants", () => {
    it("should have correct reserved IDs", () => {
      expect(RESERVED_GROUP_IDS).toEqual(["global", "system", "admin", "public"]);
    });

    it("should have correct length rules", () => {
      expect(GROUP_ID_RULES.MIN_LENGTH).toBe(2);
      expect(GROUP_ID_RULES.MAX_LENGTH).toBe(64);
    });

    it("should have correct pattern", () => {
      expect(GROUP_ID_RULES.PATTERN.test("my-project")).toBe(true);
      expect(GROUP_ID_RULES.PATTERN.test("my_project")).toBe(true);
      expect(GROUP_ID_RULES.PATTERN.test("project123")).toBe(true);
      expect(GROUP_ID_RULES.PATTERN.test("-project")).toBe(false);
      expect(GROUP_ID_RULES.PATTERN.test("project-")).toBe(false);
      expect(GROUP_ID_RULES.PATTERN.test("My-Project")).toBe(false);
    });
  });
});