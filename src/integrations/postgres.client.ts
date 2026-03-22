/**
 * PostgreSQL Client
 * 
 * Integration layer for curator decision logging.
 */

import { Pool } from "pg";
import { CuratorDecision } from "../curator/types";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DB || "memory",
      user: process.env.POSTGRES_USER || "ronin4life",
      password: process.env.POSTGRES_PASSWORD
    });
  }
  return pool;
}

export interface PostgresClient {
  logCuratorDecision(decision: CuratorDecision): Promise<void>;
  initializeSchema(): Promise<void>;
}

export class PostgresClientImpl implements PostgresClient {
  private initialized = false;

  async initializeSchema(): Promise<void> {
    if (this.initialized) return;

    const client = getPool();

    await client.query(`
      CREATE TABLE IF NOT EXISTS curator_decisions (
        id SERIAL PRIMARY KEY,
        insight_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        notion_page_id TEXT,
        group_id TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE curator_decisions
      ADD COLUMN IF NOT EXISTS group_id TEXT
    `);

    await client.query(`
      ALTER TABLE curator_decisions
      ADD COLUMN IF NOT EXISTS metadata JSONB
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_curator_decisions_insight_id 
      ON curator_decisions(insight_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_curator_decisions_created_at 
      ON curator_decisions(created_at)
    `);

    this.initialized = true;
  }

  async logCuratorDecision(decision: CuratorDecision): Promise<void> {
    await this.initializeSchema();

    const client = getPool();

    await client.query(
      `
      INSERT INTO curator_decisions (
        insight_id,
        action,
        reason,
        notion_page_id,
        group_id,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        decision.insightId,
        decision.action,
        decision.reason,
        decision.notionPageId || null,
        decision.groupId ?? null,
        decision.duplicateReview ? JSON.stringify(decision.duplicateReview) : null,
        decision.timestamp
      ]
    );
  }

  async getRecentDecisions(limit = 50): Promise<CuratorDecision[]> {
    const client = getPool();

    const result = await client.query(
      `
      SELECT insight_id, action, reason, notion_page_id, group_id, metadata, created_at as timestamp
      FROM curator_decisions
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(row => ({
      insightId: row.insight_id,
      action: row.action,
      reason: row.reason,
      notionPageId: row.notion_page_id,
      groupId: row.group_id ?? undefined,
      duplicateReview: row.metadata ?? undefined,
      timestamp: row.timestamp
    }));
  }

  async getDecisionsForInsight(insightId: string): Promise<CuratorDecision[]> {
    const client = getPool();

    const result = await client.query(
      `
      SELECT insight_id, action, reason, notion_page_id, group_id, metadata, created_at as timestamp
      FROM curator_decisions
      WHERE insight_id = $1
      ORDER BY created_at DESC
      `,
      [insightId]
    );

    return result.rows.map(row => ({
      insightId: row.insight_id,
      action: row.action,
      reason: row.reason,
      notionPageId: row.notion_page_id,
      groupId: row.group_id ?? undefined,
      duplicateReview: row.metadata ?? undefined,
      timestamp: row.timestamp
    }));
  }
}
