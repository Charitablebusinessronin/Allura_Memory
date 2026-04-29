/**
 * Configuration Backup Module
 *
 * Backs up configuration files as an encrypted tar.gz archive.
 *
 * FR-3: Automated config backup with encryption
 * NFR-1: Secrets redaction in logs
 */

import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, writeFile, readFile, stat, access } from "node:fs/promises"
import { resolve } from "node:path"
import type { BackupResult, EncryptionConfig } from "./types"

// ── Types ───────────────────────────────────────────────────────────────────

export interface ConfigBackupOptions {
  /** Root directory of the project */
  projectRoot: string
  /** Files to include in backup */
  files: string[]
  /** Output directory */
  outputDir: string
  /** Encryption config */
  encryption: EncryptionConfig
}

// ── Secret Redaction ──────────────────────────────────────────────────────────

function redactSecrets(message: string): string {
  let redacted = message
  redacted = redacted.replace(/key=[a-f0-9]{32,}/gi, "key=***REDACTED***")
  redacted = redacted.replace(/password=[^\s&]+/gi, "password=***REDACTED***")
  redacted = redacted.replace(/BACKUP_ENCRYPTION_KEY=[^\s&]+/gi, "BACKUP_ENCRYPTION_KEY=***REDACTED***")
  redacted = redacted.replace(/-pass [^\s&]+/g, "-pass ***REDACTED***")
  return redacted
}

// ── Helper Functions ─────────────────────────────────────────────────────────

async function generateChecksum(filePath: string): Promise<string> {
  const data = await readFile(filePath)
  return createHash("sha256").update(data).digest("hex")
}

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

  execSync(command, { encoding: "utf-8", timeout: 60_000 })
}

/**
 * Check which files exist and return only those
 */
async function filterExistingFiles(projectRoot: string, files: string[]): Promise<string[]> {
  const existing: string[] = []
  for (const file of files) {
    const filePath = resolve(projectRoot, file)
    try {
      await access(filePath)
      existing.push(filePath)
    } catch {
      // File doesn't exist, skip
    }
  }
  return existing
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Create a configuration backup
 *
 * Steps:
 * 1. Check which config files exist
 * 2. Create tar.gz archive
 * 3. Encrypt with AES-256
 * 4. Generate checksum
 * 5. Clean up temporary files
 */
export async function backupConfig(options: ConfigBackupOptions): Promise<BackupResult> {
  const startTime = Date.now()
  const { projectRoot, files, outputDir, encryption } = options

  // ── Validate inputs ────────────────────────────────────────────────────────
  if (!encryption.key || encryption.key.length < 8) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be at least 8 characters")
  }

  // ── Ensure output directory exists ───────────────────────────────────────
  await mkdir(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const baseName = `config-${timestamp}`
  const tarPath = resolve(outputDir, `${baseName}.tar.gz`)
  const encPath = resolve(outputDir, `${baseName}.tar.gz.enc`)

  try {
    // ── Step 1: Check which files exist ──────────────────────────────────
    const existingFiles = await filterExistingFiles(projectRoot, files)
    
    if (existingFiles.length === 0) {
      throw new Error("No configuration files found to backup")
    }
    
    console.log(`Found ${existingFiles.length} config files to backup`)

    // ── Step 2: Create tar.gz ─────────────────────────────────────────────
    console.log("Creating config archive...")
    const tarArgs = existingFiles
      .map((f) => `"${f}"`)
      .join(" ")
    
    execSync(`tar -czf "${tarPath}" -C "${projectRoot}" ${existingFiles.map((f) => f.replace(projectRoot + "/", "")).map((f) => `"${f}"`).join(" ")}`, {
      encoding: "utf-8",
      timeout: 60_000,
    })

    // ── Step 3: Encrypt ──────────────────────────────────────────────────────
    console.log("Encrypting config backup...")
    await encryptFile(tarPath, encPath, encryption.key)

    // ── Step 4: Generate checksum ────────────────────────────────────────────
    console.log("Generating checksum...")
    const checksum = await generateChecksum(encPath)
    await writeFile(`${encPath}.sha256`, checksum)

    // ── Step 5: Cleanup ────────────────────────────────────────────────────
    try {
      execSync(`rm -f "${tarPath}"`, { encoding: "utf-8" })
    } catch {
      // Best effort
    }

    // ── Step 6: Get final file size ────────────────────────────────────────
    const stats = await stat(encPath)

    console.log(`Config backup complete: ${encPath}`)
    console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`)
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
      execSync(`rm -f "${tarPath}" "${encPath}"`, { encoding: "utf-8" })
    } catch {
      // Best effort
    }

    const message = error instanceof Error ? error.message : String(error)
    console.error(`Config backup failed: ${redactSecrets(message)}`)

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
