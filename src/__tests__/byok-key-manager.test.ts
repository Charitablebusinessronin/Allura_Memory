/**
 * BYOK Key Manager Tests
 *
 * Tests for envelope encryption, key derivation, rotation, and group_id enforcement.
 *
 * Usage: bun vitest run src/__tests__/byok-key-manager.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ByokKeyManager,
  createByokKeyManagerFromEnv,
  isByokConfigured,
  byokConfigSchema,
} from "@/lib/byok/key-manager";

// ── Test Master Key ────────────────────────────────────────────────────────────

const TEST_MASTER_KEY = "test-master-key-at-least-32-characters-long-for-security";
const TEST_GROUP_ID = "allura-test-tenant";

// ── Helper ─────────────────────────────────────────────────────────────────────

function createTestManager(): ByokKeyManager {
  return new ByokKeyManager({ masterKey: TEST_MASTER_KEY });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ByokKeyManager", () => {
  let manager: ByokKeyManager;

  beforeEach(() => {
    manager = createTestManager();
  });

  afterEach(() => {
    manager.clearCache();
  });

  // ── Configuration Validation ────────────────────────────────────────────────

  describe("configuration validation", () => {
    it("should accept valid configuration", () => {
      expect(() => new ByokKeyManager({ masterKey: TEST_MASTER_KEY })).not.toThrow();
    });

    it("should reject short master keys", () => {
      expect(() => new ByokKeyManager({ masterKey: "too-short" })).toThrow(
        /Master key must be at least 32 characters/
      );
    });

    it("should accept custom algorithm", () => {
      const mgr = new ByokKeyManager({
        masterKey: TEST_MASTER_KEY,
        algorithm: "aes-256-cbc",
      });
      expect(mgr).toBeDefined();
    });

    it("should accept custom rotation interval", () => {
      const mgr = new ByokKeyManager({
        masterKey: TEST_MASTER_KEY,
        rotationIntervalDays: 30,
      });
      expect(mgr).toBeDefined();
    });

    it("should reject invalid algorithm via Zod", () => {
      expect(() =>
        byokConfigSchema.parse({ masterKey: TEST_MASTER_KEY, algorithm: "invalid" })
      ).toThrow();
    });
  });

  // ── Encryption / Decryption ─────────────────────────────────────────────────

  describe("encryption and decryption", () => {
    it("should encrypt and decrypt a string", () => {
      const plaintext = "Hello, Allura Memory!";
      const encrypted = manager.encrypt(plaintext, TEST_GROUP_ID);
      const decrypted = manager.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        TEST_GROUP_ID
      );

      expect(decrypted.plaintext).toBe(plaintext);
      expect(decrypted.key_version).toBe(1);
    });

    it("should produce different ciphertexts for same plaintext (random IV)", () => {
      const plaintext = "Same content";
      const encrypted1 = manager.encrypt(plaintext, TEST_GROUP_ID);
      const encrypted2 = manager.encrypt(plaintext, TEST_GROUP_ID);

      // Different IVs → different ciphertexts
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

      // Both should decrypt correctly
      const decrypted1 = manager.decrypt(
        encrypted1.ciphertext, encrypted1.iv, encrypted1.tag, TEST_GROUP_ID
      );
      const decrypted2 = manager.decrypt(
        encrypted2.ciphertext, encrypted2.iv, encrypted2.tag, TEST_GROUP_ID
      );
      expect(decrypted1.plaintext).toBe(plaintext);
      expect(decrypted2.plaintext).toBe(plaintext);
    });

    it("should encrypt empty strings", () => {
      const encrypted = manager.encrypt("", TEST_GROUP_ID);
      const decrypted = manager.decrypt(
        encrypted.ciphertext, encrypted.iv, encrypted.tag, TEST_GROUP_ID
      );
      expect(decrypted.plaintext).toBe("");
    });

    it("should encrypt long strings", () => {
      const plaintext = "A".repeat(10000);
      const encrypted = manager.encrypt(plaintext, TEST_GROUP_ID);
      const decrypted = manager.decrypt(
        encrypted.ciphertext, encrypted.iv, encrypted.tag, TEST_GROUP_ID
      );
      expect(decrypted.plaintext).toBe(plaintext);
    });

    it("should encrypt unicode strings", () => {
      const plaintext = "日本語テスト 🚀 émoji ñoño";
      const encrypted = manager.encrypt(plaintext, TEST_GROUP_ID);
      const decrypted = manager.decrypt(
        encrypted.ciphertext, encrypted.iv, encrypted.tag, TEST_GROUP_ID
      );
      expect(decrypted.plaintext).toBe(plaintext);
    });
  });

  // ── Tenant Isolation ────────────────────────────────────────────────────────

  describe("tenant isolation", () => {
    it("should NOT decrypt with a different group_id", () => {
      const plaintext = "Secret data for tenant A";
      const encrypted = manager.encrypt(plaintext, "allura-tenant-a");

      expect(() =>
        manager.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag, "allura-tenant-b")
      ).toThrow();
    });

    it("should enforce group_id format", () => {
      expect(() => manager.encrypt("test", "invalid-group-id")).toThrow(/Invalid group_id/);
      expect(() => manager.encrypt("test", "roninclaw-old")).toThrow(/Invalid group_id/);
      expect(() => manager.encrypt("test", "allura-")).toThrow(/Invalid group_id/);
      expect(() => manager.encrypt("test", "allura-valid-tenant")).not.toThrow();
    });

    it("should produce different ciphertexts for different tenants", () => {
      const plaintext = "Same content, different tenants";
      const encrypted1 = manager.encrypt(plaintext, "allura-tenant-a");
      const encrypted2 = manager.encrypt(plaintext, "allura-tenant-b");

      // Different derived keys → different ciphertexts
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });
  });

  // ── Key Rotation ─────────────────────────────────────────────────────────────

  describe("key rotation", () => {
    it("should rotate keys and increment version", () => {
      const newVersion = manager.rotateKey(TEST_GROUP_ID, 1);
      expect(newVersion).toBe(2);
    });

    it("should decrypt data with old key version after rotation", () => {
      const plaintext = "Data encrypted before rotation";
      const encrypted = manager.encrypt(plaintext, TEST_GROUP_ID, 1);

      // Rotate to version 2
      manager.rotateKey(TEST_GROUP_ID, 1);

      // Old data should still decrypt with version 1
      const decrypted = manager.decrypt(
        encrypted.ciphertext, encrypted.iv, encrypted.tag, TEST_GROUP_ID, 1
      );
      expect(decrypted.plaintext).toBe(plaintext);
    });

    it("should encrypt new data with new key version", () => {
      manager.rotateKey(TEST_GROUP_ID, 1);

      const encrypted = manager.encrypt("New data", TEST_GROUP_ID, 2);
      expect(encrypted.key_version).toBe(2);
      expect(encrypted.key_id).toBe("byok:allura-test-tenant:v2");
    });

    it("should generate correct key IDs", () => {
      expect(manager.getKeyId("allura-my-tenant", 1)).toBe("byok:allura-my-tenant:v1");
      expect(manager.getKeyId("allura-my-tenant", 5)).toBe("byok:allura-my-tenant:v5");
    });
  });

  // ── Rotation Threshold ──────────────────────────────────────────────────────

  describe("rotation threshold", () => {
    it("should indicate rotation needed for old keys", () => {
      const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
      expect(manager.needsRotation(1, ninetyOneDaysAgo)).toBe(true);
    });

    it("should NOT indicate rotation for fresh keys", () => {
      const now = new Date().toISOString();
      expect(manager.needsRotation(1, now)).toBe(false);
    });

    it("should respect custom rotation interval", () => {
      const mgr = new ByokKeyManager({
        masterKey: TEST_MASTER_KEY,
        rotationIntervalDays: 30,
      });
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      expect(mgr.needsRotation(1, thirtyOneDaysAgo)).toBe(true);
    });
  });

  // ── Cache Management ─────────────────────────────────────────────────────────

  describe("cache management", () => {
    it("should cache derived keys", () => {
      // First call derives and caches
      const encrypted1 = manager.encrypt("test", TEST_GROUP_ID);
      // Second call uses cache
      const encrypted2 = manager.encrypt("test", TEST_GROUP_ID);

      // Both should work (different IVs, same key)
      expect(encrypted1.key_id).toBe(encrypted2.key_id);
    });

    it("should clear cache", () => {
      manager.encrypt("test", TEST_GROUP_ID);
      manager.clearCache();
      // Should still work after cache clear (re-derives)
      const encrypted = manager.encrypt("test", TEST_GROUP_ID);
      expect(encrypted).toBeDefined();
    });
  });
});

// ── Environment-Based Configuration ────────────────────────────────────────────

describe("createByokKeyManagerFromEnv", () => {
  const originalMasterKey = process.env.ALLURA_MASTER_KEY;
  const originalAlgorithm = process.env.ALLURA_KEY_ALGORITHM;
  const originalRotationDays = process.env.ALLURA_KEY_ROTATION_DAYS;

  afterEach(() => {
    process.env.ALLURA_MASTER_KEY = originalMasterKey;
    process.env.ALLURA_KEY_ALGORITHM = originalAlgorithm;
    process.env.ALLURA_KEY_ROTATION_DAYS = originalRotationDays;
  });

  it("should create manager from environment variables", () => {
    process.env.ALLURA_MASTER_KEY = "env-master-key-at-least-32-characters-long";
    const mgr = createByokKeyManagerFromEnv();
    expect(mgr).toBeDefined();
  });

  it("should throw when ALLURA_MASTER_KEY is not set", () => {
    delete process.env.ALLURA_MASTER_KEY;
    expect(() => createByokKeyManagerFromEnv()).toThrow(/ALLURA_MASTER_KEY/);
  });

  it("should throw when ALLURA_MASTER_KEY is too short", () => {
    process.env.ALLURA_MASTER_KEY = "too-short";
    expect(() => createByokKeyManagerFromEnv()).toThrow(/at least 32 characters/);
  });
});

describe("isByokConfigured", () => {
  const originalMasterKey = process.env.ALLURA_MASTER_KEY;

  afterEach(() => {
    process.env.ALLURA_MASTER_KEY = originalMasterKey;
  });

  it("should return true when master key is configured", () => {
    process.env.ALLURA_MASTER_KEY = "a-valid-master-key-that-is-at-least-32-chars";
    expect(isByokConfigured()).toBe(true);
  });

  it("should return false when master key is not set", () => {
    delete process.env.ALLURA_MASTER_KEY;
    expect(isByokConfigured()).toBe(false);
  });

  it("should return false when master key is too short", () => {
    process.env.ALLURA_MASTER_KEY = "too-short";
    expect(isByokConfigured()).toBe(false);
  });
});