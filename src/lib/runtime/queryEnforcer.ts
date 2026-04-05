/**
 * Query Enforcer - Tenant Isolation for SQL and Cypher Queries
 * ARCH-001: Enforce group_id filtering in PostgreSQL and Neo4j queries
 * 
 * This module provides semantic firewall enforcement for database queries,
 * ensuring all operations are scoped to a specific tenant group_id.
 */

import { validateTenantGroupId } from '../validation/tenant-group-id';
import { GroupIdValidationError } from '../validation/group-id';

/**
 * Audit log entry structure
 */
export interface AuditEntry {
  group_id: string;
  timestamp: string;
  query_type: string;
  query: string;
  allowed: boolean;
  error?: string;
}

/**
 * PostgreSQL query context
 */
export interface PostgresQueryContext {
  query: string;
  params: unknown[];
  group_id: string;
}

/**
 * Neo4j query context
 */
export interface Neo4jQueryContext {
  query: string;
  params: Record<string, unknown>;
  group_id: string;
}

/**
 * Enforcer result for PostgreSQL queries
 */
export interface PostgresEnforcerResult {
  allowed: boolean;
  error?: string;
  query?: string;
  audit?: AuditEntry;
}

/**
 * Enforcer result for Neo4j queries
 */
export interface Neo4jEnforcerResult {
  allowed: boolean;
  error?: string;
  query?: string;
  audit?: AuditEntry;
}

/**
 * Error code for tenant isolation violations
 */
const TENANT_ERROR_CODE = 'RK-01';

/**
 * Detect query type from SQL query string
 */
function detectSqlQueryType(query: string): string {
  const normalizedQuery = query.trim().toUpperCase();
  
  if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
  if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
  if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
  if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
  if (normalizedQuery.startsWith('CREATE')) return 'CREATE';
  if (normalizedQuery.startsWith('DROP')) return 'DROP';
  if (normalizedQuery.startsWith('ALTER')) return 'ALTER';
  
  return 'UNKNOWN';
}

/**
 * Detect query type from Cypher query string
 */
function detectCypherQueryType(query: string): string {
  const normalizedQuery = query.trim().toUpperCase();
  
  if (normalizedQuery.startsWith('MATCH')) return 'MATCH';
  if (normalizedQuery.startsWith('CREATE')) return 'CREATE';
  if (normalizedQuery.startsWith('MERGE')) return 'MERGE';
  if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
  if (normalizedQuery.startsWith('SET')) return 'SET';
  if (normalizedQuery.startsWith('REMOVE')) return 'REMOVE';
  
  return 'UNKNOWN';
}

/**
 * Create audit entry for query execution
 */
function createAuditEntry(
  group_id: string,
  query_type: string,
  query: string,
  allowed: boolean,
  error?: string
): AuditEntry {
  return {
    group_id,
    timestamp: new Date().toISOString(),
    query_type,
    query,
    allowed,
    error,
  };
}

/**
 * Enforce group_id filtering for PostgreSQL queries
 * 
 * Validates that:
 * 1. group_id is in allura-{org} format
 * 2. Query includes WHERE group_id clause
 * 3. Query params match the context group_id
 * 4. Tenant isolation is enforced
 * 
 * @param context - PostgreSQL query context
 * @returns Enforcer result with audit trail
 */
export function enforcePostgresGroupId(
  context: PostgresQueryContext
): PostgresEnforcerResult {
  const { query, params, group_id } = context;

  // Step 1: Validate group_id format
  let validatedGroupId: string;
  try {
    validatedGroupId = validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: ${error.message}`,
        audit: createAuditEntry(
          group_id,
          detectSqlQueryType(query),
          query,
          false,
          error.message
        ),
      };
    }
    throw error;
  }

  // Step 2: Parse query for group_id filtering
  const normalizedQuery = query.toUpperCase();
  const queryType = detectSqlQueryType(query);

  // Step 3: Check for dangerous operations (CREATE, DROP, ALTER without group_id)
  if (['CREATE', 'DROP', 'ALTER'].includes(queryType)) {
    // These operations require explicit group_id handling
    if (!normalizedQuery.includes('GROUP_ID')) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: ${queryType} operations require explicit group_id specification for tenant isolation`,
        audit: createAuditEntry(
          validatedGroupId,
          queryType,
          query,
          false,
          `${queryType} operations require explicit group_id`
        ),
      };
    }
  }

  // Step 4: For DML operations (SELECT, INSERT, UPDATE, DELETE)
  if (['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(queryType)) {
    // Must have WHERE clause
    if (!normalizedQuery.includes('WHERE')) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: Query missing WHERE clause. All queries must include group_id filter for tenant isolation.`,
        audit: createAuditEntry(
          validatedGroupId,
          queryType,
          query,
          false,
          'Missing WHERE clause'
        ),
      };
    }

    // Must include group_id in WHERE clause
    if (!normalizedQuery.includes('GROUP_ID')) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: Query missing group_id in WHERE clause. Tenant isolation violation.`,
        audit: createAuditEntry(
          validatedGroupId,
          queryType,
          query,
          false,
          'Missing group_id in WHERE clause'
        ),
      };
    }

    // Step 5: For parameterized queries, verify group_id matches context
    // Find all occurrences of group_id parameters in the query
    const groupIdParamRegex = /GROUP_ID\s*=\s*\$(\d+)/gi;
    const matches = [...query.matchAll(groupIdParamRegex)];
    
    if (matches.length > 0) {
      for (const match of matches) {
        const paramIndex = parseInt(match[1]) - 1; // PostgreSQL params are 1-indexed
        const paramValue = params[paramIndex];
        
        if (typeof paramValue === 'string' && paramValue !== validatedGroupId) {
          return {
            allowed: false,
            error: `${TENANT_ERROR_CODE}: Tenant isolation violation. Query parameter group_id (${paramValue}) does not match context group_id (${validatedGroupId}).`,
            audit: createAuditEntry(
              validatedGroupId,
              queryType,
              query,
              false,
              `Parameter mismatch: ${paramValue} !== ${validatedGroupId}`
            ),
          };
        }
      }
    }
  }

  // Step 6: All checks passed
  return {
    allowed: true,
    query,
    audit: createAuditEntry(validatedGroupId, queryType, query, true),
  };
}

/**
 * Enforce group_id filtering for Neo4j Cypher queries
 * 
 * Validates that:
 * 1. group_id is in allura-{org} format
 * 2. Query includes WHERE n.group_id clause or group_id property
 * 3. Query params match the context group_id
 * 4. Tenant isolation is enforced
 * 
 * @param context - Neo4j query context
 * @returns Enforcer result with audit trail
 */
export function enforceNeo4jGroupId(
  context: Neo4jQueryContext
): Neo4jEnforcerResult {
  const { query, params, group_id } = context;

  // Step 1: Validate group_id format
  let validatedGroupId: string;
  try {
    validatedGroupId = validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: ${error.message}`,
        audit: createAuditEntry(
          group_id,
          detectCypherQueryType(query),
          query,
          false,
          error.message
        ),
      };
    }
    throw error;
  }

  // Step 2: Parse query for group_id filtering
  const normalizedQuery = query.toUpperCase();
  const queryType = detectCypherQueryType(query);

  // Step 3: Check for node creation/merge operations
  if (['CREATE', 'MERGE'].includes(queryType)) {
    // Must include group_id property
    if (!normalizedQuery.includes('GROUP_ID')) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: ${queryType} operations require group_id property for tenant isolation.`,
        audit: createAuditEntry(
          validatedGroupId,
          queryType,
          query,
          false,
          `${queryType} operations require group_id property`
        ),
      };
    }

    // Verify params.group_id matches context
    if (params.group_id && params.group_id !== validatedGroupId) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: Tenant isolation violation. Parameter group_id (${params.group_id}) does not match context group_id (${validatedGroupId}).`,
        audit: createAuditEntry(
          validatedGroupId,
          queryType,
          query,
          false,
          `Parameter mismatch: ${String(params.group_id)} !== ${validatedGroupId}`
        ),
      };
    }
  }

  // Step 4: For MATCH queries, require WHERE clause with group_id
  if (queryType === 'MATCH') {
    // Must have WHERE clause
    if (!normalizedQuery.includes('WHERE')) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: MATCH query missing WHERE clause. All queries must include group_id filter for tenant isolation.`,
        audit: createAuditEntry(
          validatedGroupId,
          queryType,
          query,
          false,
          'Missing WHERE clause'
        ),
      };
    }

    // Must include group_id in WHERE clause
    if (!normalizedQuery.includes('GROUP_ID')) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: MATCH query missing group_id in WHERE clause. Tenant isolation violation.`,
        audit: createAuditEntry(
          validatedGroupId,
          queryType,
          query,
          false,
          'Missing group_id in WHERE clause'
        ),
      };
    }

    // Verify params.group_id matches context
    if (params.group_id && params.group_id !== validatedGroupId) {
      return {
        allowed: false,
        error: `${TENANT_ERROR_CODE}: Tenant isolation violation. Parameter group_id (${params.group_id}) does not match context group_id (${validatedGroupId}).`,
        audit: createAuditEntry(
          validatedGroupId,
          queryType,
          query,
          false,
          `Parameter mismatch: ${String(params.group_id)} !== ${validatedGroupId}`
        ),
      };
    }
  }

  // Step 5: All checks passed
  return {
    allowed: true,
    query,
    audit: createAuditEntry(validatedGroupId, queryType, query, true),
  };
}

/**
 * Export error code for external use
 */
export { TENANT_ERROR_CODE };