import { getPool } from "../src/lib/postgres/connection"

async function listPending() {
  const pool = getPool()

  const result = await pool.query(
    `SELECT id, score, tier, reasoning, content, created_at, trace_ref
     FROM canonical_proposals
     WHERE group_id = 'allura-system' AND status = 'pending'
     ORDER BY score DESC, created_at DESC`
  )

  console.log(`\n=== ${result.rowCount} PENDING PROPOSALS (allura-system) ===\n`)

  for (const row of result.rows) {
    const date = new Date(row.created_at).toISOString().slice(0, 16)
    const contentPreview = row.content.length > 100
      ? row.content.slice(0, 100) + "..."
      : row.content

    console.log(`ID: ${row.id}`)
    console.log(`Score: ${row.score} | Tier: ${row.tier} | Date: ${date}`)
    if (row.reasoning) {
      console.log(`Reasoning: ${row.reasoning}`)
    }
    console.log(`Content: ${contentPreview}`)
    console.log(`Trace: ${row.trace_ref ?? 'none'}`)
    console.log("─".repeat(60))
  }

  // Summary stats
  const stats = await pool.query(
    `SELECT tier, COUNT(*) as count
     FROM canonical_proposals
     WHERE group_id = 'allura-system' AND status = 'pending'
     GROUP BY tier
     ORDER BY count DESC`
  )

  console.log("\n=== BY TIER ===")
  for (const row of stats.rows) {
    console.log(`  ${row.tier}: ${row.count}`)
  }

  await pool.end()
}

listPending().catch(console.error)
