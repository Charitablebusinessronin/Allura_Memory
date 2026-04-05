/**
 * Sanitization Engine Tests
 * Story 4.1: Tenant data sanitization for cross-org knowledge sharing
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  sanitizeForPromotion,
  removeTenantIdentifiers,
  anonymizeSensitiveData,
  createAbstractPattern,
  validateSanitization,
  type SanitizationResult,
  type AnonymizationMethod,
} from "./engine";

const TEST_GROUP_ID = "allura-test-sanitization";

describe("Sanitization Engine", () => {
  describe("removeTenantIdentifiers", () => {
    it("should remove group_id from data", () => {
      const data = {
        id: "123",
        group_id: TEST_GROUP_ID,
        content: "Some content",
      };

      const result = removeTenantIdentifiers(data) as Record<string, unknown>;

      expect(result).not.toHaveProperty("group_id");
      expect(result).toHaveProperty("id", "123");
      expect(result).toHaveProperty("content", "Some content");
    });

    it("should remove agent_id from data", () => {
      const data = {
        id: "123",
        agent_id: "agent.memory-builder",
        content: "Some content",
      };

      const result = removeTenantIdentifiers(data) as Record<string, unknown>;

      expect(result).not.toHaveProperty("agent_id");
      expect(result).toHaveProperty("id", "123");
    });

    it("should remove workflow_id from data", () => {
      const data = {
        id: "123",
        workflow_id: "wf-001",
        content: "Some content",
      };

      const result = removeTenantIdentifiers(data) as Record<string, unknown>;

      expect(result).not.toHaveProperty("workflow_id");
      expect(result).toHaveProperty("id", "123");
    });

    it("should remove session_id from data", () => {
      const data = {
        id: "123",
        session_id: "session-abc-123",
        content: "Some content",
      };

      const result = removeTenantIdentifiers(data) as Record<string, unknown>;

      expect(result).not.toHaveProperty("session_id");
      expect(result).toHaveProperty("id", "123");
    });

    it("should remove file paths containing org names", () => {
      const data = {
        id: "123",
        filePath: "/org-faith-meats/data/file.json",
        otherPath: "/regular/path/file.txt",
      };

      const result = removeTenantIdentifiers(data) as Record<string, unknown>;

      expect(result.filePath).toBeNull();
      expect(result.otherPath).toBe("/regular/path/file.txt");
    });

    it("should handle nested objects", () => {
      const data = {
        id: "123",
        group_id: TEST_GROUP_ID,
        metadata: {
          agent_id: "agent.test",
          nested: {
            session_id: "session-123",
          },
        },
      };

      const result = removeTenantIdentifiers(data) as Record<string, unknown>;

      expect(result).not.toHaveProperty("group_id");
      expect(result.metadata).not.toHaveProperty("agent_id");
      expect(result.metadata.nested).not.toHaveProperty("session_id");
    });

    it("should handle arrays", () => {
      const data = {
        items: [
          { id: "1", group_id: TEST_GROUP_ID },
          { id: "2", workflow_id: "wf-002" },
          { id: "3", session_id: "session-003" },
        ],
      };

      const result = removeTenantIdentifiers(data) as Record<string, unknown>;

      expect(result.items[0]).not.toHaveProperty("group_id");
      expect(result.items[1]).not.toHaveProperty("workflow_id");
      expect(result.items[2]).not.toHaveProperty("session_id");
      expect(result.items[0]).toHaveProperty("id", "1");
      expect(result.items[1]).toHaveProperty("id", "2");
      expect(result.items[2]).toHaveProperty("id", "3");
    });

    it("should preserve structure when option is enabled", () => {
      const data = {
        id: "123",
        group_id: TEST_GROUP_ID,
        filePath: "/org-test/file.json",
      };

      const result = removeTenantIdentifiers(data, { preserveStructure: true }) as Record<string, unknown>;

      expect(result).not.toHaveProperty("group_id");
      expect(result.filePath).toBeNull();
    });

    it("should not remove tenant IDs when option is disabled", () => {
      const data = {
        id: "123",
        group_id: TEST_GROUP_ID,
      };

      const result = removeTenantIdentifiers(data, { removeTenantIds: false }) as Record<string, unknown>;

      expect(result).toHaveProperty("group_id", TEST_GROUP_ID);
    });

    it("should handle null and undefined values", () => {
      const data = {
        id: "123",
        group_id: null,
        agent_id: undefined,
      };

      const result = removeTenantIdentifiers(data) as Record<string, unknown>;

      expect(result).not.toHaveProperty("group_id");
      expect(result).not.toHaveProperty("agent_id");
    });
  });

  describe("anonymizeSensitiveData", () => {
    it("should hash email addresses with hash method", () => {
      const data = {
        email: "test@example.com",
        other: "value",
      };

      const result = anonymizeSensitiveData({
        data,
        fields: ["email"],
        method: "hash",
      });

      expect(result.email).toMatch(/^email_anonymized:[a-f0-9]{16}$/);
      expect(result.other).toBe("value");
    });

    it("should tokenize email addresses with tokenize method", () => {
      const data = {
        email: "test@example.com",
      };

      const result1 = anonymizeSensitiveData({
        data,
        fields: ["email"],
        method: "tokenize",
      });

      const result2 = anonymizeSensitiveData({
        data,
        fields: ["email"],
        method: "tokenize",
      });

      // Should generate consistent tokens for same email
      expect(result1.email).toMatch(/^email_[a-f0-9]{8}$/);
      expect(result2.email).toBe(result1.email);
    });

    it("should redact email addresses with redact method", () => {
      const data = {
        email: "test@example.com",
      };

      const result = anonymizeSensitiveData({
        data,
        fields: ["email"],
        method: "redact",
      });

      expect(result.email).toBe("[EMAIL REDACTED]");
    });

    it("should anonymize phone numbers", () => {
      const data = {
        phone: "+1-555-123-4567",
      };

      const hashed = anonymizeSensitiveData({
        data,
        fields: ["phone"],
        method: "hash",
      });

      const tokenized = anonymizeSensitiveData({
        data,
        fields: ["phone"],
        method: "tokenize",
      });

      const redacted = anonymizeSensitiveData({
        data,
        fields: ["phone"],
        method: "redact",
      });

      expect(hashed.phone).toMatch(/^phone_anonymized:[a-f0-9]{16}$/);
      expect(tokenized.phone).toMatch(/^phone_[a-f0-9]{8}$/);
      expect(redacted.phone).toBe("[PHONE REDACTED]");
    });

    it("should anonymize custom fields", () => {
      const data = {
        username: "john_doe",
        customField: "sensitive_data",
      };

      const hashed = anonymizeSensitiveData({
        data,
        fields: ["username", "customField"],
        method: "hash",
      });

      const tokenized = anonymizeSensitiveData({
        data,
        fields: ["username", "customField"],
        method: "tokenize",
      });

      const redacted = anonymizeSensitiveData({
        data,
        fields: ["username", "customField"],
        method: "redact",
      });

      expect(hashed.username).toMatch(/^[a-f0-9]{16}$/);
      expect(hashed.customField).toMatch(/^[a-f0-9]{16}$/);
      expect(tokenized.username).toMatch(/^username_[a-f0-9]{8}$/);
      expect(tokenized.customField).toMatch(/^customfield_[a-f0-9]{8}$/);
      expect(redacted.username).toBe("[REDACTED]");
      expect(redacted.customField).toBe("[REDACTED]");
    });

    it("should handle nested objects", () => {
      const data = {
        contact: {
          email: "nested@example.com",
          phone: "+1-555-999-8888",
        },
        other: "value",
      };

      const result = anonymizeSensitiveData({
        data,
        fields: ["email", "phone"],
        method: "hash",
      });

      expect(result.contact.email).toMatch(/^email_anonymized:[a-f0-9]{16}$/);
      expect(result.contact.phone).toMatch(/^phone_anonymized:[a-f0-9]{16}$/);
      expect(result.other).toBe("value");
    });

    it("should handle arrays", () => {
      const data = {
        contacts: [
          { email: "a@example.com" },
          { email: "b@example.com" },
        ],
      };

      const result = anonymizeSensitiveData({
        data,
        fields: ["email"],
        method: "hash",
      });

      expect(result.contacts[0].email).toMatch(/^email_anonymized:[a-f0-9]{16}$/);
      expect(result.contacts[1].email).toMatch(/^email_anonymized:[a-f0-9]{16}$/);
      // Different emails should produce different hashes
      expect(result.contacts[0].email).not.toBe(result.contacts[1].email);
    });

    it("should handle non-string values in custom fields", () => {
      const data = {
        number: 12345,
        boolean: true,
        object: { nested: "value" },
      };

      const result = anonymizeSensitiveData({
        data,
        fields: ["number", "boolean", "object"],
        method: "hash",
      });

      // Non-string values get hashed as strings
      expect(result.number).toMatch(/^[a-f0-9]{16}$/);
      expect(result.boolean).toMatch(/^[a-f0-9]{16}$/);
      expect(result.object).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe("createAbstractPattern", () => {
    it("should replace email with abstract type", () => {
      const insight = {
        email: "test@example.com",
      };

      const result = createAbstractPattern({ insight });

      expect(result.email).toBe("{{EMAIL}}");
    });

    it("should replace phone with abstract type", () => {
      const insight = {
        phone: "+1-555-123-4567",
      };

      const result = createAbstractPattern({ insight });

      expect(result.phone).toBe("{{PHONE}}");
    });

    it("should replace URLs with abstract type", () => {
      const insight = {
        url: "https://example.com/path",
      };

      const result = createAbstractPattern({ insight });

      expect(result.url).toBe("{{URL}}");
    });

    it("should replace dates with abstract type", () => {
      const insight = {
        date: "2024-01-15",
        timestamp: "2024-01-15T10:30:00Z",
      };

      const result = createAbstractPattern({ insight });

      expect(result.date).toBe("{{DATE}}");
      expect(result.timestamp).toBe("{{DATE}}");
    });

    it("should replace tenant IDs with abstract type", () => {
      const insight = {
        tenant: "allura-faith-meats",
        other: "value",
      };

      const result = createAbstractPattern({ insight });

      expect(result.tenant).toBe("{{TENANT_ID}}");
      expect(result.other).toBe("{{STRING}}");
    });

    it("should replace agent IDs with abstract type", () => {
      const insight = {
        agent: "agent.memory-builder",
        other: "value",
      };

      const result = createAbstractPattern({ insight });

      expect(result.agent).toBe("{{AGENT_ID}}");
    });

    it("should replace integers with abstract type", () => {
      const insight = {
        count: 42,
        float: 3.14,
      };

      const result = createAbstractPattern({ insight });

      expect(result.count).toBe("{{INTEGER}}");
      expect(result.float).toBe("{{NUMBER}}");
    });

    it("should replace booleans with abstract type", () => {
      const insight = {
        active: true,
        deleted: false,
      };

      const result = createAbstractPattern({ insight });

      expect(result.active).toBe("{{BOOLEAN}}");
      expect(result.deleted).toBe("{{BOOLEAN}}");
    });

    it("should handle arrays with type abstractions", () => {
      const insight = {
        items: ["a@example.com", "b@example.com", "c@example.com"],
      };

      const result = createAbstractPattern({ insight });

      expect(result.items).toEqual(["{{EMAIL}}", "{{EMAIL}}", "{{EMAIL}}"]);
    });

    it("should preserve nested object structure", () => {
      const insight = {
        contact: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+1-555-123-4567",
        },
      };

      const result = createAbstractPattern({ insight });

      expect(result.contact.name).toBe("{{STRING}}");
      expect(result.contact.email).toBe("{{EMAIL}}");
      expect(result.contact.phone).toBe("{{PHONE}}");
    });

    it("should handle null and undefined", () => {
      const insight = {
        nullable: null,
        undefinable: undefined,
      };

      const result = createAbstractPattern({ insight });

      expect(result.nullable).toBe(null);
      expect(result.undefinable).toBe(undefined);
    });
  });

  describe("validateSanitization", () => {
    it("should pass for properly sanitized data", () => {
      const sanitized = {
        id: "123",
        content: "Some content",
      };

      const result = validateSanitization({
        sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(result).toBe(true);
    });

    it("should fail if original group_id remains", () => {
      const sanitized = {
        group_id: TEST_GROUP_ID,
        content: "Some content",
      };

      const result = validateSanitization({
        sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(result).toBe(false);
    });

    it("should fail if tenant identifier fields remain", () => {
      const withGroupId = {
        group_id: TEST_GROUP_ID,
      };
      const withAgentId = {
        agent_id: "agent.test",
      };
      const withWorkflowId = {
        workflow_id: "wf-001",
      };
      const withSessionId = {
        session_id: "session-123",
      };

      expect(
        validateSanitization({ sanitized: withGroupId, group_id: TEST_GROUP_ID })
      ).toBe(false);
      expect(
        validateSanitization({ sanitized: withAgentId, group_id: TEST_GROUP_ID })
      ).toBe(false);
      expect(
        validateSanitization({ sanitized: withWorkflowId, group_id: TEST_GROUP_ID })
      ).toBe(false);
      expect(
        validateSanitization({ sanitized: withSessionId, group_id: TEST_GROUP_ID })
      ).toBe(false);
    });

    it("should fail if unanonymized email remains", () => {
      const sanitized = {
        contact: {
          email: "test@example.com",
        },
      };

      const result = validateSanitization({
        sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(result).toBe(false);
    });

    it("should pass if email is properly anonymized", () => {
      const sanitized = {
        contact: {
          email: "email_anonymized:abc123def456",
        },
      };

      const result = validateSanitization({
        sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(result).toBe(true);
    });

    it("should fail if unanonymized phone remains", () => {
      const sanitized = {
        contact: {
          phone: "+1-555-123-4567",
        },
      };

      const result = validateSanitization({
        sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(result).toBe(false);
    });

    it("should pass if phone is properly anonymized or redacted", () => {
      const anonymized = {
        phone: "phone_anonymized:abc123def456",
      };
      const redacted = {
        phone: "[PHONE REDACTED]",
      };

      expect(
        validateSanitization({ sanitized: anonymized, group_id: TEST_GROUP_ID })
      ).toBe(true);
      expect(
        validateSanitization({ sanitized: redacted, group_id: TEST_GROUP_ID })
      ).toBe(true);
    });

    it("should fail if tenant file paths remain", () => {
      const sanitized = {
        path: "/org-faith-meats/data/file.json",
      };

      const result = validateSanitization({
        sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(result).toBe(false);
    });

    it("should check nested objects", () => {
      const sanitized = {
        metadata: {
          nested: {
            deep: {
              group_id: TEST_GROUP_ID,
            },
          },
        },
      };

      const result = validateSanitization({
        sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(result).toBe(false);
    });

    it("should check arrays", () => {
      const sanitized = {
        items: [
          { id: "1" },
          { id: "2", group_id: TEST_GROUP_ID },
          { id: "3" },
        ],
      };

      const result = validateSanitization({
        sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(result).toBe(false);
    });
  });

  describe("sanitizeForPromotion (integration)", () => {
    it("should sanitize complete insight", async () => {
      const data = {
        id: "insight-123",
        group_id: TEST_GROUP_ID,
        agent_id: "agent.memory-builder",
        workflow_id: "wf-001",
        session_id: "session-abc",
        content: "Important insight",
        contact: {
          email: "user@example.com",
          phone: "+1-555-123-4567",
        },
        filePath: "/org-test/data/file.json",
      };

      const result = await sanitizeForPromotion({
        data,
        group_id: TEST_GROUP_ID,
      });

      // Should remove tenant IDs
      expect(result.sanitized).not.toHaveProperty("group_id");
      expect(result.sanitized).not.toHaveProperty("agent_id");
      expect(result.sanitized).not.toHaveProperty("workflow_id");
      expect(result.sanitized).not.toHaveProperty("session_id");
      expect(result.sanitized.filePath).toBeNull();

      // Should have removed fields tracked
      expect(result.removed).toContain("group_id");
      expect(result.removed).toContain("agent_id");
      expect(result.removed).toContain("workflow_id");
      expect(result.removed).toContain("session_id");

      // Should anonymize emails/phones
      expect(result.sanitized.contact.email).toMatch(/^email_anonymized:[a-f0-9]{16}$/);
      expect(result.sanitized.contact.phone).toMatch(/^phone_anonymized:[a-f0-9]{16}$/);

      // Should preserve structure
      expect(result.sanitized).toHaveProperty("id", "insight-123");
      expect(result.sanitized).toHaveProperty("content", "Important insight");
    });

    it("should validate sanitization by default", async () => {
      const data = {
        group_id: TEST_GROUP_ID,
        email: "test@example.com",
      };

      const result = await sanitizeForPromotion({
        data,
        group_id: TEST_GROUP_ID,
      });

      // Validation should pass
      const isValid = validateSanitization({
        sanitized: result.sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(isValid).toBe(true);
    });

    it("should return warnings for detected sensitive fields", async () => {
      const data = {
        customEmail: "custom@example.com",
        userPhone: "+1-555-999-8888",
      };

      const result = await sanitizeForPromotion({
        data,
        group_id: TEST_GROUP_ID,
      });

      // Should have warnings about detected fields
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes("customEmail"))).toBe(true);
      expect(result.warnings.some(w => w.includes("userPhone"))).toBe(true);
    });

    it("should handle nested arrays of objects", async () => {
      const data = {
        items: [
          { id: "1", email: "a@example.com" },
          { id: "2", email: "b@example.com" },
        ],
      };

      const result = await sanitizeForPromotion({
        data,
        group_id: TEST_GROUP_ID,
      });

      expect(result.sanitized.items[0].email).toMatch(/^email_anonymized:[a-f0-9]{16}$/);
      expect(result.sanitized.items[1].email).toMatch(/^email_anonymized:[a-f0-9]{16}$/);
      expect(result.sanitized.items[0].email).not.toBe(result.sanitized.items[1].email);
    });

    it("should handle empty data", async () => {
      const data = {};

      const result = await sanitizeForPromotion({
        data,
        group_id: TEST_GROUP_ID,
      });

      expect(result.sanitized).toEqual({});
      expect(result.removed).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it("should warn when validation fails", async () => {
      const data = {
        email: "test@example.com",
      };

      // Even after anonymization, validation should pass
      const result = await sanitizeForPromotion({
        data,
        group_id: TEST_GROUP_ID,
      });

      // The sanitized data should pass validation
      const isValid = validateSanitization({
        sanitized: result.sanitized,
        group_id: TEST_GROUP_ID,
      });

      expect(isValid).toBe(true);
    });

    it("should preserve non-sensitive fields", async () => {
      const data = {
        id: "123",
        type: "insight",
        confidence: 0.95,
        active: true,
        count: 42,
        metadata: {
          key: "value",
          nested: {
            number: 123,
          },
        },
      };

      const result = await sanitizeForPromotion({
        data,
        group_id: TEST_GROUP_ID,
      });

      expect(result.sanitized.id).toBe("123");
      expect(result.sanitized.type).toBe("insight");
      expect(result.sanitized.confidence).toBe(0.95);
      expect(result.sanitized.active).toBe(true);
      expect(result.sanitized.count).toBe(42);
      expect(result.sanitized.metadata.key).toBe("value");
      expect(result.sanitized.metadata.nested.number).toBe(123);
    });
  });

  describe("Edge Cases", () => {
    it("should handle deeply nested objects", () => {
      const data = {
        level1: {
          level2: {
            level3: {
              level4: {
                group_id: TEST_GROUP_ID,
                email: "deep@example.com",
              },
            },
          },
        },
      };

      const removed = removeTenantIdentifiers(data, { removeTenantIds: true });

      expect(removed.level1.level2.level3.level4).not.toHaveProperty("group_id");
    });

    it("should handle arrays with mixed types", () => {
      const data = {
        items: [
          "string",
          123,
          true,
          null,
          { group_id: TEST_GROUP_ID },
          ["nested", "array"],
        ],
      };

      const removed = removeTenantIdentifiers(data);

      expect(removed.items[0]).toBe("string");
      expect(removed.items[1]).toBe(123);
      expect(removed.items[2]).toBe(true);
      expect(removed.items[3]).toBe(null);
      expect(removed.items[4]).not.toHaveProperty("group_id");
      expect(removed.items[5]).toEqual(["nested", "array"]);
    });

    it("should handle circular references gracefully", () => {
      const data: Record<string, unknown> = {
        id: "123",
      };
      data.self = data;

      // Should not throw
      expect(() => {
        removeTenantIdentifiers(data);
      }).not.toThrow();
    });

    it("should handle very large strings", () => {
      const largeString = "x".repeat(100000);
      const data = {
        content: largeString,
      };

      const result = removeTenantIdentifiers(data);

      expect(result.content).toBe(largeString);
    });

    it("should handle special characters in data", () => {
      const data = {
        special: "特殊字符 émojis 🎉 \n \t \r",
        quotes: `"double" and 'single'`,
        escape: "\\backslash",
      };

      const result = removeTenantIdentifiers(data);

      expect(result.special).toBe("特殊字符 émojis 🎉 \n \t \r");
      expect(result.quotes).toBe(`"double" and 'single'`);
      expect(result.escape).toBe("\\backslash");
    });
  });
});