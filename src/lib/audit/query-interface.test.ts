import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  queryDecisionProvenance,
  queryRuleVersions,
  reconstructEvidenceChain,
  reviewHumanOverrides,
  exportAuditTrail,
  type AuditQuery,
  type ProvenanceChain,
  type RuleVersion,
  type EvidenceChain,
  type HumanOverride,
} from "./query-interface";
import { getPool, closePool } from "../postgres/connection";
import { getDriver, closeDriver, readTransaction, writeTransaction, type ManagedTransaction } from "../neo4j/connection";
import { insertEvent, type EventInsert } from "../postgres/queries/insert-trace";

describe("Audit Query Interface", () => {
  const testGroupId = "audit-query-test-group";
  const testAgentId = "audit-query-agent";

  beforeAll(async () => {
    // Configure PostgreSQL
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";

    // Configure Neo4j
    process.env.NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
    process.env.NEO4J_USER = process.env.NEO4J_USER || "neo4j";
    process.env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "KaminaTHC*";
    process.env.NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

    // Clean up any previous test data
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1", [testGroupId]);

    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (d:Decision) WHERE d.group_id = $group_id DETACH DELETE d",
        { group_id: testGroupId }
      );
      await session.run(
        "MATCH (r:RuleVersion) WHERE r.group_id = $group_id DETACH DELETE r",
        { group_id: testGroupId }
      );
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    // Clean up test data
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1", [testGroupId]);

    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (d:Decision) WHERE d.group_id = $group_id DETACH DELETE d",
        { group_id: testGroupId }
      );
      await session.run(
        "MATCH (r:RuleVersion) WHERE r.group_id = $group_id DETACH DELETE r",
        { group_id: testGroupId }
      );
    } finally {
      await session.close();
    }

    await closePool();
    await closeDriver();
  });

  beforeEach(async () => {
    // Clean up before each test
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1", [testGroupId]);

    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (d:Decision) WHERE d.group_id = $group_id DETACH DELETE d",
        { group_id: testGroupId }
      );
      await session.run(
        "MATCH (r:RuleVersion) WHERE r.group_id = $group_id DETACH DELETE r",
        { group_id: testGroupId }
      );
    } finally {
      await session.close();
    }
  });

  // =========================================================================
  // queryDecisionProvenance Tests
  // =========================================================================

  describe("queryDecisionProvenance", () => {
    it("should return provenance chain for decision", async () => {
      // Create a decision node in Neo4j
      const decisionId = "decision-prov-test-1";
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: $decision_id,
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'policy_check',
            inputs: $inputs,
            reasoning: $reasoning,
            outcome: $outcome,
            confidence: 0.95,
            created_at: datetime(),
            parent_decision_id: null
          })
          RETURN d
          `,
          {
            decision_id: decisionId,
            group_id: testGroupId,
            agent_id: testAgentId,
            inputs: JSON.stringify({ userId: "user-123", action: "approve" }),
            reasoning: "Policy check passed for user",
            outcome: "approved",
          }
        );
      });

      const result = await queryDecisionProvenance({
        decision_id: decisionId,
        group_id: testGroupId,
      });

      expect(result).not.toBeNull();
      expect(result?.decision_id).toBe(decisionId);
      expect(result?.group_id).toBe(testGroupId);
      expect(result?.agent_id).toBe(testAgentId);
      expect(result?.decision_type).toBe("policy_check");
      expect(Array.isArray(result?.inputs)).toBe(true);
      expect(Array.isArray(result?.chain)).toBe(true);
    });

    it("should follow parent decision chain", async () => {
      // Create parent and child decisions
      const parentId = "decision-parent-1";
      const childId = "decision-child-1";

      // Create parent
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: $decision_id,
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'budget_check',
            inputs: '[]',
            reasoning: $reasoning,
            outcome: 'passed',
            confidence: 0.90,
            created_at: datetime(),
            parent_decision_id: null
          })
          `,
          {
            decision_id: parentId,
            group_id: testGroupId,
            agent_id: testAgentId,
            reasoning: "Initial budget check",
          }
        );

        // Create child linked to parent
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: $decision_id,
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'policy_check',
            inputs: '[]',
            reasoning: $reasoning,
            outcome: 'approved',
            confidence: 0.95,
            created_at: datetime(),
            parent_decision_id: $parent_id
          })
          `,
          {
            decision_id: childId,
            group_id: testGroupId,
            agent_id: testAgentId,
            reasoning: "Policy check after budget",
            parent_id: parentId,
          }
        );
      });

      const result = await queryDecisionProvenance({
        decision_id: childId,
        group_id: testGroupId,
      });

      expect(result).not.toBeNull();
      expect(result?.chain.length).toBe(2);
      expect(result?.chain[0].decision_id).toBe(childId);
      expect(result?.chain[1].decision_id).toBe(parentId);
    });

    it("should return null for non-existent decision", async () => {
      const result = await queryDecisionProvenance({
        decision_id: "non-existent-decision",
        group_id: testGroupId,
      });

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // queryRuleVersions Tests
  // =========================================================================

  describe("queryRuleVersions", () => {
    it("should return rule version history", async () => {
      const ruleId = "rule-version-test-1";

      // Create multiple versions of a rule
      await writeTransaction(async (tx: ManagedTransaction) => {
        // Version 1
        await tx.run(
          `
          CREATE (r:RuleVersion {
            rule_id: $rule_id,
            version: 1,
            group_id: $group_id,
            content: $content,
            created_at: datetime({year: 2024, month: 1, day: 1}),
            created_by: 'agent-1',
            change_description: 'Initial version'
          })
          `,
          {
            rule_id: ruleId,
            group_id: testGroupId,
            content: "Original rule content",
          }
        );

        // Version 2
        await tx.run(
          `
          CREATE (r:RuleVersion {
            rule_id: $rule_id,
            version: 2,
            group_id: $group_id,
            content: $content,
            created_at: datetime({year: 2024, month: 2, day: 1}),
            created_by: 'agent-2',
            change_description: 'Updated threshold'
          })
          `,
          {
            rule_id: ruleId,
            group_id: testGroupId,
            content: "Updated rule content with new threshold",
          }
        );
      });

      const result = await queryRuleVersions({
        rule_id: ruleId,
        group_id: testGroupId,
      });

      expect(result.length).toBe(2);
      expect(result[0].version).toBe(2); // Most recent first
      expect(result[1].version).toBe(1);
      expect(result[0].content).toContain("threshold");
      expect(result[1].content).toBe("Original rule content");
    });

    it("should filter by time range", async () => {
      const ruleId = "rule-time-filter";

      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (r:RuleVersion {
            rule_id: $rule_id,
            version: 1,
            group_id: $group_id,
            content: 'Content',
            created_at: datetime({year: 2024, month: 1, day: 1}),
            created_by: 'agent-1',
            change_description: 'V1'
          })
          CREATE (r2:RuleVersion {
            rule_id: $rule_id,
            version: 2,
            group_id: $group_id,
            content: 'Content 2',
            created_at: datetime({year: 2024, month: 3, day: 1}),
            created_by: 'agent-2',
            change_description: 'V2'
          })
          `,
          { rule_id: ruleId, group_id: testGroupId }
        );
      });

      const result = await queryRuleVersions({
        rule_id: ruleId,
        group_id: testGroupId,
        time_range: {
          start: new Date("2024-02-01"),
          end: new Date("2024-04-01"),
        },
      });

      expect(result.length).toBe(1);
      expect(result[0].version).toBe(2);
    });

    it("should enforce group_id isolation", async () => {
      const ruleId = "rule-isolation-test";

      // Create rule in test group
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (r:RuleVersion {
            rule_id: $rule_id,
            version: 1,
            group_id: $group_id,
            content: 'test',
            created_at: datetime(),
            created_by: 'agent',
            change_description: 'Test'
          })
          `,
          { rule_id: ruleId, group_id: testGroupId }
        );
      });

      // Query with different group_id
      const result = await queryRuleVersions({
        rule_id: ruleId,
        group_id: "other-group-isolation",
      });

      expect(result.length).toBe(0);
    });
  });

  // =========================================================================
  // reconstructEvidenceChain Tests
  // =========================================================================

  describe("reconstructEvidenceChain", () => {
    it("should reconstruct evidence chain for decision", async () => {
      // Create a decision with inputs
      const decisionId = "decision-evidence-test";
      const eventId = await insertEvent({
        group_id: testGroupId,
        event_type: "data_source_event",
        agent_id: testAgentId,
        metadata: { source: "api", data: { key: "value" } },
      });

      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: $decision_id,
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'data_check',
            inputs: $inputs,
            reasoning: 'Data validated',
            outcome: 'valid',
            confidence: 0.88,
            created_at: datetime()
          })
          `,
          {
            decision_id: decisionId,
            group_id: testGroupId,
            agent_id: testAgentId,
            inputs: JSON.stringify([
              { type: "postgres_event", ref: `events:${eventId.id}` },
              { type: "rule", ref: "rule-123" },
            ]),
          }
        );
      });

      const result = await reconstructEvidenceChain({
        decision_id: decisionId,
        group_id: testGroupId,
      });

      expect(result).not.toBeNull();
      expect(result?.decision_id).toBe(decisionId);
      expect(result?.inputs.length).toBe(2);
      expect(result?.inputs[0].type).toBe("postgres_event");
      expect(result?.inputs[0].resolved).toBe(true);
    });

    it("should handle missing evidence gracefully", async () => {
      const decisionId = "decision-missing-evidence";

      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: $decision_id,
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'test',
            inputs: $inputs,
            reasoning: 'Test',
            outcome: 'test',
            confidence: 0.5,
            created_at: datetime()
          })
          `,
          {
            decision_id: decisionId,
            group_id: testGroupId,
            agent_id: testAgentId,
            inputs: JSON.stringify([
              { type: "postgres_event", ref: "events:99999999" },
              { type: "missing_rule", ref: "rule-nonexistent" },
            ]),
          }
        );
      });

      const result = await reconstructEvidenceChain({
        decision_id: decisionId,
        group_id: testGroupId,
      });

      expect(result).not.toBeNull();
      expect(result?.inputs.length).toBe(2);
      expect(result?.inputs[0].resolved).toBe(false);
      expect(result?.inputs[1].resolved).toBe(false);
    });
  });

  // =========================================================================
  // reviewHumanOverrides Tests
  // =========================================================================

  describe("reviewHumanOverrides", () => {
    it("should return human override records", async () => {
      // Create decision with human override
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: 'override-test-1',
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'approval',
            inputs: '[]',
            reasoning: 'Agent recommended rejection',
            outcome: 'approved',
            confidence: 0.75,
            created_at: datetime(),
            human_override: true,
            override_by: 'user-admin-1',
            override_reason: 'Business exception granted',
            override_at: datetime()
          })
          `,
          { group_id: testGroupId, agent_id: testAgentId }
        );

        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: 'override-test-2',
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'approval',
            inputs: '[]',
            reasoning: 'Agent approved',
            outcome: 'approved',
            confidence: 0.90,
            created_at: datetime()
          })
          `,
          { group_id: testGroupId, agent_id: testAgentId }
        );
      });

      const result = await reviewHumanOverrides({
        group_id: testGroupId,
      });

      expect(result.length).toBe(1);
      expect(result[0].decision_id).toBe("override-test-1");
      expect(result[0].override_by).toBe("user-admin-1");
      expect(result[0].override_reason).toBe("Business exception granted");
    });

    it("should filter by time range", async () => {
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: 'override-time-1',
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'test',
            inputs: '[]',
            reasoning: 'Test',
            outcome: 'approved',
            confidence: 0.8,
            created_at: datetime({year: 2024, month: 1, day: 1}),
            human_override: true,
            override_by: 'user-1',
            override_reason: 'Test override',
            override_at: datetime({year: 2024, month: 1, day: 1})
          })
          `,
          { group_id: testGroupId, agent_id: testAgentId }
        );

        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: 'override-time-2',
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'test',
            inputs: '[]',
            reasoning: 'Test',
            outcome: 'approved',
            confidence: 0.8,
            created_at: datetime({year: 2024, month: 3, day: 1}),
            human_override: true,
            override_by: 'user-2',
            override_reason: 'Later override',
            override_at: datetime({year: 2024, month: 3, day: 1})
          })
          `,
          { group_id: testGroupId, agent_id: testAgentId }
        );
      });

      const result = await reviewHumanOverrides({
        group_id: testGroupId,
        time_range: {
          start: new Date("2024-02-01"),
          end: new Date("2024-04-01"),
        },
      });

      expect(result.length).toBe(1);
      expect(result[0].decision_id).toBe("override-time-2");
    });
  });

  // =========================================================================
  // exportAuditTrail Tests
  // =========================================================================

  describe("exportAuditTrail", () => {
    it("should export audit trail as JSON", async () => {
      // Create decision
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: 'export-json-test',
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'export_test',
            inputs: '[]',
            reasoning: 'Test decision for export',
            outcome: 'success',
            confidence: 0.85,
            created_at: datetime()
          })
          `,
          { group_id: testGroupId, agent_id: testAgentId }
        );
      });

      const query: AuditQuery = {
        type: "provenance",
        group_id: testGroupId,
      };

      const buffer = await exportAuditTrail({
        query,
        format: "json",
      });

      const json = JSON.parse(buffer.toString("utf-8"));
      expect(Array.isArray(json.decisions)).toBe(true);
      expect(json.query.type).toBe("provenance");
      expect(json.query.group_id).toBe(testGroupId);
    });

    it("should export audit trail as CSV", async () => {
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: 'export-csv-test',
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'csv_export',
            inputs: '[]',
            reasoning: 'CSV test',
            outcome: 'success',
            confidence: 0.92,
            created_at: datetime()
          })
          `,
          { group_id: testGroupId, agent_id: testAgentId }
        );
      });

      const query: AuditQuery = {
        type: "provenance",
        group_id: testGroupId,
      };

      const buffer = await exportAuditTrail({
        query,
        format: "csv",
      });

      const csv = buffer.toString("utf-8");
      expect(csv).toContain("decision_id");
      expect(csv).toContain("decision_type");
      expect(csv).toContain("group_id");
    });

    it("should export full audit trail", async () => {
      // Create decision and rule
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: 'full-export-test',
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'full_test',
            inputs: '[]',
            reasoning: 'Full export test',
            outcome: 'approved',
            confidence: 0.88,
            created_at: datetime()
          })
          `,
          { group_id: testGroupId, agent_id: testAgentId }
        );

        await tx.run(
          `
          CREATE (r:RuleVersion {
            rule_id: 'rule-full-export',
            version: 1,
            group_id: $group_id,
            content: 'Rule content',
            created_at: datetime(),
            created_by: 'agent',
            change_description: 'Initial'
          })
          `,
          { group_id: testGroupId }
        );
      });

      const query: AuditQuery = {
        type: "full",
        group_id: testGroupId,
      };

      const buffer = await exportAuditTrail({
        query,
        format: "json",
      });

      const json = JSON.parse(buffer.toString("utf-8"));
      expect(json.provenance).toBeDefined();
      expect(json.rules).toBeDefined();
      expect(Array.isArray(json.provenance.decisions)).toBe(true);
      expect(Array.isArray(json.rules)).toBe(true);
    });
  });

  // =========================================================================
  // group_id Enforcement Tests
  // =========================================================================

  describe("group_id enforcement", () => {
    it("should reject queries without group_id", async () => {
      const query: AuditQuery = {
        type: "provenance",
        decision_id: "some-decision",
      };

      await expect(
        exportAuditTrail({ query, format: "json" })
      ).rejects.toThrow("group_id is required");
    });

    it("should enforce group_id in all query functions", async () => {
      // Test that all functions require and respect group_id
      const otherGroupId = "other-group-test";

      // Create data in test group
      await writeTransaction(async (tx: ManagedTransaction) => {
        await tx.run(
          `
          CREATE (d:Decision {
            decision_id: 'isolation-test',
            group_id: $group_id,
            agent_id: $agent_id,
            decision_type: 'isolation',
            inputs: '[]',
            reasoning: 'Test',
            outcome: 'test',
            confidence: 0.5,
            created_at: datetime()
          })
          `,
          { group_id: testGroupId, agent_id: testAgentId }
        );
      });

      // Query with different group_id should return empty
      const result = await queryDecisionProvenance({
        decision_id: "isolation-test",
        group_id: otherGroupId,
      });

      expect(result).toBeNull();
    });
  });
});