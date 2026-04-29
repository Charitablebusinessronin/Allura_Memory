/**
 * List Backups CLI Script
 *
 * Usage:
 *   bun run scripts/list-backups.ts
 *   bun run scripts/list-backups.ts --expired
 *
 * FR-8: Backup listing with retention policy
 */

import { config } from "dotenv"
import { resolve } from "node:path"
import { listBackups, getRetentionSummary } from "../src/lib/backup"

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") })
config({ path: resolve(__dirname, "../.env") })

// ── Parse Arguments ──────────────────────────────────────────────────────────

function parseArgs(): { showExpired: boolean; help: boolean } {
  const args = process.argv.slice(2)
  let showExpired = false
  let help = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--help" || arg === "-h") {
      help = true
    } else if (arg === "--expired" || arg === "-e") {
      showExpired = true
    }
  }

  return { showExpired, help }
}

// ── Formatting Helpers ────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function formatRetention(status: string): string {
  switch (status) {
    case "keep":
      return "✓ Keep"
    case "expire_soon":
      return "⚠ Expire Soon"
    case "expired":
      return "✗ Expired"
    default:
      return status
  }
}

// ── Help ──────────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
List Backups CLI — Allura Memory System

Usage:
  bun run scripts/list-backups.ts [options]

Options:
  --expired, -e    Show only expired backups
  --help, -h       Show this help

Examples:
  bun run scripts/list-backups.ts
  bun run scripts/list-backups.ts --expired

Retention Policy:
  Daily:   Keep last 7 days
  Weekly:  Keep last 4 weeks (Sundays)
  Monthly: Keep last 12 months (1st of month)

`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { showExpired, help } = parseArgs()

  if (help) {
    printHelp()
    process.exit(0)
  }

  console.log("=== Allura Memory Backup Inventory ===\n")

  try {
    const items = await listBackups()
    const summary = getRetentionSummary(items)

    if (items.length === 0) {
      console.log("No backups found.")
      console.log(`Backup directory: ${resolve(process.cwd(), "backups")}`)
      process.exit(0)
    }

    // Filter if --expired
    const displayItems = showExpired ? items.filter((i) => i.retention === "expired") : items

    // Header
    console.log(
      `${"Date".padEnd(12)} ${"Types".padEnd(30)} ${"Size".padEnd(12)} ${"Schema".padEnd(8)} ${"Integrity".padEnd(12)} ${"Retention"}`
    )
    console.log("-".repeat(90))

    // Rows
    for (const item of displayItems) {
      const types = item.types.join(", ")
      const truncatedTypes = types.length > 28 ? types.slice(0, 25) + "..." : types

      console.log(
        `${item.date.padEnd(12)} ` +
          `${truncatedTypes.padEnd(30)} ` +
          `${formatBytes(item.total_size).padEnd(12)} ` +
          `${String(item.schema_version).padEnd(8)} ` +
          `${item.integrity_verified ? "✓ Verified" : "✗ Failed".padEnd(12)} ` +
          `${formatRetention(item.retention)}`
      )
    }

    // Summary
    console.log("\n" + "=".repeat(90))
    console.log(`Total backups: ${summary.total}`)
    console.log(`  Keep:        ${summary.keep}`)
    console.log(`  Expire Soon: ${summary.expire_soon}`)
    console.log(`  Expired:     ${summary.expired}`)
    console.log(`Total size:    ${formatBytes(summary.total_size)}`)

    if (!showExpired && summary.expired > 0) {
      console.log(`\nRun with --expired to see ${summary.expired} expired backups ready for deletion.`)
    }

    process.exit(0)
  } catch (error) {
    console.error("Failed to list backups:", error)
    process.exit(1)
  }
}

main()
