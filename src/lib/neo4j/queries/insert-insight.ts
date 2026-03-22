import { writeTransaction, readTransaction, type ManagedTransaction } from "../connection";

/**
 * Insight status values
 */
export type InsightStatus = "active" | "superseded" | "deprecated" | "reverted";

/**
 * Source type for insight provenance
 */
export type InsightSourceType = "trace" | "manual" | "promotion" | "import";

/**
 * Insight creation payload
 */
export interface InsightInsert {
  /** Required: Stable identifier for this insight across versions */
  insight_id: string;
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Required: The insight content (knowledge text) */
  content: string;
  /** Required: Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Optional: Source type (defaults to 'manual') */
  source_type?: InsightSourceType;
  /** Optional: Reference to source evidence (e.g., PostgreSQL event ID) */
  source_ref?: string;
  /** Optional: Agent or system that created this insight */
  created_by?: string;
  /** Optional: Additional structured metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Insight record as stored in Neo4j
 */
export interface InsightRecord {
  /** Surrogate key (UUID) */
  id: string;
  /** Stable identifier across versions */
  insight_id: string;
  /** Version number (auto-incremented) */
  version: number;
  /** The insight content */
  content: string;
  /** Confidence score */
  confidence: number;
  /** Tenant identifier */
  group_id: string;
  /** Source type */
  source_type: InsightSourceType;
  /** Source reference */
  source_ref: string | null;
  /** Creation timestamp */
  created_at: Date;
  /** Creator agent/system */
  created_by: string | null;
  /** Current status */
  status: InsightStatus;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Insight head record (tracks current version)
 */
export interface InsightHeadRecord {
  insight_id: string;
  group_id: string;
  current_version: number;
  current_id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Validation error for invalid insight data
 */
export class InsightValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsightValidationError";
  }
}

/**
 * Conflict error for duplicate operations
 */
export class InsightConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsightConflictError";
  }
}

/**
 * Validate insight insert payload
 */
function validateInsightInsert(insight: InsightInsert): void {
  const errors: string[] = [];

  if (!insight.insight_id || insight.insight_id.trim().length === 0) {
    errors.push("insight_id is required and cannot be empty");
  }

  if (!insight.group_id || insight.group_id.trim().length === 0) {
    errors.push("group_id is required and cannot be empty");
  }

  if (!insight.content || insight.content.trim().length === 0) {
    errors.push("content is required and cannot be empty");
  }

  if (insight.confidence < 0 || insight.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }

  if (errors.length > 0) {
    throw new InsightValidationError(`Insight validation failed: ${errors.join("; ")}`);
  }
}

/**
 * Convert Neo4j record to InsightRecord
 */
function neo4jToRecord(record: Record<string, unknown>): InsightRecord {
  // Neo4j returns properties directly on the node object
  const props = record.properties || record;
  
  const convertValue = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    // Handle Neo4j Integer
    if (typeof val === "object" && val !== null && "toNumber" in val && typeof (val as { toNumber: () => number }).toNumber === "function") {
      return (val as { toNumber: () => number }).toNumber();
    }
    return val;
  };

  const convertDate = (val: unknown): Date | null => {
    if (val === null || val === undefined) return null;
    // Handle Neo4j DateTime
    if (typeof val === "object" && val !== null) {
      const dateTime = val as { toString?: () => string; year?: { toNumber?: () => number }; month?: { toNumber?: () => number }; day?: { toNumber?: () => number } };
      if (typeof dateTime.toString === "function") {
        return new Date(dateTime.toString());
      }
      // Handle Neo4j Date object
      if (dateTime.year && dateTime.month && dateTime.day) {
        const y = typeof dateTime.year === "object" && "toNumber" in dateTime.year ? dateTime.year.toNumber() : dateTime.year;
        const m = typeof dateTime.month === "object" && "toNumber" in dateTime.month ? dateTime.month.toNumber() : dateTime.month;
        const d = typeof dateTime.day === "object" && "toNumber" in dateTime.day ? dateTime.day.toNumber() : dateTime.day;
        return new Date(y, m - 1, d);
      }
    }
    return new Date(val as string);
  };

  const convertMetadata = (val: unknown): Record<string, unknown> => {
    if (val === null || val === undefined) return {};
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return {};
      }
    }
    // Neo4j stores maps as objects
    if (typeof val === "object") {
      // Convert any Neo4j integers in the object
      const result: Record<string, unknown> = {};
      const obj = val as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        result[key] = convertValue(obj[key]);
      }
      return result;
    }
    return {};
  };

  return {
    id: props.id as string,
    insight_id: props.insight_id as string,
    version: convertValue(props.version) as number,
    content: props.content as string,
    confidence: convertValue(props.confidence) as number,
    group_id: props.group_id as string,
    source_type: props.source_type as InsightSourceType,
    source_ref: props.source_ref as string | null,
    created_at: convertDate(props.created_at) as Date,
    created_by: props.created_by as string | null,
    status: props.status as InsightStatus,
    metadata: convertMetadata(props.metadata),
  };
}

/**
 * Create a new insight (version 1)
 * Creates the InsightHead node if it doesn't exist
 * 
 * @param insight - The insight to create
 * @returns The created insight record
 * @throws InsightValidationError if validation fails
 * @throws InsightConflictError if insight_id already exists
 */
export async function createInsight(insight: InsightInsert): Promise<InsightRecord> {
  validateInsightInsert(insight);

  const result = await writeTransaction(async (tx: ManagedTransaction) => {
    // First check if insight_id already exists for this group (tenant isolation)
    const checkQuery = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      RETURN h
    `;
    const checkResult = await tx.run(checkQuery, { 
      insight_id: insight.insight_id, 
      group_id: insight.group_id 
    });

    if (checkResult.records.length > 0) {
      throw new InsightConflictError(
        `Insight with insight_id '${insight.insight_id}' already exists in group '${insight.group_id}'. Use createInsightVersion to create a new version.`
      );
    }

    // Create new insight with version 1
    const query = `
      CREATE (i:Insight {
        id: randomUUID(),
        insight_id: $insight_id,
        version: 1,
        content: $content,
        confidence: $confidence,
        group_id: $group_id,
        source_type: $source_type,
        source_ref: $source_ref,
        created_at: datetime(),
        created_by: $created_by,
        status: 'active',
        metadata: $metadata
      })
      WITH i
      MERGE (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      ON CREATE SET 
        h.group_id = $group_id,
        h.created_at = datetime()
      SET 
        h.current_version = 1,
        h.current_id = i.id,
        h.updated_at = datetime()
      CREATE (i)-[:VERSION_OF]->(h)
      RETURN i
    `;

    const params = {
      insight_id: insight.insight_id,
      content: insight.content,
      confidence: insight.confidence,
      group_id: insight.group_id,
      source_type: insight.source_type || "manual",
      source_ref: insight.source_ref || null,
      created_by: insight.created_by || null,
      metadata: JSON.stringify(insight.metadata || {}),
    };

    const queryResult = await tx.run(query, params);
    return queryResult;
  });

  // Extract the node from the result
  const record = result.records[0];
  const node = record.get("i");
  return neo4jToRecord(node.properties);
}

/**
 * Create a new version of an existing insight
 * Supersedes the current version
 * 
 * @param insight_id - The stable insight identifier
 * @param content - New content for this version
 * @param confidence - New confidence score
 * @param metadata - Optional metadata
 * @returns The new insight version
 * @throws InsightValidationError if insight not found
 */
export async function createInsightVersion(
  insight_id: string,
  content: string,
  confidence: number,
  group_id: string,
  metadata?: Record<string, unknown>
): Promise<InsightRecord> {
  if (!insight_id || insight_id.trim().length === 0) {
    throw new InsightValidationError("insight_id is required");
  }

  if (!content || content.trim().length === 0) {
    throw new InsightValidationError("content is required");
  }

  if (confidence < 0 || confidence > 1) {
    throw new InsightValidationError("confidence must be between 0 and 1");
  }

  const result = await writeTransaction(async (tx: ManagedTransaction) => {
    // Get the InsightHead and current version
    const headQuery = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      RETURN h.current_id as current_id, h.current_version as current_version
    `;
    const headResult = await tx.run(headQuery, { insight_id, group_id });

    if (headResult.records.length === 0) {
      throw new InsightValidationError(
        `Insight with insight_id '${insight_id}' not found in group '${group_id}'`
      );
    }

    const currentId = headResult.records[0].get("current_id") as string;
    const currentVersion = typeof headResult.records[0].get("current_version") === "object" &&
      "toNumber" in (headResult.records[0].get("current_version") as object)
      ? (headResult.records[0].get("current_version") as { toNumber: () => number }).toNumber()
      : (headResult.records[0].get("current_version") as number);

    // Create new version and supersede the old one
    const query = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      MATCH (prev:Insight {id: $current_id})
      CREATE (new:Insight {
        id: randomUUID(),
        insight_id: $insight_id,
        version: $new_version,
        content: $content,
        confidence: $confidence,
        group_id: $group_id,
        source_type: 'promotion',
        source_ref: null,
        created_at: datetime(),
        created_by: null,
        status: 'active',
        metadata: $metadata
      })
      CREATE (new)-[:VERSION_OF]->(h)
      CREATE (new)-[:SUPERSEDES]->(prev)
      SET h.current_version = $new_version, h.current_id = new.id, h.updated_at = datetime()
      SET prev.status = 'superseded'
      RETURN new
    `;

    const queryResult = await tx.run(query, {
      insight_id,
      group_id,
      current_id: currentId,
      new_version: currentVersion + 1,
      content,
      confidence,
      metadata: JSON.stringify(metadata || {}),
    });

    return queryResult;
  });

  // Extract the node from the result (query returns 'new' not 'i')
  const record = result.records[0];
  const node = record.get("new");
  return neo4jToRecord(node.properties);
}

/**
 * Deprecate an insight (mark as deprecated, not superseded)
 * 
 * @param insight_id - The insight identifier
 * @param group_id - Tenant identifier
 * @param reason - Optional reason for deprecation
 * @returns The deprecated insight record
 */
export async function deprecateInsight(
  insight_id: string,
  group_id: string,
  reason?: string
): Promise<InsightRecord> {
  const result = await writeTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      SET i.status = 'deprecated'
      SET i.deprecation_reason = $reason
      SET h.updated_at = datetime()
      RETURN i
    `;

    const queryResult = await tx.run(query, {
      insight_id,
      group_id,
      reason: reason || null,
    });

    if (queryResult.records.length === 0) {
      throw new InsightValidationError(
        `Insight with insight_id '${insight_id}' not found in group '${group_id}'`
      );
    }

    return queryResult;
  });

  // Extract the node from the result
  const record = result.records[0];
  const node = record.get("i");
  return neo4jToRecord(node.properties);
}

/**
 * Revert to a previous version
 * Creates a new version that copies the content of the target version
 * 
 * @param insight_id - The insight identifier
 * @param group_id - Tenant identifier
 * @param target_version - The version to revert to
 * @returns The new insight version (copy of target)
 */
export async function revertInsightVersion(
  insight_id: string,
  group_id: string,
  target_version: number
): Promise<InsightRecord> {
  const result = await writeTransaction(async (tx: ManagedTransaction) => {
    // Get the target version content
    const targetQuery = `
      MATCH (i:Insight {insight_id: $insight_id, version: $target_version, group_id: $group_id})
      RETURN i.content as content, i.confidence as confidence, i.metadata as metadata
    `;
    const targetResult = await tx.run(targetQuery, { 
      insight_id, 
      target_version: target_version, 
      group_id 
    });

    if (targetResult.records.length === 0) {
      throw new InsightValidationError(
        `Insight version ${target_version} not found for insight_id '${insight_id}'`
      );
    }

    const content = targetResult.records[0].get("content") as string;
    const confidence = typeof targetResult.records[0].get("confidence") === "object" &&
      "toNumber" in (targetResult.records[0].get("confidence") as object)
      ? (targetResult.records[0].get("confidence") as { toNumber: () => number }).toNumber()
      : (targetResult.records[0].get("confidence") as number);
    const metadata = targetResult.records[0].get("metadata");

    // Get current head
    const headQuery = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      RETURN h.current_id as current_id, h.current_version as current_version
    `;
    const headResult = await tx.run(headQuery, { insight_id, group_id });

    if (headResult.records.length === 0) {
      throw new InsightValidationError(
        `Insight with insight_id '${insight_id}' not found`
      );
    }

    const currentId = headResult.records[0].get("current_id") as string;
    const currentVersion = typeof headResult.records[0].get("current_version") === "object" &&
      "toNumber" in (headResult.records[0].get("current_version") as object)
      ? (headResult.records[0].get("current_version") as { toNumber: () => number }).toNumber()
      : (headResult.records[0].get("current_version") as number);

    // Create new version pointing back to the reverted version
    const query = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      MATCH (prev:Insight {id: $current_id})
      MATCH (reverted:Insight {insight_id: $insight_id, version: $target_version})
      CREATE (new:Insight {
        id: randomUUID(),
        insight_id: $insight_id,
        version: $new_version,
        content: $content,
        confidence: $confidence,
        group_id: $group_id,
        source_type: 'promotion',
        source_ref: null,
        created_at: datetime(),
        created_by: null,
        status: 'active',
        metadata: $metadata
      })
      CREATE (new)-[:VERSION_OF]->(h)
      CREATE (new)-[:SUPERSEDES]->(prev)
      CREATE (new)-[:REVERTED]->(reverted)
      SET h.current_version = $new_version, h.current_id = new.id, h.updated_at = datetime()
      SET prev.status = 'superseded'
      RETURN new
    `;

    const queryResult = await tx.run(query, {
      insight_id,
      group_id,
      current_id: currentId,
      target_version,
      new_version: currentVersion + 1,
      content,
      confidence,
      metadata,
    });

    return queryResult;
  });

  // Extract the node from the result
  const record = result.records[0];
  const node = record.get("new");
  return neo4jToRecord(node.properties);
}