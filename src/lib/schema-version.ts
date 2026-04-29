/**
 * Schema Versioning (FR-1, FR-2, NFR-3)
 *
 * Every memory write stores an explicit schema_version field.
 * Every read validates schema compatibility — reject or route through migration.
 * New versions never overwrite old records in place — they create new versioned artifacts.
 * Prior versions are preserved for audit and rollback.
 * Backward compatibility is required (NFR-3).
 */

// ── Schema Version Constants ──────────────────────────────────────────────

/**
 * Current schema version for all new writes.
 * Increment when the data model changes (embedding dims, field additions, type changes).
 * - Minor bump: compatible additive changes (new optional fields)
 * - Major bump: breaking changes (removed fields, type changes, embedding dim changes)
 */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * Minimum schema version this code can still read without data loss.
 * If a read encounters a version below this, the data is too old to process safely.
 */
export const MIN_SUPPORTED_VERSION = 1

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * Schema version type — integer for simplicity and sortability.
 * Future: could migrate to semver string if version complexity warrants it.
 */
export type SchemaVersion = number

/**
 * Result of a schema version compatibility check.
 */
export interface VersionCompatibilityResult {
  /** Whether the version is compatible with the current code */
  compatible: boolean
  /** Human-readable reason if incompatible */
  reason?: string
  /** Whether migration is available to upgrade the data */
  migrationAvailable: boolean
  /** Target version after migration (if available) */
  targetVersion?: SchemaVersion
}

// ── Compatibility Checks ─────────────────────────────────────────────────

/**
 * Check if a given schema version is compatible with the current code.
 *
 * Compatible means:
 * - version >= MIN_SUPPORTED_VERSION (not too old)
 * - version <= CURRENT_SCHEMA_VERSION (not from the future)
 *
 * @param version - The schema version to check
 * @returns Compatibility result with reason if incompatible
 */
export function isCompatibleVersion(version: SchemaVersion): VersionCompatibilityResult {
  // Too old — data predates what we can safely read
  if (version < MIN_SUPPORTED_VERSION) {
    return {
      compatible: false,
      reason: `Schema version ${version} is below minimum supported version ${MIN_SUPPORTED_VERSION}. Data is too old to process safely.`,
      migrationAvailable: false,
    }
  }

  // Too new — data was written by a future version of the code
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      compatible: false,
      reason: `Schema version ${version} is from a future version (current: ${CURRENT_SCHEMA_VERSION}). Cannot safely read data from newer schema.`,
      migrationAvailable: false,
    }
  }

  // Compatible — version is within [MIN_SUPPORTED, CURRENT]
  return {
    compatible: true,
    migrationAvailable: false,
  }
}

/**
 * Check if a version is current (matches CURRENT_SCHEMA_VERSION).
 * Useful for fast-path reads that don't need migration.
 */
export function isCurrentVersion(version: SchemaVersion): boolean {
  return version === CURRENT_SCHEMA_VERSION
}

// ── Migration Router ─────────────────────────────────────────────────────

/**
 * Migration registry: maps (fromVersion → toVersion) → migration function.
 * Each migration transforms data from one schema version to the next.
 * Migrations are applied sequentially — v1→v2→v3, not v1→v3 directly.
 */
type MigrationFn = (data: unknown) => unknown
const migrations = new Map<string, MigrationFn>()

/**
 * Register a migration from one schema version to the next.
 * Migrations should be idempotent and preserve all existing data.
 *
 * @param fromVersion - Source schema version
 * @param toVersion - Target schema version (should be fromVersion + 1)
 * @param fn - Migration function that transforms data
 */
export function registerMigration(fromVersion: SchemaVersion, toVersion: SchemaVersion, fn: MigrationFn): void {
  const key = `${fromVersion}->${toVersion}`
  migrations.set(key, fn)
}

/**
 * Migrate payload data from its current schema version to the current version.
 *
 * Applies migrations sequentially: if data is at v1 and current is v3,
 * it applies v1→v2 then v2→v3.
 *
 * @param version - Current schema version of the data
 * @param data - The data payload to migrate
 * @returns Migrated data at CURRENT_SCHEMA_VERSION, or original data if already current
 * @throws Error if no migration path exists from version to current
 */
export function migratePayload(version: SchemaVersion, data: unknown): unknown {
  if (version === CURRENT_SCHEMA_VERSION) {
    return data
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Cannot migrate from future schema version ${version} to current ${CURRENT_SCHEMA_VERSION}. ` +
        `Downgrade migration is not supported.`
    )
  }

  if (version < MIN_SUPPORTED_VERSION) {
    throw new Error(
      `Cannot migrate from schema version ${version} — below minimum supported ${MIN_SUPPORTED_VERSION}. ` +
        `Data is too old.`
    )
  }

  // Apply migrations sequentially
  let current = version
  let payload = data

  while (current < CURRENT_SCHEMA_VERSION) {
    const nextVersion = current + 1
    const key = `${current}->${nextVersion}`
    const migration = migrations.get(key)

    if (!migration) {
      throw new Error(
        `No migration registered from schema v${current} to v${nextVersion}. ` +
          `Cannot upgrade data from version ${version} to ${CURRENT_SCHEMA_VERSION}.`
      )
    }

    payload = migration(payload)
    current = nextVersion
  }

  return payload
}

/**
 * Get the number of registered migrations (useful for testing).
 */
export function getMigrationCount(): number {
  return migrations.size
}

/**
 * Clear all registered migrations (useful for testing).
 */
export function clearMigrations(): void {
  migrations.clear()
}