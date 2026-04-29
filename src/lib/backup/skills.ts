/**
 * Skills Backup Module
 *
 * Backs up ClawHub agent skills directories as an encrypted tar.gz archive.
 *
 * FR-3: Automated skills backup with encryption
 * NFR-1: Secrets redaction in logs
 */

import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, writeFile, readFile, stat, access, readdir } from "node:fs/promises"
import { resolve, join } from "node:path"
import { homedir } from "node:os"
import type { BackupResult, EncryptionConfig } from "./types"

// ── Types ───────────────────────────────────────────────────────────────────

export interface SkillsBackupOptions {
  /** Directories to backup */
  skillsDirs: string[]
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

function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2))
  }
  return path
}

async function findFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        const subFiles = await findFiles(fullPath)
        files.push(...subFiles)
      } else {
        files.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable
  }
  return files
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Create a skills backup
 *
 * Steps:
 * 1. Find all skill files across directories
 * 2. Create tar.gz archive
 * 3. Encrypt with AES-256
 * 4. Generate checksum
 * 5. Clean up
 */
export async function backupSkills(options: SkillsBackupOptions): Promise<BackupResult> {
  const startTime = Date.now()
  const { skillsDirs, outputDir, encryption } = options

  // ── Validate inputs ────────────────────────────────────────────────────────
  if (!encryption.key || encryption.key.length < 8) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be at least 8 characters")
  }

  // ── Ensure output directory exists ───────────────────────────────────────
  await mkdir(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const baseName = `skills-${timestamp}`
  const tarPath = resolve(outputDir, `${baseName}.tar.gz`)
  const encPath = resolve(outputDir, `${baseName}.tar.gz.enc`)

  try {
    // ── Step 1: Find all skill files ──────────────────────────────────────
    const allPaths: string[] = []
    
    for (const dir of skillsDirs) {
      const expanded = expandHome(dir)
      try {
        await access(expanded)
        const files = await findFiles(expanded)
        allPaths.push(...files)
        console.log(`Found ${files.length} files in ${expanded}`)
      } catch {
        console.log(`Directory not found, skipping: ${expanded}`)
      }
    }
    
    if (allPaths.length === 0) {
      throw new Error("No skill files found to backup")
    }
    
    console.log(`Total: ${allPaths.length} skill files to backup`)

    // ── Step 2: Create tar.gz ─────────────────────────────────────────────
    console.log("Creating skills archive...")
    
    const fileListPath = resolve(outputDir, `${baseName}.filelist`)
    await writeFile(fileListPath, allPaths.join("\n"))
    
    execSync(`tar -czf "${tarPath}" -T "${fileListPath}"`, {
      encoding: "utf-8",
      timeout: 60_000,
    })
    
    // Clean up file list
    try {
      execSync(`rm -f "${fileListPath}"`, { encoding: "utf-8" })
    } catch {
      // Best effort
    }

    // ── Step 3: Encrypt ──────────────────────────────────────────────────────
    console.log("Encrypting skills backup...")
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

    console.log(`Skills backup complete: ${encPath}`)
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
    console.error(`Skills backup failed: ${redactSecrets(message)}`)

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
