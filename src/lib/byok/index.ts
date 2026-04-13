/**
 * BYOK (Bring Your Own Key) Module — Public API
 *
 * Enterprise feature: Customer-managed encryption keys.
 *
 * Usage:
 *   import { ByokKeyManager, isByokConfigured, createByokKeyManagerFromEnv } from "@/lib/byok";
 *
 *   // Check if BYOK is configured
 *   if (isByokConfigured()) {
 *     const manager = createByokKeyManagerFromEnv();
 *     const encrypted = manager.encrypt("secret data", "allura-my-tenant");
 *     const decrypted = manager.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag, "allura-my-tenant");
 *   }
 */

export {
  ByokKeyManager,
  createByokKeyManagerFromEnv,
  isByokConfigured,
  byokConfigSchema,
} from "./key-manager";

export type {
  KeyAlgorithm,
  KeyStatus,
  KeyMetadata,
  EncryptionResult,
  DecryptionResult,
  ByokConfig,
} from "./key-manager";