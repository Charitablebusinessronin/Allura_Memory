/**
 * memory() — Allura Neo4j write wrapper (Story 1.7)
 *
 * The single interface the MemoryOrchestrator uses for all POST-WRITE operations.
 * Builds Cypher from a declarative spec — callers never write raw Cypher.
 *
 * Usage:
 *   const { node_id } = await memory().createEntity({ label: 'Task', props: { ... } })
 *   await memory().createRelationship({ fromId, fromLabel, toId, toLabel, type })
 *   const rows = await memory().query(cypher, params)
 *   const results = await memory().search({ label: 'Task', props: { status: 'complete' } })
 *
 * Auto group_id injection: All write operations require group_id and auto-inject it
 * into props if not present.
 */

if (typeof window !== "undefined") {
  throw new Error("memory() can only be used server-side");
}

import { randomUUID } from "crypto";
import { validateGroupId } from "@/lib/validation/group-id";
import {
  readTransaction,
  writeTransaction,
  type ManagedTransaction,
} from "@/lib/neo4j/connection";

// ── Types ──────────────────────────────────────────────────────────────────

export type MemoryLabel =
  | "Task"
  | "Decision"
  | "Lesson"
  | "Person"
  | "Project"
  | "Tool"
  | "Context"
  | "Agent"
  | "AgentGroup"
  | "Insight"
  | "Event"
  | "Session";

export type RelationshipType =
  | "CONTRIBUTED"
  | "LEARNED"
  | "DECIDED"
  | "COLLABORATED_WITH"
  | "SUPERSEDES"
  | "INFORMED_BY"
  | "APPLIES_TO"
  | "PART_OF"
  | "USES"
  | "INCLUDES"
  | "KNOWS"
  | "PERFORMED"
  | "BELONGS_TO";

export interface CreateRelationshipInput {
  type: RelationshipType;
  /** node_id value of the target node */
  targetId: string;
  targetLabel: MemoryLabel;
  /** Property on target to match — defaults to "node_id" */
  targetKey?: string;
  props?: Record<string, unknown>;
  /** Outgoing (default) or incoming */
  direction?: "out" | "in";
}

export interface CreateEntityInput {
  label: MemoryLabel;
  props: Record<string, unknown>;
  /** Required: Tenant isolation — auto-injected if missing */
  group_id: string;
  relationships?: CreateRelationshipInput[];
}

export interface CreateEntityResult {
  node_id: string;
}

export interface CreateRelationshipCallInput {
  fromId: string;
  fromLabel: MemoryLabel;
  toId: string;
  toLabel: MemoryLabel;
  type: RelationshipType;
  props?: Record<string, unknown>;
}

export interface SearchInput {
  label: MemoryLabel;
  /** Required: Tenant isolation for scoping search */
  group_id: string;
  /** Match properties exactly */
  props?: Record<string, unknown>;
  /** Partial text match on string properties */
  textMatch?: Record<string, string>;
  limit?: number;
}

export interface MemoryAPI {
  createEntity(input: CreateEntityInput): Promise<CreateEntityResult>;
  createRelationship(input: CreateRelationshipCallInput): Promise<void>;
  query<T = Record<string, unknown>>(
    cypher: string,
    params?: Record<string, unknown>
  ): Promise<T[]>;
  search<T = Record<string, unknown>>(input: SearchInput): Promise<T[]>;
}

// ── Driver singleton ───────────────────────────────────────────────────────
// NOTE: Direct driver usage removed (Issue #13).
// All Neo4j I/O now goes through readTransaction/writeTransaction in
// src/lib/neo4j/connection.ts, which wraps errors in domain types
// (Neo4jConnectionError, Neo4jQueryError) with structured logging.

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveNodeId(props: Record<string, unknown>): string {
  return (
    (props.node_id as string | undefined) ??
    (props.task_id as string | undefined) ??
    (props.decision_id as string | undefined) ??
    (props.lesson_id as string | undefined) ??
    (props.agent_id as string | undefined) ??
    (props.session_id as string | undefined) ??
    (props.event_id as string | undefined) ??
    (props.insight_id as string | undefined) ??
    randomUUID()
  );
}

// ── Implementation ─────────────────────────────────────────────────────────

function buildMemoryAPI(): MemoryAPI {
  return {
    async createEntity({
      label,
      props,
      group_id,
      relationships,
    }: CreateEntityInput): Promise<CreateEntityResult> {
      // Validate and auto-inject group_id
      const validatedGroupId = validateGroupId(group_id);

      const node_id = resolveNodeId(props);
      const finalProps: Record<string, unknown> = {
        ...props,
        node_id,
        group_id: validatedGroupId, // Auto-inject validated group_id
        created_at: props.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await writeTransaction(async (tx) => {
        // MERGE on node_id — idempotent, safe to call multiple times
        await tx.run(
          `MERGE (n:${label} {node_id: $node_id}) SET n += $props`,
          { node_id, props: finalProps }
        );

        for (const rel of relationships ?? []) {
          const targetKey = rel.targetKey ?? "node_id";
          const relPropKeys = Object.keys(rel.props ?? {});
          const relPropClause =
            relPropKeys.length > 0
              ? " {" + relPropKeys.map((k) => `${k}: $rel_${k}`).join(", ") + "}"
              : "";

          const params: Record<string, unknown> = {
            node_id,
            targetId: rel.targetId,
          };
          for (const [k, v] of Object.entries(rel.props ?? {})) {
            params[`rel_${k}`] = v;
          }

          const pattern =
            rel.direction === "in"
              ? `(target)-[:${rel.type}${relPropClause}]->(n)`
              : `(n)-[:${rel.type}${relPropClause}]->(target)`;

          await tx.run(
            `MATCH (n:${label} {node_id: $node_id})
             MATCH (target:${rel.targetLabel} {${targetKey}: $targetId})
             MERGE ${pattern}`,
            params
          );
        }
      });

      return { node_id };
    },

    async createRelationship({
      fromId,
      fromLabel,
      toId,
      toLabel,
      type,
      props,
    }: CreateRelationshipCallInput): Promise<void> {
      const propKeys = Object.keys(props ?? {});
      const relPropClause =
        propKeys.length > 0
          ? " {" + propKeys.map((k) => `${k}: $${k}`).join(", ") + "}"
          : "";

      await writeTransaction(async (tx) => {
        await tx.run(
          `MATCH (from:${fromLabel} {node_id: $fromId})
           MATCH (to:${toLabel} {node_id: $toId})
           MERGE (from)-[:${type}${relPropClause}]->(to)`,
          { fromId, toId, ...(props ?? {}) }
        );
      });
    },

    async query<T = Record<string, unknown>>(
      cypher: string,
      params?: Record<string, unknown>
    ): Promise<T[]> {
      return readTransaction(async (tx) => {
        const result = await tx.run(cypher, params ?? {});
        return result.records.map((r) => {
          const obj: Record<string, unknown> = {};
          for (const key of r.keys) {
            const val = r.get(key as string);
            obj[key as string] = val?.properties ?? val;
          }
          return obj as T;
        });
      });
    },

    async search<T = Record<string, unknown>>({
      label,
      group_id,
      props,
      textMatch,
      limit = 10,
    }: SearchInput): Promise<T[]> {
      // Validate group_id
      const validatedGroupId = validateGroupId(group_id);

      return readTransaction(async (tx) => {
        // Build WHERE clause for exact matches
        const exactMatchClauses: string[] = ["n.group_id = $group_id"];
        const params: Record<string, unknown> = { group_id: validatedGroupId };

        if (props) {
          for (const [key, value] of Object.entries(props)) {
            exactMatchClauses.push(`n.${key} = $${key}`);
            params[key] = value;
          }
        }

        // Build text match clauses (CONTAINS for partial matching)
        const textMatchClauses: string[] = [];
        if (textMatch) {
          for (const [key, value] of Object.entries(textMatch)) {
            textMatchClauses.push(`n.${key} CONTAINS $text_${key}`);
            params[`text_${key}`] = value;
          }
        }

        // Combine all WHERE conditions
        const allConditions = [...exactMatchClauses, ...textMatchClauses];
        const whereClause =
          allConditions.length > 0 ? `WHERE ${allConditions.join(" AND ")}` : "";

        const cypher = `
          MATCH (n:${label})
          ${whereClause}
          RETURN n
          LIMIT $limit
        `;
        params.limit = limit;

        const result = await tx.run(cypher, params);
        return result.records.map((r) => {
          const val = r.get("n");
          return (val?.properties ?? val) as T;
        });
      });
    },
  };
}

// ── Public export ──────────────────────────────────────────────────────────

/**
 * memory() — returns a MemoryAPI scoped to the current call.
 *
 * @example
 * // Create a Task node
 * const { node_id } = await memory().createEntity({
 *   label: 'Task',
 *   group_id: 'allura-faith-meats',
 *   props: {
 *     task_id: randomUUID(),
 *     goal: 'Generate Faith Meats menu schema',
 *     status: 'complete',
 *     agent: 'MemoryBuilder',
 *     session_id: '...',
 *   },
 * });
 *
 * // Wire a CONTRIBUTED relationship
 * await memory().createRelationship({
 *   fromId: 'memory-builder',
 *   fromLabel: 'Person',
 *   toId: node_id,
 *   toLabel: 'Task',
 *   type: 'CONTRIBUTED',
 *   props: { on: new Date().toISOString(), result: 'complete' },
 * });
 *
 * // Search for completed tasks
 * const tasks = await memory().search({
 *   label: 'Task',
 *   group_id: 'allura-faith-meats',
 *   props: { status: 'complete' },
 *   limit: 10,
 * });
 */
export function memory(): MemoryAPI {
  return buildMemoryAPI();
}

// Backward compatibility exports
/** @deprecated Use createEntity instead */
export const write = (...args: Parameters<MemoryAPI["createEntity"]>) =>
  memory().createEntity(...args);
/** @deprecated Use createRelationship instead */
export const relate = (...args: Parameters<MemoryAPI["createRelationship"]>) =>
  memory().createRelationship(...args);
/** @deprecated Use query instead */
export const read = (...args: Parameters<MemoryAPI["query"]>) =>
  memory().query(...args);
