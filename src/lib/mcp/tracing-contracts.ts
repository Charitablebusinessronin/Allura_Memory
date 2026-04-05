/**
 * TraceMiddleware Integration Contracts
 * 
 * TypeScript interface definitions for wiring TraceMiddleware
 * into agent execution paths.
 * 
 * @module lib/mcp/tracing-contracts
 * @version 1.0.0
 * @since 2026-04-06
 */

import type { McpToolCaller } from '@/integrations/mcp.client';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Agent Tracing Configuration
 * Per-agent settings for trace behavior
 */
export interface AgentTracingConfig {
  /** Agent identifier (e.g., 'memory-orchestrator') */
  agentId: string;
  
  /** Tenant group (e.g., 'allura-faith-meats') - must use allura-* naming */
  groupId: string;
  
  /** Optional: Workflow this agent belongs to */
  workflowId?: string;
  
  /** Optional: Step within workflow */
  stepId?: string;
  
  /**
   * Flush interval in milliseconds
   * - undefined or 0: immediate logging (default)
   * - > 0: buffered mode with timer flush
   */
  flushIntervalMs?: number;
  
  /**
   * Trace capture mode
   * - 'all': Capture all tool calls (default)
   * - 'errors-only': Only capture failed calls
   * - 'decisions-only': Only capture decision-related tools
   */
  captureMode?: 'all' | 'errors-only' | 'decisions-only';
  
  /**
   * Tools to exclude from tracing
   * Useful for high-volume, low-value tools
   */
  excludedTools?: string[];
  
  /**
   * Whether to continue on trace logging failure
   * Default: true (graceful degradation)
   */
  continueOnTraceFailure?: boolean;
  
  /**
   * Error handling mode
   * @deprecated Use continueOnTraceFailure instead
   */
  errorMode?: TraceErrorMode;
}

/**
 * Trace capture modes
 */
export type CaptureMode = 'all' | 'errors-only' | 'decisions-only';

/**
 * Trace error handling modes
 */
export type TraceErrorMode = 'strict' | 'lenient' | 'silent';

// ============================================================================
// Traced Client Interface
// ============================================================================

/**
 * Trace statistics
 */
export interface TraceStats {
  /** Number of tool calls made in current session */
  toolCallCount: number;
  
  /** Number of traces currently in buffer (buffered mode only) */
  bufferedCount: number;
  
  /** Whether a session is currently active */
  sessionActive: boolean;
  
  /** Agent identifier */
  agentId: string;
  
  /** Group identifier */
  groupId: string;
  
  /** Current workflow ID if any */
  workflowId?: string;
  
  /** Current step ID if any */
  stepId?: string;
}

/**
 * Traced MCP Client Interface
 * Extends McpToolCaller with tracing capabilities
 * 
 * This is the primary interface agents use for MCP operations.
 * All calls are automatically traced with full audit context.
 */
export interface TracedMcpClient extends McpToolCaller {
  /**
   * Start a traced session
   * Logs session_start event and initializes buffering if configured
   * 
   * @param workflowId - Optional workflow ID to associate with session
   * @returns Promise that resolves when session is started
   */
  startSession(workflowId?: string): Promise<void>;
  
  /**
   * End a traced session
   * Flushes remaining buffered traces and logs session_end event
   * 
   * @returns Promise that resolves when session is ended
   */
  endSession(): Promise<void>;
  
  /**
   * Log a decision point
   * Records agent decisions with confidence score for audit trail
   * 
   * @param content - Decision description
   * @param confidence - Confidence score (0.0 to 1.0)
   * @returns Promise that resolves when decision is logged
   */
  logDecision(content: string, confidence: number): Promise<void>;
  
  /**
   * Log a learning moment
   * Captures insights and learnings during agent execution
   * 
   * @param content - Learning description
   * @param confidence - Optional confidence score (0.0 to 1.0, defaults to 1.0)
   * @returns Promise that resolves when learning is logged
   */
  logLearning(content: string, confidence?: number): Promise<void>;
  
  /**
   * Manually flush buffered traces
   * Forces immediate write of any buffered traces to PostgreSQL
   * 
   * @returns Promise that resolves when flush is complete
   */
  flush(): Promise<void>;
  
  /**
   * Clean up resources
   * Flushes remaining traces, stops timers, and releases resources
   * 
   * @returns Promise that resolves when cleanup is complete
   */
  destroy(): Promise<void>;
  
  /**
   * Get current trace statistics
   * Returns current state of tracing for monitoring/debugging
   * 
   * @returns TraceStats object with current metrics
   */
  getStats(): TraceStats;
}

// ============================================================================
// Factory Interface
// ============================================================================

/**
 * Traced MCP Client Factory
 * Creates properly wrapped MCP clients for agents
 * 
 * This is the primary entry point for creating traced clients.
 * All agent code should use this factory rather than directly
 * instantiating TraceMiddleware or EnforcedMcpClient.
 */
export interface TracedMcpClientFactory {
  /**
   * Create a traced MCP client for an agent
   * Creates the full middleware stack: TraceMiddleware → EnforcedMcpClient → McpClientImpl
   * 
   * @param config - Agent tracing configuration
   * @returns TracedMcpClient with full middleware stack
   * @throws GroupIdValidationError if group_id is invalid
   */
  createClient(config: AgentTracingConfig): TracedMcpClient;
  
  /**
   * Create a traced client from existing client
   * Useful for wrapping injected clients or custom implementations
   * 
   * @param innerClient - Inner MCP client to wrap
   * @param config - Agent tracing configuration
   * @returns TracedMcpClient wrapping the provided client
   * @throws GroupIdValidationError if group_id is invalid
   */
  wrapClient(
    innerClient: McpToolCaller,
    config: AgentTracingConfig
  ): TracedMcpClient;
}

/**
 * Factory implementation constructor options
 */
export interface TracedMcpClientFactoryOptions {
  /**
   * Default error handler for all created clients
   */
  defaultErrorHandler?: TraceErrorHandler;
  
  /**
   * Whether to validate group_id at construction time
   * Default: true
   */
  validateGroupId?: boolean;
  
  /**
   * Default base configuration merged with per-client configs
   */
  baseConfig?: Partial<AgentTracingConfig>;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Trace error context
 * Provides context for trace logging failures
 */
export interface TraceErrorContext {
  /** Agent identifier */
  agentId: string;
  
  /** Group identifier */
  groupId: string;
  
  /** Tool name being called */
  toolName: string;
  
  /** Timestamp when error occurred */
  timestamp: Date;
  
  /** Type of trace being logged */
  traceType: 'contribution' | 'decision' | 'learning' | 'error';
  
  /** Payload that was being logged (may be truncated) */
  attemptedPayload: unknown;
  
  /** Duration of tool call in milliseconds */
  durationMs?: number;
  
  /** Original error that occurred */
  originalError?: Error;
}

/**
 * Trace error handler interface
 * Implement custom error handling strategies
 */
export interface TraceErrorHandler {
  /**
   * Handle trace logging failure
   * 
   * @param error - The error that occurred
   * @param context - Context about the failed trace
   * @returns Whether to continue agent operation (true = continue, false = throw)
   */
  handleTraceError(
    error: Error,
    context: TraceErrorContext
  ): Promise<boolean>;
}

/**
 * Trace logging error
 * Thrown when strict mode is enabled and trace logging fails
 */
export class TraceLoggingError extends Error {
  public readonly context: TraceErrorContext;
  
  constructor(
    message: string,
    options: { cause?: Error; context: TraceErrorContext }
  ) {
    super(message, { cause: options.cause });
    this.name = 'TraceLoggingError';
    this.context = options.context;
  }
}

// ============================================================================
// Pre-configured Agent Configurations
// ============================================================================

/**
 * Default tracing configurations per agent type
 * 
 * These can be overridden via environment variables or
 * passed directly to the factory.
 */
export interface AgentTracingDefaults {
  /** Orchestrator: Buffered mode for high-volume coordination */
  'memory-orchestrator': AgentTracingConfig;
  
  /** Architect: Immediate mode for critical decisions */
  'memory-architect': AgentTracingConfig;
  
  /** Builder: Buffered for bulk operations */
  'memory-builder': AgentTracingConfig;
  
  /** Analyst: Immediate for metrics */
  'memory-analyst': AgentTracingConfig;
  
  /** Copywriter: Buffered for content generation */
  'memory-copywriter': AgentTracingConfig;
  
  /** Repo Manager: Buffered for git operations */
  'memory-repo-manager': AgentTracingConfig;
  
  /** Scribe: Immediate for documentation */
  'memory-scribe': AgentTracingConfig;
  
  /** Faith Meats: Errors-only to reduce noise */
  'faith-meats-agent': AgentTracingConfig;
  
  /** Audits: Full audit trail with strict mode */
  'audits-agent': AgentTracingConfig;
  
  /** Generic fallback configuration */
  'default': AgentTracingConfig;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Traced client configuration with validation result
 */
export interface ValidatedTracingConfig {
  /** Original configuration */
  config: AgentTracingConfig;
  
  /** Whether configuration is valid */
  isValid: boolean;
  
  /** Validation errors if any */
  errors: string[];
  
  /** Normalized group_id */
  normalizedGroupId: string;
}

/**
 * Traced client state
 */
export type TracedClientState = 
  | 'initializing'
  | 'ready'
  | 'session-active'
  | 'flushing'
  | 'destroyed'
  | 'error';

/**
 * Traced client event
 */
export interface TracedClientEvent {
  type: 'session-start' | 'session-end' | 'trace-logged' | 'flush-complete' | 'error';
  timestamp: Date;
  payload?: unknown;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a valid AgentTracingConfig
 */
export function isAgentTracingConfig(value: unknown): value is AgentTracingConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const config = value as Partial<AgentTracingConfig>;
  
  return (
    typeof config.agentId === 'string' &&
    config.agentId.length > 0 &&
    typeof config.groupId === 'string' &&
    config.groupId.length > 0
  );
}

/**
 * Check if value implements TracedMcpClient
 */
export function isTracedMcpClient(value: unknown): value is TracedMcpClient {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const client = value as Partial<TracedMcpClient>;
  
  return (
    typeof client.callTool === 'function' &&
    typeof client.startSession === 'function' &&
    typeof client.endSession === 'function' &&
    typeof client.logDecision === 'function' &&
    typeof client.logLearning === 'function'
  );
}
