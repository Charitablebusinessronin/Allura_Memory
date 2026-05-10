import { getPool } from "../src/lib/postgres/connection"

async function listPending() {
  const pool = getPool()

  // Get summary stats first
  const stats = await pool.query(
    `SELECT 
      tier, 
      COUNT(*) as count,
      ROUND(AVG(score)::numeric, 2) as avg_score,
      MIN(created_at::date) as oldest,
      MAX(created_at::date) as newest
     FROM canonical_proposals
     WHERE group_id = 'allura-system' AND status = 'pending'
     GROUP BY tier
     ORDER BY count DESC`
  )

  console.log("\n📊 PENDING PROPOSALS SUMMARY (allura-system)\n")
  console.log(`Total: 118 proposals\n`)
  console.log("By Tier:")
  for (const row of stats.rows) {
    console.log(`  ${row.tier.padEnd(12)}: ${String(row.count).padStart(3)} proposals | avg score: ${row.avg_score} | ${row.oldest} → ${row.newest}`)
  }

  // Get date distribution
  const dateDist = await pool.query(
    `SELECT 
      created_at::date as date,
      COUNT(*) as count
     FROM canonical_proposals
     WHERE group_id = 'allura-system' AND status = 'pending'
     GROUP BY created_at::date
     ORDER BY date DESC
     LIMIT 10`
  )

  console.log("\n📅 By Date (last 10 days):")
  for (const row of dateDist.rows) {
    console.log(`  ${row.date}: ${row.count} proposals`)
  }

  // Show top 15 by score
  const top = await pool.query(
    `SELECT id, score, tier, reasoning, LEFT(content, 80) as preview, created_at
     FROM canonical_proposals
     WHERE group_id = 'allura-system' AND status = 'pending'
     ORDER BY score DESC, created_at DESC
     LIMIT 15`
  )

  console.log("\n🏆 TOP 15 BY SCORE:\n")
  for (const row of top.rows) {
    const date = new Date(row.created_at).toISOString().slice(0, 16)
    console.log(`[${row.score}] ${row.tier} | ${date}`)
    console.log(`    ${row.preview}${row.preview.length >= 80 ? '...' : ''}`)
    console.log()
  }

  // Show oldest 5 (might be stale)
  const oldest = await pool.query(
    `SELECT id, score, tier, LEFT(content, 80) as preview, created_at
     FROM canonical_proposals
     WHERE group_id = 'allura-system' AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT 5`
  )

  console.log("\n⏰ OLDEST 5 (might need attention):\n")
  for (const row of oldest.rows) {
    const date = new Date(row.created_at).toISOString().slice(0, 16)
    console.log(`[${row.score}] ${date} | ${row.preview}${row.preview.length >= 80 ? '...' : ''}`)
  }

  await pool.end()
}

listPending().catch(console.error)
