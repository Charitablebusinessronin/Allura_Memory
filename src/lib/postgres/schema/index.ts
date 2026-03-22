import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getPool, closePool, isPoolHealthy } from "../connection";

/**
 * Schema application result
 */
export interface SchemaResult {
  success: boolean;
  version: string;
  appliedAt: Date;
  error?: string;
}

/**
 * Get the directory path for schema files
 * Works in both ESM and CommonJS contexts
 */
function getSchemaDir(): string {
  // ESM context
  // The index.ts file is inside the schema directory, so __dirname equivalent
  // already points to the schema directory
  if (typeof import.meta !== "undefined" && import.meta.url) {
    // This file is at schema/index.ts, so dirname gives us the schema directory
    return dirname(fileURLToPath(import.meta.url));
  }
  // Fallback for CommonJS or other contexts
  return join(process.cwd(), "src", "lib", "postgres", "schema");
}

/**
 * Read and return the traces schema SQL
 */
export function getTracesSchemaSQL(): string {
  const schemaPath = join(getSchemaDir(), "traces.sql");

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  return readFileSync(schemaPath, "utf-8");
}

/**
 * Initialize the database schema
 * Applies all schema migrations in order
 * Idempotent - safe to run multiple times
 */
export async function initializeSchema(): Promise<SchemaResult> {
  try {
    // Get the schema SQL
    const schemaSQL = getTracesSchemaSQL();

    // Apply the schema using the connection pool
    const pool = getPool();

    // Execute the full schema
    // This is safe because:
    // 1. CREATE TABLE IF NOT EXISTS is idempotent
    // 2. CREATE INDEX IF NOT EXISTS is idempotent
    // 3. Schema version is tracked and ON CONFLICT DO NOTHING prevents re-inserts
    await pool.query(schemaSQL);

    // Verify the schema was applied
    const schemaCheck = await pool.query(`
      SELECT version, applied_at
      FROM schema_versions
      WHERE version = '1.0.0-traces'
    `);

    if (schemaCheck.rows.length === 0) {
      throw new Error("Schema version not recorded after application");
    }

    return {
      success: true,
      version: "1.0.0-traces",
      appliedAt: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      version: "1.0.0-traces",
      appliedAt: new Date(),
      error: errorMessage,
    };
  }
}

/**
 * Check if the schema has been initialized
 * Returns the version if initialized, null otherwise
 */
export async function getSchemaVersion(): Promise<string | null> {
  try {
    const pool = getPool();

    // Check if schema_versions table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'schema_versions'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return null;
    }

    // Get the latest version
    const versionResult = await pool.query(`
      SELECT version
      FROM schema_versions
      ORDER BY applied_at DESC
      LIMIT 1
    `);

    if (versionResult.rows.length === 0) {
      return null;
    }

    return versionResult.rows[0].version;
  } catch {
    return null;
  }
}

/**
 * Ensure schema is initialized before application starts
 * Call this during application startup
 */
export async function ensureSchemaInitialized(): Promise<void> {
  const existingVersion = await getSchemaVersion();

  if (existingVersion) {
    console.log(`[PostgreSQL Schema] Already initialized: ${existingVersion}`);
    return;
  }

  console.log("[PostgreSQL Schema] Initializing...");

  const result = await initializeSchema();

  if (!result.success) {
    throw new Error(`Failed to initialize schema: ${result.error}`);
  }

  console.log(`[PostgreSQL Schema] Initialized: ${result.version}`);
}

/**
 * Full health check for the PostgreSQL layer
 * Includes connection and schema verification
 */
export async function healthCheck(): Promise<{
  connected: boolean;
  schemaVersion: string | null;
  healthy: boolean;
  error?: string;
}> {
  try {
    const connected = await isPoolHealthy();
    const schemaVersion = await getSchemaVersion();

    return {
      connected,
      schemaVersion,
      healthy: connected,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      connected: false,
      schemaVersion: null,
      healthy: false,
      error: errorMessage,
    };
  }
}