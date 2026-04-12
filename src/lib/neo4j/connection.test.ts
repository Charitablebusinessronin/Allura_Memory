import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getDriver,
  getConnectionConfig,
  closeDriver,
  getSession,
  isDriverHealthy,
  verifyConnectivity,
} from "./connection";

/**
 * Neo4j Connection Layer tests
 * Unit tests (getConnectionConfig) run without Neo4j.
 * Integration tests (getDriver, getSession, isDriverHealthy, verifyConnectivity) require running Neo4j.
 */
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";

describe("Neo4j Connection Layer", () => {
  beforeAll(async () => {
    // Ensure environment is configured for tests
    process.env.NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
    process.env.NEO4J_USER = process.env.NEO4J_USER || "neo4j";
    process.env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "KaminaTHC*";
    process.env.NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";
  });

  afterAll(async () => {
    // Clean up driver after all tests
    try {
      await closeDriver();
    } catch {
      // Driver may not be initialized if tests were skipped
    }
  });

  describe("getConnectionConfig", () => {
    it("should build connection config from environment variables", () => {
      const config = getConnectionConfig();

      expect(config.uri).toBe(process.env.NEO4J_URI || "bolt://localhost:7687");
      expect(config.user).toBe(process.env.NEO4J_USER || "neo4j");
      expect(config.password).toBe(process.env.NEO4J_PASSWORD || "KaminaTHC*");
      expect(config.database).toBe(process.env.NEO4J_DATABASE || "neo4j");
    });

    it("should include pool settings", () => {
      const config = getConnectionConfig();

      expect(config.maxConnectionPoolSize).toBeDefined();
      expect(config.maxConnectionPoolSize).toBeGreaterThan(0);
      expect(config.connectionAcquisitionTimeout).toBeDefined();
      expect(config.connectionAcquisitionTimeout).toBeGreaterThan(0);
    });

    it("should use default values when env vars are not set", () => {
      const originalUri = process.env.NEO4J_URI;
      const originalUser = process.env.NEO4J_USER;

      delete process.env.NEO4J_URI;
      delete process.env.NEO4J_USER;

      const config = getConnectionConfig();

      // Restore environment
      if (originalUri !== undefined) process.env.NEO4J_URI = originalUri;
      if (originalUser !== undefined) process.env.NEO4J_USER = originalUser;

      expect(config.uri).toBe("bolt://localhost:7687");
      expect(config.user).toBe("neo4j");
    });

    it("should throw when NEO4J_PASSWORD is missing", () => {
      const originalPassword = process.env.NEO4J_PASSWORD;
      delete process.env.NEO4J_PASSWORD;

      expect(() => getConnectionConfig()).toThrow(
        "NEO4J_PASSWORD environment variable is required"
      );

      // Restore
      if (originalPassword !== undefined) process.env.NEO4J_PASSWORD = originalPassword;
    });
  });

  describe.skipIf(!shouldRunE2E)("getDriver", () => {
    it("should return a singleton Driver instance", () => {
      const driver1 = getDriver();
      const driver2 = getDriver();

      expect(driver1).toBe(driver2);
    });
  });

  describe.skipIf(!shouldRunE2E)("getSession", () => {
    it("should return a session from the driver", () => {
      const session = getSession();

      expect(session).toBeDefined();
      expect(session.run).toBeDefined();

      session.close();
    });

    it("should use specified database name", () => {
      const session = getSession("custom-db");

      // Session should be created without error
      expect(session).toBeDefined();
      session.close();
    });
  });

  describe.skipIf(!shouldRunE2E)("isDriverHealthy", () => {
    it("should return true when connected to Neo4j", async () => {
      const healthy = await isDriverHealthy();

      expect(healthy).toBe(true);
    });
  });

  describe.skipIf(!shouldRunE2E)("verifyConnectivity", () => {
    it("should not throw when connected to Neo4j", async () => {
      // This should not throw
      await expect(verifyConnectivity()).resolves.not.toThrow();
    });
  });

  describe.skipIf(!shouldRunE2E)("closeDriver", () => {
    it("should close the driver and allow reconnection", async () => {
      const driver1 = getDriver();

      await closeDriver();

      // Get a new driver after closing
      const driver2 = getDriver();

      // Should be able to query again
      const healthy = await isDriverHealthy();
      expect(healthy).toBe(true);
    });
  });
});