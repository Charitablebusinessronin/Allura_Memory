/**
 * MCP Library Index
 *
 * Central exports for MCP-related utilities including:
 * - TraceMiddleware: Low-level trace capture
 * - EnforcedMcpClient: group_id enforcement
 * - WrappedMcpClient: Tracing + enforcement combined
 * - Tracing Contracts: Type definitions and interfaces
 *
 * Usage:
 * ```typescript
 * import { WrappedMcpClient, createAgentClient } from '@/lib/mcp';
 *
 * const client = createAgentClient('memory-orchestrator', 'allura-faith-meats');
 * await client.startSession('workflow-123');
 * const result = await client.callTool('notion-create-pages', {...});
 * await client.endSession();
 * ```
 */

// Trace Middleware
export {
  TraceMiddleware,
  type TraceMiddlewareConfig,
} from "./trace-middleware";

// Enforced Client
export {
  EnforcedMcpClient,
  createEnforcedClient,
  GroupIdValidationError,
  type McpOperationResult,
  type CreatePageParams,
  type UpdatePageParams,
  type SearchParams,
  type FetchParams,
} from "./enforced-client";

// Wrapped Client (Tracing + Enforcement)
export {
  WrappedMcpClient,
  TracedToolCall,
  createWrappedClient,
  createAgentClient,
  createUntracedClient,
  type AgentMetadata,
  type TraceCaptureConfig,
  type WrappedClientConfig,
  type TracedResult,
} from "./wrapped-client";

// Tracing Contracts
export type {
  AgentTracingConfig,
  CaptureMode,
  TraceErrorMode,
  TraceStats,
  TracedMcpClient,
  TracedMcpClientFactory,
  TracedMcpClientFactoryOptions,
  TraceErrorContext,
  TraceErrorHandler,
  ValidatedTracingConfig,
  TracedClientState,
  TracedClientEvent,
} from "./tracing-contracts";

export {
  TraceLoggingError,
  isAgentTracingConfig,
  isTracedMcpClient,
} from "./tracing-contracts";
