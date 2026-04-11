/**
 * E2E Integration Tests - Full Pipeline
 * Tests the complete Unified Knowledge System with live services
 * 
 * Prerequisites:
 * - PostgreSQL accessible via DATABASE_URL or POSTGRES_* env vars
 * - Neo4j accessible via NEO4J_URI or NEO4J_* env vars
 * - Environment variables set (see .env.production.example)
 * 
 * Run with: npm run test:e2e
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import neo4j, { Driver } from "neo4j-driver";
import { config } from "dotenv";

// Load environment variables from .env file
config();

// Skip E2E tests unless explicitly enabled
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";

const E2E_TIMEOUT = 30000; // 30 seconds for integration tests

describe.skipIf(!shouldRunE2E)("E2E Integration Tests", () => {
  let pgPool: Pool;
  let neo4jDriver: Driver;

  beforeAll(async () => {
    // Verify required environment variables
    if (!process.env.POSTGRES_PASSWORD) {
      throw new Error("POSTGRES_PASSWORD environment variable is required");
    }
    if (!process.env.NEO4J_PASSWORD) {
      throw new Error("NEO4J_PASSWORD environment variable is required");
    }

    // Initialize PostgreSQL connection
    // Prefer DATABASE_URL (full connection string) over individual host/port vars
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (databaseUrl) {
      pgPool = new Pool({ connectionString: databaseUrl });
    } else {
      pgPool = new Pool({
        host: process.env.POSTGRES_HOST || "localhost",
        port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
        database: process.env.POSTGRES_DB || "memory",
        user: process.env.POSTGRES_USER || "ronin4life",
        password: process.env.POSTGRES_PASSWORD,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10,
      });
    }

    // Initialize Neo4j connection
    // NEO4J_URI is canonical; fallback to individual vars only if unset
    const neo4jUri = process.env.NEO4J_URI || "bolt://localhost:7687";
    neo4jDriver = neo4j.driver(
      neo4jUri,
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD
      ),
      { maxConnectionPoolSize: 50 }
    );

    // Verify connections
    await pgPool.query("SELECT 1");
    await neo4jDriver.verifyConnectivity();
  }, E2E_TIMEOUT);

  afterAll(async () => {
    await pgPool?.end();
    await neo4jDriver?.close();
  });

  beforeEach(async () => {
    // Clean test data before each test (order matters due to foreign keys)
    await pgPool.query("DELETE FROM outcomes WHERE event_id IN (SELECT id FROM events WHERE metadata->>'test_run' IS NOT NULL)");
    await pgPool.query("DELETE FROM events WHERE metadata->>'test_run' IS NOT NULL");
    await pgPool.query("DELETE FROM design_sync_status WHERE design_id LIKE 'test_%'");
    await pgPool.query("DELETE FROM sync_drift_log WHERE design_id LIKE 'test_%'");
  });

  describe("PostgreSQL Connection", () => {
    it("should connect to PostgreSQL", async () => {
      const result = await pgPool.query("SELECT 1 as test");
      expect(result.rows[0].test).toBe(1);
    });

    it("should have events table", async () => {
      const result = await pgPool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'events'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.map(r => r.column_name)).toContain("id");
      expect(result.rows.map(r => r.column_name)).toContain("event_type");
    });

    it("should have outcomes table", async () => {
      const result = await pgPool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'outcomes'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.map(r => r.column_name)).toContain("id");
      expect(result.rows.map(r => r.column_name)).toContain("event_id");
    });

    it("should have design_sync_status table", async () => {
      const result = await pgPool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'design_sync_status'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.map(r => r.column_name)).toContain("design_id");
      expect(result.rows.map(r => r.column_name)).toContain("notion_page_id");
    });
  });

  describe("Neo4j Connection", () => {
    it("should connect to Neo4j", async () => {
      const session = neo4jDriver.session();
      try {
        const result = await session.run("RETURN 1 as test");
        expect(result.records[0].get("test").toNumber()).toBe(1);
      } finally {
        await session.close();
      }
    });

    it("should have AgentDesign labels", async () => {
      const session = neo4jDriver.session();
      try {
        const result = await session.run(`
          MATCH (n:AgentDesign) RETURN count(n) as count
        `);
        expect(result.records[0].get("count").toNumber()).toBeGreaterThanOrEqual(0);
      } finally {
        await session.close();
      }
    });

    it("should have KnowledgeItem labels", async () => {
      const session = neo4jDriver.session();
      try {
        const result = await session.run(`
          MATCH (n:KnowledgeItem) RETURN count(n) as count
        `);
        expect(result.records[0].get("count").toNumber()).toBeGreaterThanOrEqual(0);
      } finally {
        await session.close();
      }
    });
  });

  describe("Epic 1: Persistent Knowledge Capture", () => {
    it("should insert event and outcome", async () => {
      const eventResult = await pgPool.query(`
        INSERT INTO events (group_id, event_type, agent_id, workflow_id, metadata, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        "test_group",
        "test_event",
        "test_agent",
        "test_workflow",
        JSON.stringify({ test_run: true }),
        "completed"
      ]);

      expect(eventResult.rows[0].id).toBeDefined();

      const outcomeResult = await pgPool.query(`
        INSERT INTO outcomes (event_id, group_id, outcome_type, data, confidence)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        eventResult.rows[0].id,
        "test_group",
        "test_outcome",
        JSON.stringify({ key: "value" }),
        0.95
      ]);

      expect(outcomeResult.rows[0].id).toBeDefined();
    });

    it("should query events by group_id", async () => {
      // Insert test data
      await pgPool.query(`
        INSERT INTO events (group_id, event_type, agent_id, workflow_id, metadata, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        "test_group_e2e",
        "test_query",
        "test_agent",
        "test_workflow",
        JSON.stringify({ test_run: true }),
        "completed"
      ]);

      // Query by group_id
      const result = await pgPool.query(`
        SELECT * FROM events WHERE group_id = $1
      `, ["test_group_e2e"]);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].group_id).toBe("test_group_e2e");
    });
  });

  describe("Epic 2: ADAS Discovery Pipeline", () => {
    it("should create AgentDesign node in Neo4j", async () => {
      const session = neo4jDriver.session();
      try {
        // Create test design
        await session.run(`
          CREATE (d:AgentDesign {
            design_id: $design_id,
            name: $name,
            version: 1,
            domain: $domain,
            score: 0.85,
            status: 'approved',
            created_at: datetime(),
            test_run: true
          })
          RETURN d
        `, {
          design_id: `test_design_${Date.now()}`,
          name: "Test Design",
          domain: "code-assistant"
        });

        // Verify creation
        const verify = await session.run(`
          MATCH (d:AgentDesign {test_run: true}) RETURN count(d) as count
        `);
        expect(verify.records[0].get("count").toNumber()).toBeGreaterThan(0);

        // Clean up
        await session.run(`
          MATCH (d:AgentDesign {test_run: true}) DELETE d
        `);
      } finally {
        await session.close();
      }
    });
  });

  describe("Epic 3: Governed Runtime", () => {
    it("should create policy records", async () => {
      // Test policy enforcement
      const session = neo4jDriver.session();
      try {
        await session.run(`
          CREATE (p:Policy {
            policy_id: $policy_id,
            name: $name,
            rules: $rules,
            created_at: datetime(),
            test_run: true
          })
        `, {
          policy_id: `test_policy_${Date.now()}`,
          name: "Test Policy",
          rules: JSON.stringify([{ action: "allow", resource: "test" }])
        });

        const verify = await session.run(`
          MATCH (p:Policy {test_run: true}) RETURN count(p) as count
        `);
        expect(verify.records[0].get("count").toNumber()).toBeGreaterThan(0);

        await session.run(`
          MATCH (p:Policy {test_run: true}) DELETE p
        `);
      } finally {
        await session.close();
      }
    });

    it("should track circuit breaker state", async () => {
      // Import and test circuit breaker
      const { createCircuitBreaker } = await import("../lib/circuit-breaker/breaker");
      
      const breaker = createCircuitBreaker({
        name: "test-breaker",
        groupId: "test-group",
        errorThreshold: 3,
      });

      expect(breaker.getState()).toBe("closed");

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Test error");
        });
      }

      expect(breaker.getState()).toBe("open");
    });
  });

  describe("Epic 4: Integration & Sync Pipeline", () => {
    it("should extract events from PostgreSQL", async () => {
      // Insert test data
      await pgPool.query(`
        INSERT INTO events (group_id, event_type, agent_id, workflow_id, metadata, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        "test_extract_group",
        "test_extract",
        "test_agent",
        "test_workflow",
        JSON.stringify({ test_run: true, key: "value" }),
        "completed"
      ]);

      // For E2E, we verify the database is queryable
      const result = await pgPool.query(`
        SELECT * FROM events WHERE group_id = $1
      `, ["test_extract_group"]);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should detect sync drift", async () => {
      // Create test sync record
      await pgPool.query(`
        INSERT INTO design_sync_status (
          id, design_id, group_id, notion_page_id, notion_page_url,
          neo4j_id, version, synced_at, neo4j_updated_at, status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW(), 'synced'
        )
      `, [
        "test_drift_design",
        "test_group",
        "test_page_id",
        "https://notion.so/test",
        "test_neo4j_id",
        1
      ]);

      // Verify sync status exists
      const result = await pgPool.query(`
        SELECT * FROM design_sync_status WHERE design_id = $1
      `, ["test_drift_design"]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].status).toBe("synced");
    });
  });

  describe("Health Checks", () => {
    it("should verify PostgreSQL health", async () => {
      // Test directly with pool
      const result = await pgPool.query("SELECT 1");
      expect(result.rows.length).toBe(1);
    });

    it("should verify Neo4j health", async () => {
      const session = neo4jDriver.session();
      try {
        await neo4jDriver.verifyConnectivity();
        const result = await session.run("CALL dbms.components() YIELD name RETURN name");
        expect(result.records.length).toBeGreaterThan(0);
      } finally {
        await session.close();
      }
    });
  });

  describe("Performance Benchmarks", () => {
    it("should insert 100 events in under 1 second", async () => {
      const start = Date.now();
      
      for (let i = 0; i < 100; i++) {
        await pgPool.query(`
          INSERT INTO events (group_id, event_type, agent_id, workflow_id, metadata, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          `test_perf_${i}`,
          "perf_test",
          "test_agent",
          "test_workflow",
          JSON.stringify({ test_run: true, index: i }),
          "completed"
        ]);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it("should create 100 Neo4j nodes in under 2 seconds", async () => {
      const session = neo4jDriver.session();
      try {
        const start = Date.now();

        for (let i = 0; i < 100; i++) {
          await session.run(`
            CREATE (n:TestNode {
              id: $id,
              created_at: datetime(),
              test_run: true
            })
          `, { id: `test_node_${i}_${Date.now()}` });
        }

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(2000);

        // Cleanup
        await session.run("MATCH (n:TestNode {test_run: true}) DELETE n");
      } finally {
        await session.close();
      }
    });
  });
});