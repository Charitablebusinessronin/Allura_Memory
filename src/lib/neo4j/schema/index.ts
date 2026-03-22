import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeTransaction, readTransaction, type ManagedTransaction } from "../connection";

/**
 * Schema version tracking
 */
export interface SchemaVersion {
  version: string;
  applied_at: Date;
  description: string;
}

/**
 * Get the directory containing schema files
 */
function getSchemaDir(): string {
  // ESM-compatible way to get __dirname
  const currentUrl = import.meta.url;
  const currentPath = fileURLToPath(currentUrl);
  return dirname(currentPath);
}

/**
 * Read a Cypher schema file and return its contents
 */
function readSchemaFile(filename: string): string {
  const schemaDir = getSchemaDir();
  const filePath = join(schemaDir, filename);
  return readFileSync(filePath, "utf-8");
}

/**
 * Split Cypher into individual statements (rough split on semicolons)
 * Filters out comments and empty statements
 */
function splitCypherStatements(cypher: string): string[] {
  return cypher
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      // Skip empty statements
      if (s.length === 0) return false;
      // Skip pure comment blocks
      if (s.match(/^[\s\n\r]*\/\//)) return false;
      // Skip statements that are just comments
      if (s.match(/^[\s\n\r]*$/)) return false;
      return true;
    });
}

/**
 * Apply the insights schema to Neo4j
 * Creates constraints, indexes, and initial data
 */
export async function applyInsightsSchema(): Promise<void> {
  const cypher = readSchemaFile("insights.cypher");
  const statements = splitCypherStatements(cypher);

  await writeTransaction(async (tx: ManagedTransaction) => {
    for (const statement of statements) {
      // Skip comment-only lines
      if (statement.match(/^[\s]*\/\//)) continue;
      
      try {
        await tx.run(statement);
      } catch (error) {
        // Log but continue - some statements may fail if already exists
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("already exists") && 
            !errorMessage.includes("already indexed")) {
          console.warn(`[Neo4j Schema] Statement warning: ${errorMessage.slice(0, 100)}`);
        }
      }
    }
  });
}

/**
 * Check if a specific schema version has been applied
 */
export async function isSchemaVersionApplied(version: string): Promise<boolean> {
  try {
    const result = await readTransaction(async (tx: ManagedTransaction) => {
      const query = `
        MATCH (v:SchemaVersion {version: $version})
        RETURN v
      `;
      return await tx.run(query, { version });
    });

    return result.records.length > 0;
  } catch {
    // SchemaVersion node might not exist yet
    return false;
  }
}

/**
 * Record that a schema version has been applied
 */
export async function recordSchemaVersion(version: string, description: string): Promise<void> {
  await writeTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MERGE (v:SchemaVersion {version: $version})
      ON CREATE SET 
        v.applied_at = datetime(),
        v.description = $description
      ON MATCH SET 
        v.updated_at = datetime()
    `;
    await tx.run(query, { version, description });
  });
}

/**
 * Apply all schemas and record versions
 */
export async function initializeSchema(): Promise<void> {
  console.log("[Neo4j Schema] Applying insights schema...");
  
  await applyInsightsSchema();
  await recordSchemaVersion("1.0.0-insights", "Initial insight versioning schema");
  
  console.log("[Neo4j Schema] Schema initialization complete");
}

/**
 * Health check: verify Neo4j connectivity and schema status
 */
export async function healthCheck(): Promise<{
  connected: boolean;
  schemaVersions: string[];
  error?: string;
}> {
  try {
    const result = await readTransaction(async (tx: ManagedTransaction) => {
      const query = `
        MATCH (v:SchemaVersion)
        RETURN v.version as version
        ORDER BY v.version
      `;
      return await tx.run(query);
    });

    const versions = result.records.map((r) => r.get("version") as string);

    return {
      connected: true,
      schemaVersions: versions,
    };
  } catch (error) {
    return {
      connected: false,
      schemaVersions: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}