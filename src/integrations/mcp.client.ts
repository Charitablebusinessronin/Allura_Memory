/**
 * MCP Client
 * 
 * Bridge between curator and the existing MCP tools in memory-server.ts
 */

import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';

/**
 * MCP Tool Caller interface
 */
export interface McpToolCaller {
  callTool<T = unknown>(toolName: string, args: Record<string, unknown>): Promise<T>;
}

/**
 * MCP Client Implementation
 * 
 * Calls tools from the existing memory-server.ts MCP implementation
 */
export class McpClientImpl implements McpToolCaller {
  /**
   * Call an MCP tool
   * 
   * This will be called from the curator to invoke tools like:
   * - notion-create-pages
   * - notion-update-page
   * - notion-fetch
   * - search_insights
   * - create_insight
   * 
   * NOTE: Call-sites should use EnforcedMcpClient for automatic group_id validation.
   * This method trusts that the caller has validated group_id if required.
   */
  async callTool<T = unknown>(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<T> {
    // Import the MCP server dynamically to access tools
    // This connects to the existing memory-server.ts implementation
    
    // For standalone curator runs, we use the Smithery CLI
    // For embedded curator runs (from MCP server), we use direct call
    
    const isEmbedded = process.env.MCP_EMBEDDED === 'true';
    
    if (isEmbedded) {
      // Called from within MCP server - use direct tool invocation
      // This path is used when curator is invoked as an MCP tool itself
      return this.callEmbeddedTool<T>(toolName, args);
    }
    
    // Standalone curator - use Smithery CLI
    return this.callSmitheryTool<T>(toolName, args);
  }

  private async callSmitheryTool<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Map tool names to Smithery tool names
    const smitheryToolName = this.mapToolName(toolName);
    const argsJson = JSON.stringify(args);
    
    try {
      // Use Smithery CLI to call Notion tools
      const { stdout, stderr } = await execAsync(
        `smithery tool call notion-memory ${smitheryToolName} '${argsJson}'`,
        { maxBuffer: 1024 * 1024 * 10 }
      );
      
      // Parse the Smithery output
      const output = stdout.trim();
      
      // Try to parse as direct JSON first
      try {
        const parsed = JSON.parse(output);
        return this.extractResult<T>(parsed);
      } catch {
        // Not direct JSON, try to extract from content
      }
      
      // Try to find JSON in the output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.extractResult<T>(parsed);
      }
      
      throw new Error(`Could not parse MCP output: ${output.substring(0, 200)}`);
    } catch (error: any) {
      // If MCP fails, try to parse partial output
      const match = error.stdout?.match(/\{"content".*\}/s);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          return this.extractResult<T>(parsed);
        } catch {
          // Fall through to error
        }
      }
      throw new Error(`MCP tool ${toolName} failed: ${error.message}`);
    }
  }

  /**
   * Map internal tool names to Smithery Notion tool names
   */
  private mapToolName(toolName: string): string {
    const toolMap: Record<string, string> = {
      'API-post-page': 'notion-create-pages',
      'API-patch-page': 'notion-update-page',
      'API-query-data-source': 'notion-search',
      'API-post-search': 'notion-search',
      'API-get-page': 'notion-fetch',
      'API-retrieve-a-database': 'notion-fetch',
    };
    return toolMap[toolName] || toolName;
  }

  /**
   * Extract result from Smithery CLI output
   */
  private extractResult<T>(parsed: any): T {
    // Smithery CLI wraps results in content array
    if (parsed.content?.[0]?.text) {
      try {
        return JSON.parse(parsed.content[0].text) as T;
      } catch {
        // Text isn't JSON, return as-is
        return parsed.content[0].text as T;
      }
    }
    
    // Direct result
    return parsed as T;
  }

  /**
   * Call tool directly (embedded mode)
   * Used when curator is invoked from within the MCP server
   */
  private async callEmbeddedTool<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
    // This will be set when the MCP server initializes
    // For now, throw to indicate embedded mode needs setup
    throw new Error(
      `Embedded MCP mode not initialized. Set MCP_EMBEDDED=true and provide tool handler. ` +
      `Tool: ${toolName}`
    );
  }
}

/**
 * Singleton instance
 */
let mcpClient: McpClientImpl | null = null;

/**
 * Get or create MCP client singleton
 */
export function getMcpClient(): McpClientImpl {
  if (!mcpClient) {
    mcpClient = new McpClientImpl();
  }
  return mcpClient;
}