/**
 * Enforced MCP Client
 * 
 * Higher-level wrapper that enforces group_id validation on ALL operations.
 * Provides type-safe methods for common MCP operations while ensuring tenant isolation.
 * 
 * Architecture:
 * - Validates group_id at construction time
 * - Wraps McpToolCaller with enforced groupId
 * - Provides type-safe interfaces for common operations
 */

import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';
import type { McpToolCaller } from '@/integrations/mcp.client';

/**
 * ALLURA_PREFIX - Required for all tenant IDs
 * ARCH-001: Enforce allura-* naming convention for tenant isolation
 */
const ALLURA_PREFIX = 'allura-';

/**
 * Validate that group_id follows allura-* naming convention
 * ARCH-001 compliance
 */
function validateAlluraPrefix(groupId: string): void {
  if (!groupId.startsWith(ALLURA_PREFIX)) {
    throw new GroupIdValidationError(
      `group_id must use allura-* format (found: '${groupId}'). ` +
      `Example: allura-faith-meats`
    );
  }
}

/**
 * Common parameter types for MCP operations
 */
export interface CreatePageParams {
  parent: {
    page_id?: string;
    database_id?: string;
    data_source_id?: string;
  };
  pages: Array<{
    properties: Record<string, unknown>;
    content?: string;
    icon?: string;
    cover?: string;
    template_id?: string;
  }>;
}

export interface UpdatePageParams {
  page_id: string;
  properties?: Record<string, unknown>;
  content_updates?: Array<{
    old_str: string;
    new_str: string;
  }>;
  icon?: string;
  cover?: string;
}

export interface SearchParams {
  query: string;
  page_size?: number;
  filters?: Record<string, unknown>;
}

export interface FetchParams {
  id: string;
  include_discussions?: boolean;
}

/**
 * MCP Operation Result
 */
export interface McpOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  group_id: string;
  timestamp: string;
}

/**
 * Enforced MCP Client - Requires group_id for all operations
 * 
 * Usage:
 * ```typescript
 * const client = new EnforcedMcpClient('allura-faith-meats', innerClient);
 * 
 * // groupId is validated at construction
 * const result = await client.callTool('notion-create-pages', {
 *   parent: { database_id: 'abc123' },
 *   pages: [{ properties: { Name: 'Test Page' } }]
 * });
 * ```
 */
export class EnforcedMcpClient implements McpToolCaller {
  private readonly groupId: string;
  private readonly innerClient: McpToolCaller;

  constructor(groupId: string, innerClient: McpToolCaller) {
    // Validate group_id format (lowercase, length, etc.)
    this.groupId = validateGroupId(groupId);
    
    // ARCH-001: Enforce allura-* naming convention
    validateAlluraPrefix(this.groupId);
    
    this.innerClient = innerClient;
  }

  /**
   * Get the validated group_id
   */
  getGroupId(): string {
    return this.groupId;
  }

  /**
   * Internal method to add group_id to params
   */
  private withGroupId<T extends Record<string, unknown>>(params: T): T & { group_id: string } {
    return {
      ...params,
      group_id: this.groupId,
    };
  }

  /**
   * Call an MCP tool with enforced group_id
   * 
   * Automatically injects the validated group_id into all tool calls.
   */
  async callTool<T = unknown>(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<T> {
    // Enforce group_id is present in all calls
    return this.innerClient.callTool<T>(toolName, this.withGroupId(args));
  }

  /**
   * Create a Notion page
   * Automatically injects group_id for audit trail
   */
  async createPage(params: CreatePageParams): Promise<McpOperationResult<unknown>> {
    try {
      const result = await this.innerClient.callTool(
        'notion-create-pages',
        this.withGroupId(params as unknown as Record<string, unknown>)
      );

      return {
        success: true,
        data: result,
        group_id: this.groupId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleError(error, 'createPage');
    }
  }

  /**
   * Update a Notion page
   * Automatically injects group_id for audit trail
   */
  async updatePage(params: UpdatePageParams): Promise<McpOperationResult<unknown>> {
    try {
      const result = await this.innerClient.callTool(
        'notion-update-page',
        this.withGroupId(params as unknown as Record<string, unknown>)
      );

      return {
        success: true,
        data: result,
        group_id: this.groupId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleError(error, 'updatePage');
    }
  }

  /**
   * Search Notion
   * Automatically injects group_id for tenant isolation
   */
  async search(params: SearchParams): Promise<McpOperationResult<unknown>> {
    try {
      const result = await this.innerClient.callTool(
        'notion-search',
        this.withGroupId(params as unknown as Record<string, unknown>)
      );

      return {
        success: true,
        data: result,
        group_id: this.groupId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleError(error, 'search');
    }
  }

  /**
   * Fetch a Notion page or database
   * Automatically injects group_id for tenant isolation
   */
  async fetch(params: FetchParams): Promise<McpOperationResult<unknown>> {
    try {
      const result = await this.innerClient.callTool(
        'notion-fetch',
        this.withGroupId(params as unknown as Record<string, unknown>)
      );

      return {
        success: true,
        data: result,
        group_id: this.groupId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleError(error, 'fetch');
    }
  }

  /**
   * Error handler
   */
  private handleError(error: unknown, operation: string): McpOperationResult<never> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[EnforcedMcpClient] Operation '${operation}' failed for group '${this.groupId}':`, error);
    
    return {
      success: false,
      error: errorMessage,
      group_id: this.groupId,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Factory function to create an enforced client
 * 
 * @param groupId - The group_id to enforce on all operations
 * @param innerClient - The underlying MCP client to wrap
 * @throws GroupIdValidationError if group_id is invalid
 * @returns EnforcedMcpClient instance
 */
export function createEnforcedClient(groupId: string, innerClient: McpToolCaller): EnforcedMcpClient {
  return new EnforcedMcpClient(groupId, innerClient);
}

/**
 * Re-export GroupIdValidationError for consumers
 */
export { GroupIdValidationError };