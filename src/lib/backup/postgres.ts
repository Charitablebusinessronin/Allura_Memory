/**
 * PostgreSQL Backup Module
 *
 * Creates encrypted, compressed backups of the PostgreSQL database.
 * Uses pg_dump via docker exec for consistent snapshots.
 *
 * FR-3: Automated PostgreSQL backup with encryption
 * NFR-1: Secrets redaction in logs
 */

import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, writeFile, readFile, stat } from "node:fs/promises"
import { resolve, join } from "node:path"
import type { BackupResult, EncryptionConfig } from "./types"

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCKER_EXEC_TIMEOUT_MS = 120_000 // 2 minutes

// ── Types ───────────────────────────────────────────────────────────────────

export interface PostgresBackupOptions {
  /** Container name */
  container: string
  /** Database name */
  database: string
  /** PostgreSQL user */
  user: string
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
    redacted = redacted.replace(new RegExp(password, "g"), "***REDACTED***")
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
 * Returns path to encrypted file
 */
async function encryptFile(
  inputPath: string,
  outputPath: string,
  encryptionKey: string,
): Promise<void> {
  // Use openssl for encryption — requires key in hex format
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
 * Create a PostgreSQL backup
 *
 * Steps:
 * 1. Check docker and container are available
 * 2. Create pg_dump output (uncompressed SQL)
 * 3. Gzip compress
 * 4. Encrypt with AES-256
 * 5. Generate checksum
 * 6. Clean up temporary files
 *
 * @returns Backup result with path, size, checksum
 */
export async function backupPostgres(options: PostgresBackupOptions): Promise<BackupResult> {
  const startTime = Date.now()
  const { container, database, user, outputDir, encryption } = options

  // ── Validate inputs ────────────────────────────────────────────────────────
  if (!encryption.key || encryption.key.length < 8) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be at least 8 characters")
  }

  // ── Ensure output directory exists ───────────────────────────────────────
  await mkdir(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const baseName = `postgres-${database}-${timestamp}`
  const sqlPath = resolve(outputDir, `${baseName}.sql`)
  const gzipPath = resolve(outputDir, `${baseName}.sql.gz`)
  const encPath = resolve(outputDir, `${baseName}.sql.gz.enc`)

  try {
    // ── Step 1: Check prerequisites ────────────────────────────────────────
    checkDockerAndContainer(container)

    // ── Step 2: Create pg_dump ─────────────────────────────────────────────
    console.log(`Creating PostgreSQL backup: ${redactSecrets(database)}`)
    const dumpCommand = `docker exec "${container}" pg_dump -U "${user}" "${database}"`
    execSync(dumpCommand, {
      encoding: "utf-8",
      timeout: DOCKER_EXEC_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Actually write to file (the above didn't redirect)
    execSync(`${dumpCommand} > "${sqlPath}"`, {
      encoding: "utf-8",
      timeout: DOCKER_EXEC_TIMEOUT_MS,
    })

    // ── Step 3: Gzip compress ──────────────────────────────────────────────
    console.log("Compressing backup...")
    execSync(`gzip -f "${sqlPath}"`, { encoding: "utf-8", timeout: DOCKER_EXEC_TIMEOUT_MS })

    // ── Step 4: Encrypt ──────────────────────────────────────────────────────
    console.log("Encrypting backup...")
    await encryptFile(gzipPath, encPath, encryption.key)

    // ── Step 5: Generate checksum ────────────────────────────────────────────
    console.log("Generating checksum...")
    const checksum = await generateChecksum(encPath)
    await writeFile(`${encPath}.sha256`, checksum)

    // ── Step 6: Cleanup temporary files ──────────────────────────────────────
    // Remove unencrypted gzip file
    try {
      execSync(`rm -f "${gzipPath}"`, { encoding: "utf-8" })
    } catch {
      // Best effort cleanup
    }

    // ── Step 7: Get final file size ────────────────────────────────────────
    const stats = await stat(encPath)

    console.log(`PostgreSQL backup complete: ${encPath}`)
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
    // Cleanup on failure
    try {
      execSync(`rm -f "${sqlPath}" "${gzipPath}" "${encPath}"`, { encoding: "utf-8" })
    } catch {
      // Best effort
    }

    const message = error instanceof Error ? error.message : String(error)
    console.error(`PostgreSQL backup failed: ${redactSecrets(message)}`)

    return {
      success: false,
      path: encPath,
      size: 0,
      duration_ms: Date.now() - startTime,
      checksum: "",
      error: redactSecrets(message),
    }
  }
}
