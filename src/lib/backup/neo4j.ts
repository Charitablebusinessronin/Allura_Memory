/**
 * Neo4j Backup Module
 *
 * Creates encrypted, compressed backups of the Neo4j graph database.
 * Uses neo4j-admin database dump via docker exec for consistent offline snapshots.
 *
 * FR-3: Automated Neo4j backup with encryption
 * NFR-1: Secrets redaction in logs
 */

import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, writeFile, readFile, stat } from "node:fs/promises"
import { resolve, join } from "node:path"
import type { BackupResult, EncryptionConfig } from "./types"

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCKER_EXEC_TIMEOUT_MS = 300_000 // 5 minutes (Neo4j dump can take time)

// ── Types ───────────────────────────────────────────────────────────────────

export interface Neo4jBackupOptions {
  /** Container name */
  container: string
  /** Database name */
  database: string
  /** Neo4j user (for cypher-shell if needed) */
  user: string
  /** Neo4j password */
  password: string
  /** Output directory */
  outputDir: string
  /** Encryption config */
  encryption: EncryptionConfig
}

// ── Secret Redaction ──────────────────────────────────────────────────────────

/**
 * Redact secrets from log messages
 * NFR-1: Never log encryption keys or passwords
 */
function redactSecrets(message: string, password?: string): string {
  let redacted = message
  
  // Redact encryption key patterns
  redacted = redacted.replace(/key=[a-f0-9]{32,}/gi, "key=***REDACTED***")
  redacted = redacted.replace(/password=[^\s&]+/gi, "password=***REDACTED***")
  redacted = redacted.replace(/BACKUP_ENCRYPTION_KEY=[^\s&]+/gi, "BACKUP_ENCRYPTION_KEY=***REDACTED***")
  redacted = redacted.replace(/-pass [^\s&]+/g, "-pass ***REDACTED***")
  
  if (password) {
    redacted = redacted.replace(new RegExp(password.replace(/[.*+?^${}()|[\]\\]/g, "\\$\u0026"), "g"), "***REDACTED***")
  }
  
  return redacted
}

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check if docker and container are available
 */
function checkDockerAndContainer(container: string): void {
  try {
    execSync("docker info", { encoding: "utf-8", timeout: 5000 })
  } catch {
    throw new Error("Docker daemon is not reachable")
  }

  try {
    execSync(`docker ps --format '{{.Names}}' | grep -Fx "${container}"`, {
      encoding: "utf-8",
      timeout: 5000,
    })
  } catch {
    throw new Error(`Container '${container}' is not running`)
  }
}

/**
 * Generate SHA-256 checksum of a file
 */
async function generateChecksum(filePath: string): Promise<string> {
  const data = await readFile(filePath)
  return createHash("sha256").update(data).digest("hex")
}

/**
 * Encrypt a file using openssl AES-256-CBC
 */
async function encryptFile(
  inputPath: string,
  outputPath: string,
  encryptionKey: string,
): Promise<void> {
  const command = [
    "openssl", "enc", "-aes-256-cbc", "-salt",
    "-pbkdf2", "-iter", "100000",
    "-in", inputPath,
    "-out", outputPath,
    "-pass", `pass:${encryptionKey}`,
  ].join(" ")

  execSync(command, { encoding: "utf-8", timeout: DOCKER_EXEC_TIMEOUT_MS })
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Create a Neo4j backup
 *
 * Steps:
 * 1. Check docker and container are available
 * 2. Stop Neo4j for consistent offline dump
 * 3. Run neo4j-admin database dump
 * 4. Start Neo4j again
 * 5. Copy dump from container
 * 6. Gzip compress
 * 7. Encrypt with AES-256
 * 8. Generate checksum
 * 9. Clean up temporary files
 *
 * @returns Backup result with path, size, checksum
 */
export async function backupNeo4j(options: Neo4jBackupOptions): Promise<BackupResult> {
  const startTime = Date.now()
  const { container, database, password, outputDir, encryption } = options

  // ── Validate inputs ────────────────────────────────────────────────────────
  if (!encryption.key || encryption.key.length < 8) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be at least 8 characters")
  }

  // ── Ensure output directory exists ───────────────────────────────────────
  await mkdir(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const baseName = `neo4j-${database}-${timestamp}`
  const dumpPath = resolve(outputDir, `${baseName}.dump`)
  const gzipPath = resolve(outputDir, `${baseName}.dump.gz`)
  const encPath = resolve(outputDir, `${baseName}.dump.gz.enc`)

  try {
    // ── Step 1: Check prerequisites ────────────────────────────────────────
    checkDockerAndContainer(container)

    // ── Step 2: Stop Neo4j ───────────────────────────────────────────────────
    console.log("Stopping Neo4j for consistent offline dump...")
    execSync(`docker exec "${container}" neo4j stop`, {
      encoding: "utf-8",
      timeout: DOCKER_EXEC_TIMEOUT_MS,
    })

    // ── Step 3: Create dump ──────────────────────────────────────────────────
    console.log(`Creating Neo4j dump: ${database}`)
    execSync(
      `docker exec "${container}" neo4j-admin database dump "${database}" --to-path=/tmp --overwrite-destination=true`,
      {
        encoding: "utf-8",
        timeout: DOCKER_EXEC_TIMEOUT_MS,
      }
    )

    // ── Step 4: Start Neo4j ──────────────────────────────────────────────────
    console.log("Restarting Neo4j...")
    execSync(`docker exec "${container}" neo4j start`, {
      encoding: "utf-8",
      timeout: DOCKER_EXEC_TIMEOUT_MS,
    })

    // ── Step 5: Copy dump from container ───────────────────────────────────
    const containerFile = `/tmp/${database}.dump`
    execSync(
      `docker cp "${container}:${containerFile}" "${dumpPath}"`,
      { encoding: "utf-8", timeout: DOCKER_EXEC_TIMEOUT_MS }
    )

    // Remove file from container
    try {
      execSync(`docker exec "${container}" rm -f "${containerFile}"`, {
        encoding: "utf-8",
        timeout: 10000,
      })
    } catch {
      // Best effort cleanup
    }

    // ── Step 6: Gzip compress ──────────────────────────────────────────────
    console.log("Compressing Neo4j dump...")
    execSync(`gzip -f "${dumpPath}"`, { encoding: "utf-8", timeout: DOCKER_EXEC_TIMEOUT_MS })

    // ── Step 7: Encrypt ──────────────────────────────────────────────────────
    console.log("Encrypting backup...")
    await encryptFile(gzipPath, encPath, encryption.key)

    // ── Step 8: Generate checksum ────────────────────────────────────────────
    console.log("Generating checksum...")
    const checksum = await generateChecksum(encPath)
    await writeFile(`${encPath}.sha256`, checksum)

    // ── Step 9: Cleanup temporary files ────────────────────────────────────
    try {
      execSync(`rm -f "${dumpPath}" "${gzipPath}"`, { encoding: "utf-8" })
    } catch {
      // Best effort cleanup
    }

    // ── Step 10: Get final file size ───────────────────────────────────────
    const stats = await stat(encPath)

    console.log(`Neo4j backup complete: ${encPath}`)
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Checksum: ${checksum.slice(0, 16)}...`)

    return {
      success: true,
      path: encPath,
      size: stats.size,
      duration_ms: Date.now() - startTime,
      checksum,
    }
  } catch (error) {
    // Ensure Neo4j is restarted even on failure
    try {
      console.log("Ensuring Neo4j is restarted...")
      execSync(`docker exec "${container}" neo4j start`, {
        encoding: "utf-8",
        timeout: 60000,
      })
    } catch {
      console.error("WARNING: Could not restart Neo4j after failed backup")
    }

    // Cleanup on failure
    try {
      execSync(`rm -f "${dumpPath}" "${gzipPath}" "${encPath}"`, { encoding: "utf-8" })
    } catch {
      // Best effort
    }

    const message = error instanceof Error ? error.message : String(error)
    console.error(`Neo4j backup failed: ${redactSecrets(message, password)}`)

    return {
      success: false,
      path: encPath,
      size: 0,
      duration_ms: Date.now() - startTime,
      checksum: "",
      error: redactSecrets(message, password),
    }
  }
}
