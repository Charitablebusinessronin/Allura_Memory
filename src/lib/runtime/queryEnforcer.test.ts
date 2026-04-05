/**
 * Query Enforcer Tests
 * ARCH-001: Enforce group_id filtering in PostgreSQL and Neo4j queries
 */

import { describe, expect, it } from "vitest";
import {
  enforcePostgresGroupId,
  enforceNeo4jGroupId,
  type PostgresQueryContext,
  type Neo4jQueryContext,
} from "./queryEnforcer";

describe("enforcePostgresGroupId", () => {
  describe("valid queries with group_id", () => {
    it("accepts SELECT with WHERE group_id clause", () => {
      const context: PostgresQueryContext = {
        query: "SELECT * FROM events WHERE group_id = $1",
        params: ["allura-faith-meats"],
        group_id: "allura-faith-meats",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(true);
      expect(result.query).toBe(context.query);
    });

    it("accepts INSERT with group_id column", () => {
      const context: PostgresQueryContext = {
        query: "INSERT INTO events (group_id, event_type, payload) VALUES ($1, $2, $3)",
        params: ["allura-faith-meats", "TASK_STARTED", {}],
        group_id: "allura-faith-meats",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(true);
    });

    it("accepts UPDATE with WHERE group_id clause", () => {
      const context: PostgresQueryContext = {
        query: "UPDATE memories SET status = $1 WHERE group_id = $2 AND id = $3",
        params: ["active", "allura-creative", "mem-123"],
        group_id: "allura-creative",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(true);
    });

    it("accepts DELETE with WHERE group_id clause", () => {
      const context: PostgresQueryContext = {
        query: "DELETE FROM sessions WHERE group_id = $1 AND expired_at < NOW()",
        params: ["allura-audits"],
        group_id: "allura-audits",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe("rejects queries without group_id", () => {
    it("rejects SELECT without WHERE clause", () => {
      const context: PostgresQueryContext = {
        query: "SELECT * FROM events",
        params: [],
        group_id: "allura-faith-meats",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
      expect(result.error).toContain("group_id");
    });

    it("rejects SELECT with WHERE but missing group_id", () => {
      const context: PostgresQueryContext = {
        query: "SELECT * FROM events WHERE event_type = $1",
        params: ["TASK_STARTED"],
        group_id: "allura-faith-meats",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
      expect(result.error).toContain("tenant isolation");
    });

    it("rejects UPDATE without WHERE group_id", () => {
      const context: PostgresQueryContext = {
        query: "UPDATE memories SET status = $1 WHERE id = $2",
        params: ["inactive", "mem-123"],
        group_id: "allura-creative",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
    });

    it("rejects DELETE without WHERE group_id", () => {
      const context: PostgresQueryContext = {
        query: "DELETE FROM sessions WHERE expired_at < NOW()",
        params: [],
        group_id: "allura-audits",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
    });
  });

  describe("enforces tenant isolation", () => {
    it("rejects query with different group_id in params", () => {
      const context: PostgresQueryContext = {
        query: "SELECT * FROM events WHERE group_id = $1",
        params: ["allura-other-tenant"],
        group_id: "allura-faith-meats",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
      expect(result.error).toContain("tenant isolation");
    });

    it("accepts query with matching group_id in params", () => {
      const context: PostgresQueryContext = {
        query: "SELECT * FROM events WHERE group_id = $1 AND event_type = $2",
        params: ["allura-faith-meats", "TASK_STARTED"],
        group_id: "allura-faith-meats",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe("validates group_id format", () => {
    it("rejects invalid group_id format in context", () => {
      const context: PostgresQueryContext = {
        query: "SELECT * FROM events WHERE group_id = $1",
        params: ["roninmemory"],
        group_id: "roninmemory",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
      expect(result.error).toContain("allura-{org}");
    });
  });

  describe("audit logging", () => {
    it("includes audit metadata in result", () => {
      const context: PostgresQueryContext = {
        query: "SELECT * FROM events WHERE group_id = $1",
        params: ["allura-faith-meats"],
        group_id: "allura-faith-meats",
      };

      const result = enforcePostgresGroupId(context);

      expect(result.audit).toBeDefined();
      expect(result.audit?.group_id).toBe("allura-faith-meats");
      expect(result.audit?.timestamp).toBeDefined();
      expect(result.audit?.query_type).toBe("SELECT");
    });
  });
});

describe("enforceNeo4jGroupId", () => {
  describe("valid queries with group_id", () => {
    it("accepts MATCH with WHERE group_id clause", () => {
      const context: Neo4jQueryContext = {
        query: "MATCH (n:Memory) WHERE n.group_id = $group_id RETURN n",
        params: { group_id: "allura-faith-meats" },
        group_id: "allura-faith-meats",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(true);
    });

    it("accepts CREATE with group_id property", () => {
      const context: Neo4jQueryContext = {
        query: "CREATE (n:Memory {group_id: $group_id, content: $content})",
        params: { group_id: "allura-creative", content: "test" },
        group_id: "allura-creative",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(true);
    });

    it("accepts MERGE with group_id property", () => {
      const context: Neo4jQueryContext = {
        query:
          "MERGE (n:Memory {group_id: $group_id, id: $id}) ON CREATE SET n.status = $status",
        params: {
          group_id: "allura-nonprofit",
          id: "mem-123",
          status: "active",
        },
        group_id: "allura-nonprofit",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(true);
    });

    it("accepts MATCH with AND group_id clause", () => {
      const context: Neo4jQueryContext = {
        query:
          "MATCH (n:Memory) WHERE n.group_id = $group_id AND n.status = $status RETURN n",
        params: { group_id: "allura-audits", status: "active" },
        group_id: "allura-audits",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe("rejects queries without group_id", () => {
    it("rejects MATCH without WHERE clause", () => {
      const context: Neo4jQueryContext = {
        query: "MATCH (n:Memory) RETURN n",
        params: {},
        group_id: "allura-faith-meats",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
      expect(result.error).toContain("group_id");
    });

    it("rejects MATCH with WHERE but missing group_id", () => {
      const context: Neo4jQueryContext = {
        query: "MATCH (n:Memory) WHERE n.status = $status RETURN n",
        params: { status: "active" },
        group_id: "allura-faith-meats",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
      expect(result.error).toContain("tenant isolation");
    });

    it("rejects CREATE without group_id property", () => {
      const context: Neo4jQueryContext = {
        query: "CREATE (n:Memory {content: $content})",
        params: { content: "test" },
        group_id: "allura-creative",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
    });
  });

  describe("enforces tenant isolation", () => {
    it("rejects query with different group_id in params", () => {
      const context: Neo4jQueryContext = {
        query: "MATCH (n:Memory) WHERE n.group_id = $group_id RETURN n",
        params: { group_id: "allura-other-tenant" },
        group_id: "allura-faith-meats",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
      expect(result.error).toContain("tenant isolation");
    });

    it("accepts query with matching group_id in params", () => {
      const context: Neo4jQueryContext = {
        query:
          "MATCH (n:Memory) WHERE n.group_id = $group_id AND n.status = $status RETURN n",
        params: { group_id: "allura-faith-meats", status: "active" },
        group_id: "allura-faith-meats",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe("validates group_id format", () => {
    it("rejects invalid group_id format in context", () => {
      const context: Neo4jQueryContext = {
        query: "MATCH (n:Memory) WHERE n.group_id = $group_id RETURN n",
        params: { group_id: "roninmemory" },
        group_id: "roninmemory",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("RK-01");
      expect(result.error).toContain("allura-{org}");
    });
  });

  describe("audit logging", () => {
    it("includes audit metadata in result", () => {
      const context: Neo4jQueryContext = {
        query: "MATCH (n:Memory) WHERE n.group_id = $group_id RETURN n",
        params: { group_id: "allura-faith-meats" },
        group_id: "allura-faith-meats",
      };

      const result = enforceNeo4jGroupId(context);

      expect(result.audit).toBeDefined();
      expect(result.audit?.group_id).toBe("allura-faith-meats");
      expect(result.audit?.timestamp).toBeDefined();
      expect(result.audit?.query_type).toBe("MATCH");
    });
  });
});