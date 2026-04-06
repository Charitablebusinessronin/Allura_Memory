/**
 * memory() — Allura Neo4j write wrapper
 *
 * The single interface the MemoryOrchestrator uses for all POST-WRITE operations.
 * Builds Cypher from a declarative spec — callers never write raw Cypher.
 *
 * Usage:
 *   const { node_id } = await memory().write({ label: 'Task', props: { ... } })
 *   await memory().relate({ fromId, fromLabel, toId, toLabel, type })
 *   const rows = await memory().read(cypher, params)
 */

if (typeof window !== "undefined") {
  throw new Error("memory() can only be used server-side");
}

import neo4j, { type Driver } from "neo4j-driver";
import { randomUUID } from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export type MemoryLabel =
  | "Task"
  | "Decision"
  | "Lesson"
  | "Person"
  | "Project"
  | "Tool"
  | "Context";

export type RelationshipType =
  | "CONTRIBUTED"
  | "LEARNED"
  | "DECIDED"
  | "COLLABORATED_WITH"
  | "SUPERSEDES"
  | "INFORMED_BY"
  | "APPLIES_TO"
  | "PART_OF"
  | "USES";

export interface WriteRelationship {
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

export interface WriteInput {
  label: MemoryLabel;
  props: Record<string, unknown>;
  relationships?: WriteRelationship[];
}

export interface WriteResult {
  node_id: string;
}

export interface RelateInput {
  fromId: string;
  fromLabel: MemoryLabel;
  toId: string;
  toLabel: MemoryLabel;
  type: RelationshipType;
  props?: Record<string, unknown>;
}

export interface MemoryAPI {
  write(input: WriteInput): Promise<WriteResult>;
  relate(input: RelateInput): Promise<void>;
  read<T = Record<string, unknown>>(
    cypher: string,
    params?: Record<string, unknown>
  ): Promise<T[]>;
}

// ── Driver singleton ───────────────────────────────────────────────────────

let _driver: Driver | null = null;

function getDriver(): Driver {
  if (!_driver) {
    const uri = process.env.NEO4J_URI ?? "bolt://localhost:7687";
    const user = process.env.NEO4J_USER ?? "neo4j";
    const password = process.env.NEO4J_PASSWORD;
    if (!password) throw new Error("Missing required env var: NEO4J_PASSWORD");
    _driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return _driver;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveNodeId(props: Record<string, unknown>): string {
  return (
    (props.node_id as string | undefined) ??
    (props.task_id as string | undefined) ??
    (props.decision_id as string | undefined) ??
    (props.lesson_id as string | undefined) ??
    randomUUID()
  );
}

// ── Implementation ─────────────────────────────────────────────────────────

function buildMemoryAPI(): MemoryAPI {
  return {
    async write({ label, props, relationships }: WriteInput): Promise<WriteResult> {
      const node_id = resolveNodeId(props);
      const finalProps: Record<string, unknown> = {
        ...props,
        node_id,
        created_at: props.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const session = getDriver().session();
      try {
        // MERGE on node_id — idempotent, safe to call multiple times
        await session.run(
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

          await session.run(
            `MATCH (n:${label} {node_id: $node_id})
             MATCH (target:${rel.targetLabel} {${targetKey}: $targetId})
             MERGE ${pattern}`,
            params
          );
        }
      } finally {
        await session.close();
      }

      return { node_id };
    },

    async relate({ fromId, fromLabel, toId, toLabel, type, props }: RelateInput): Promise<void> {
      const propKeys = Object.keys(props ?? {});
      const relPropClause =
        propKeys.length > 0
          ? " {" + propKeys.map((k) => `${k}: $${k}`).join(", ") + "}"
          : "";

      const session = getDriver().session();
      try {
        await session.run(
          `MATCH (from:${fromLabel} {node_id: $fromId})
           MATCH (to:${toLabel} {node_id: $toId})
           MERGE (from)-[:${type}${relPropClause}]->(to)`,
          { fromId, toId, ...(props ?? {}) }
        );
      } finally {
        await session.close();
      }
    },

    async read<T = Record<string, unknown>>(
      cypher: string,
      params?: Record<string, unknown>
    ): Promise<T[]> {
      const session = getDriver().session();
      try {
        const result = await session.run(cypher, params ?? {});
        return result.records.map((r) => {
          const obj: Record<string, unknown> = {};
          for (const key of r.keys) {
            const val = r.get(key as string);
            obj[key as string] = val?.properties ?? val;
          }
          return obj as T;
        });
      } finally {
        await session.close();
      }
    },
  };
}

// ── Public export ──────────────────────────────────────────────────────────

/**
 * memory() — returns a MemoryAPI scoped to the current call.
 *
 * @example
 * // Write a Task node
 * const { node_id } = await memory().write({
 *   label: 'Task',
 *   props: {
 *     task_id: randomUUID(),
 *     goal: 'Generate Faith Meats menu schema',
 *     status: 'complete',
 *     group_id: 'allura-faith-meats',
 *     agent: 'MemoryBuilder',
 *     session_id: '...',
 *   },
 * });
 *
 * // Wire a CONTRIBUTED relationship
 * await memory().relate({
 *   fromId: 'memory-builder',
 *   fromLabel: 'Person',
 *   toId: node_id,
 *   toLabel: 'Task',
 *   type: 'CONTRIBUTED',
 *   props: { on: new Date().toISOString(), result: 'complete' },
 * });
 */
export function memory(): MemoryAPI {
  return buildMemoryAPI();
}
