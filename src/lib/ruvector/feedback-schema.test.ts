import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(process.cwd(), "docker/postgres-init/16-ruvector-memories.sql")

describe("RuVector SONA feedback schema", () => {
  it("creates the allura_feedback table used by postFeedback", () => {
    const migration = readFileSync(migrationPath, "utf8")

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS allura_feedback")
    expect(migration).toMatch(/id\s+UUID PRIMARY KEY/)
    expect(migration).toMatch(/trajectory_id\s+TEXT\s+NOT NULL/)
    expect(migration).toMatch(/relevance_scores\s+JSONB\s+NOT NULL/)
    expect(migration).toMatch(/relevant_ids\s+TEXT\[\]\s+NOT NULL/)
    expect(migration).toMatch(/irrelevant_ids\s+TEXT\[\]\s+NOT NULL/)
    expect(migration).toMatch(/created_at\s+TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/)
    expect(migration).toMatch(/group_id\s+TEXT\s+NOT NULL CHECK \(group_id ~ '\^allura-\[a-z0-9-\]\+\$'\)/)
  })

  it("indexes feedback by tenant and retrieval trajectory", () => {
    const migration = readFileSync(migrationPath, "utf8")

    expect(migration).toContain("CREATE INDEX IF NOT EXISTS allura_feedback_group_time")
    expect(migration).toContain("ON allura_feedback (group_id, created_at DESC)")
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS allura_feedback_trajectory")
    expect(migration).toContain("ON allura_feedback (trajectory_id)")
  })
})
