/**
 * Wrapped MCP Client - Auto-tracing MCP Tool Wrapper
 *
 * Wraps MCP_DOCKER tools with automatic TraceMiddleware injection.
 * Provides seamless trace capture for all agent tool calls with:
 * - Automatic group_id injection from agent metadata
 * - Both immediate (default) and buffered tracing modes
 * - Fallback behavior when tracing fails (doesn't break agent execution)
 * - Integration with EnforcedMcpClient for tenant isolation
 *
 * Architecture:
 * - WrappedMcpClient wraps MCP_DOCKER tools with tracing
 * - TracedToolCall wraps individual tool calls
 * - Supports agent metadata injection for group_id, agent_id
 * - Server-side only (throws if used client-side)
 */

if (typeof window !== "undefined") {
  throw new Error("WrappedMcpClient can only be used server-side");
}

import { TraceMiddleware, type TraceMiddlewareConfig } from "./trace-middleware";
import { EnforcedMcpClient, type McpOperationResult } from "./enforced-client";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import type { McpToolCaller } from "@/integrations/mcp.client";
import { BudgetEnforcer } from "@/lib/budget/enforcer";
import type { SessionId } from "@/lib/budget/types";
import {
  MIN_TURN_TOKENS,
  checkBudgetBeforeCall,
  updateBudgetAfterCall,
  handleBudgetExceeded,
  createSessionId,
  BudgetExceededError,
  type BudgetCheckResult,
  type ToolCallMetadata,
} from "@/lib/budget/middleware-integration";

/**
 * Agent metadata for trace attribution
 */
export interface AgentMetadata {
  /** Required: Agent identifier (e.g., 'memory-orchestrator') */
  agentId: string;
  /** Required: Tenant group_id (e.g., 'allura-faith-meats') */
  groupId: string;
  /** Optional: Workflow this agent is executing */
  workflowId?: string;
  /** Optional: Step within workflow */
  stepId?: string;
}

/**
 * Configuration for trace capture behavior
 */
export interface TraceCaptureConfig {
  /**
   * Buffer interval in milliseconds.
   * - undefined or 0: immediate mode (traces logged synchronously)
   * - > 0: buffered mode (traces batched and flushed on interval)
   * Default: 0 (immediate mode)
   */
  flushIntervalMs?: number;
  /**
   * Whether to capture input/output payloads in traces.
   * Default: true
   */
  capturePayloads?: boolean;
  /**
   * Whether tracing is enabled at all.
   * Default: true
   */
  enabled?: boolean;
  /**
   * Fallback behavior when trace logging fails.
   * - 'ignore': Silently ignore trace failures (default)
   * - 'warn': Log warning but don't throw
   * - 'error': Throw error (breaks execution)
   * Default: 'ignore'
   */
  onTraceFailure?: "ignore" | "warn" | "error";
}

/**
 * Budget configuration for MCP client
 */
export interface McpBudgetConfig {
  /** Budget enforcer instance (required for budget checking) */
  enforcer?: BudgetEnforcer;
  /** Session ID for budget tracking */
  sessionId?: SessionId;
  /** Minimum tokens required per turn (default: MIN_TURN_TOKENS) */
  minTurnTokens?: number;
  /** Enable budget checking (default: true if enforcer provided) */
  enabled?: boolean;
  /** Track budget after calls */
  trackAfterCalls?: boolean;
  /** Custom budget exceeded handler */
  onBudgetExceeded?: (result: BudgetCheckResult) => void | Promise<void>;
}

/**
 * Complete wrapped client configuration
 */
export interface WrappedClientConfig {
  /** Agent metadata for trace attribution */
  agentMetadata: AgentMetadata;
  /** Trace capture configuration */
  traceConfig?: TraceCaptureConfig;
  /** Optional: Pre-configured inner client (defaults to EnforcedMcpClient) */
  innerClient?: McpToolCaller;
  /** Optional: Budget configuration for pre-turn checks */
  budgetConfig?: McpBudgetConfig;
}

/**
 * Result from a traced tool call
 */
export interface TracedResult<T> {
  /** The actual tool result */
  data: T;
  /** Whether the call was successfully traced */
  traced: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Any trace-related error (not tool error) */
  traceError?: string;
}

/**
 * Traced Tool Call - Wraps a single tool invocation
 *
 * Provides fine-grained control over tracing for individual calls,
 * allowing per-call overrides of trace configuration.
 */
export class TracedToolCall {
  private readonly _middleware: TraceMiddleware | null;
  private readonly _toolName: string;
  private readonly _fallbackBehavior: NonNullable<TraceCaptureConfig["onTraceFailure"]>;

  constructor(
    toolName: string,
    middleware: TraceMiddleware | null,
    fallbackBehavior: NonNullable<TraceCaptureConfig["onTraceFailure"]> = "ignore"
  ) {
    this._toolName = toolName;
    this._middleware = middleware;
    this._fallbackBehavior = fallbackBehavior;
  }

  /**
   * Execute the tool call with tracing
   */
  async execute<T>(
    args: Record<string, unknown>,
    innerClient: McpToolCaller
  ): Promise<TracedResult<T>> {
    const startTime = performance.now();

    // If no middleware (tracing disabled), just call directly
    if (!this._middleware) {
      const result = await innerClient.callTool<T>(this._toolName, args);
      return {
        data: result,
        traced: false,
        durationMs: performance.now() - startTime,
      };
    }

    try {
      // Use middleware which handles tracing internally
      const result = await this._middleware.callTool<T>(this._toolName, args);
      const durationMs = performance.now() - startTime;

      return {
        data: result,
        traced: true,
        durationMs,
      };
    } catch (error: unknown) {
      const durationMs = performance.now() - startTime;

      // Check if this is a trace logging error or actual tool error
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Re-throw actual tool errors
      if (this._isToolError(error)) {
        throw error;
      }

      // Handle trace failure according to fallback behavior
      return this._handleTraceFailure<T>(errorMessage, args, innerClient, durationMs);
    }
  }

  /**
   * Determine if error is from the tool itself vs trace logging
   */
  private _isToolError(error: unknown): boolean {
    // Tool errors typically have specific patterns
    if (error instanceof Error) {
      // These are trace/logging related errors
      if (
        error.message.includes("logTrace") ||
        error.message.includes("trace-logger") ||
        error.message.includes("PostgreSQL") ||
        error.message.includes("database") ||
        error.name === "TraceValidationError"
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Handle trace failure according to configured behavior
   */
  private async _handleTraceFailure<T>(
    errorMessage: string,
    args: Record<string, unknown>,
    innerClient: McpToolCaller,
    durationMs: number
  ): Promise<TracedResult<T>> {
    switch (this._fallbackBehavior) {
      case "error":
        throw new Error(`Trace logging failed: ${errorMessage}`);

      case "warn":
        console.warn(`[TracedToolCall] Trace logging failed for '${this._toolName}':`, errorMessage);
        break;

      case "ignore":
      default:
        // Silently continue
        break;
    }

    // Fall back to calling tool without tracing
    try {
      const result = await innerClient.callTool<T>(this._toolName, args);
      return {
        data: result,
        traced: false,
        durationMs,
        traceError: errorMessage,
      };
    } catch (toolError) {
      // If the tool itself fails, propagate that error
      throw toolError;
    }
  }
}

/**
 * Wrapped MCP Client - Auto-tracing MCP Tool Wrapper
 *
 * Primary interface for agents to call MCP tools with automatic tracing.
 * Combines EnforcedMcpClient (group_id enforcement) with TraceMiddleware
 * (execution tracing).
 *
 * Usage:
 * ```typescript
 * const client = new WrappedMcpClient({
 *   agentMetadata: {
 *     agentId: 'memory-orchestrator',
 *     groupId: 'allura-faith-meats',
 *     workflowId: 'workflow-123'
 *   },
 *   traceConfig: {
 *     flushIntervalMs: 5000,  // buffered mode
 *     onTraceFailure: 'warn'
 *   }
 * });
 *
 * // All calls are automatically traced
 * const result = await client.callTool('notion-create-pages', {
 *   parent: { database_id: 'abc' },
 *   pages: [{ properties: { Name: 'Test' } }]
 * });
 * ```
 */
export class WrappedMcpClient implements McpToolCaller {
  private readonly _agentMetadata: AgentMetadata;
  private readonly _traceConfig: Required<TraceCaptureConfig>;
  private readonly _innerClient: McpToolCaller;
  private readonly _middleware: TraceMiddleware | null;
  private readonly _enforcedClient: EnforcedMcpClient | null = null;
  private _sessionActive = false;

  // Budget checking properties
  private readonly _budgetEnforcer: BudgetEnforcer | null = null;
  private readonly _sessionId: SessionId | null = null;
  private readonly _minTurnTokens: number = MIN_TURN_TOKENS;
  private readonly _budgetEnabled: boolean = false;
  private readonly _trackAfterCalls: boolean = true;
  private readonly _onBudgetExceeded?: (result: BudgetCheckResult) => void | Promise<void>;

  constructor(config: WrappedClientConfig) {
    // Validate agent metadata
    if (!config.agentMetadata) {
      throw new Error("agentMetadata is required");
    }

    const { agentId, groupId } = config.agentMetadata;

    if (!agentId || agentId.trim().length === 0) {
      throw new Error("agentMetadata.agentId is required");
    }

    // Validate group_id (will throw if invalid)
    const validatedGroupId = validateGroupId(groupId);

    this._agentMetadata = {
      ...config.agentMetadata,
      groupId: validatedGroupId,
    };

    // Set defaults for trace config
    this._traceConfig = {
      flushIntervalMs: 0,
      capturePayloads: true,
      enabled: true,
      onTraceFailure: "ignore",
      ...config.traceConfig,
    };

    // Create or use provided inner client
    // Use EnforcedMcpClient by default to ensure group_id injection
    if (config.innerClient) {
      this._innerClient = config.innerClient;
    } else {
      const { McpClientImpl } = require("@/integrations/mcp.client");
      const baseClient = new McpClientImpl();
      this._enforcedClient = new EnforcedMcpClient(validatedGroupId, baseClient);
      this._innerClient = this._enforcedClient;
    }

    // Initialize middleware if tracing enabled
    if (this._traceConfig.enabled) {
      const middlewareConfig: TraceMiddlewareConfig = {
        agentId: this._agentMetadata.agentId,
        groupId: this._agentMetadata.groupId,
        innerClient: this._innerClient,
        flushIntervalMs: this._traceConfig.flushIntervalMs,
        workflowId: this._agentMetadata.workflowId,
        stepId: this._agentMetadata.stepId,
      };

      this._middleware = new TraceMiddleware(middlewareConfig);
    } else {
      this._middleware = null;
    }

    // Initialize budget checking if config provided
    if (config.budgetConfig?.enforcer) {
      const budgetConfig = config.budgetConfig;
      const sessionId = budgetConfig.sessionId ?? createSessionId(
        this._agentMetadata.groupId,
        this._agentMetadata.agentId,
        `mcp-session-${Date.now()}`
      );
      const minTurnTokens = budgetConfig.minTurnTokens ?? MIN_TURN_TOKENS;
      const budgetEnabled = budgetConfig.enabled !== false;
      const trackAfterCalls = budgetConfig.trackAfterCalls !== false;

      // Use Object.assign to set readonly properties
      Object.assign(this, {
        _budgetEnforcer: budgetConfig.enforcer,
        _sessionId: sessionId,
        _minTurnTokens: minTurnTokens,
        _budgetEnabled: budgetEnabled,
        _trackAfterCalls: trackAfterCalls,
        _onBudgetExceeded: budgetConfig.onBudgetExceeded,
      });

      // Start budget session if budget tracking enabled
      if (budgetConfig.enforcer) {
        budgetConfig.enforcer.startSession(sessionId);
      }
    }
  }

  /**
   * Call an MCP tool with automatic tracing and budget checking
   *
   * This is the primary method for agents to invoke tools.
   * Traces are automatically captured according to traceConfig.
   * Budget checks are performed before every call if budgetConfig provided.
   */
  async callTool<T = unknown>(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<T> {
    // Pre-turn budget check (if budget enabled)
    if (this._budgetEnabled && this._budgetEnforcer && this._sessionId) {
      const budgetCheck = checkBudgetBeforeCall(
        this._budgetEnforcer,
        this._sessionId,
        this._minTurnTokens
      );

      if (!budgetCheck.allowed) {
        // Handle budget exceeded
        if (budgetCheck.haltReason) {
          handleBudgetExceeded(this._sessionId, budgetCheck.haltReason, {
            onNotify: this._onBudgetExceeded
              ? (msg) => {
                  void this._onBudgetExceeded!(budgetCheck);
                }
              : undefined,
          });
        }

        throw new BudgetExceededError(
          this._sessionId,
          budgetCheck.haltReason ?? { type: "token_limit", consumed: 0, limit: 0 },
          budgetCheck.remainingTokens,
          budgetCheck.reason
        );
      }
    }

    const tracedCall = new TracedToolCall(
      toolName,
      this._middleware,
      this._traceConfig.onTraceFailure
    );

    const startTime = performance.now();
    let success = false;

    try {
      const result = await tracedCall.execute<T>(args, this._innerClient);
      success = true;
      return result.data;
    } finally {
      // Update budget after call (if budget tracking enabled)
      if (this._budgetEnabled && this._trackAfterCalls && this._budgetEnforcer && this._sessionId) {
        const durationMs = performance.now() - startTime;
        updateBudgetAfterCall(this._budgetEnforcer, this._sessionId, {
          toolName,
          durationMs,
          success,
        });
      }
    }
  }

  /**
   * Start a traced session
   *
   * Should be called at the beginning of agent execution.
   * Logs session_start event and initializes buffering if configured.
   */
  async startSession(workflowId?: string): Promise<void> {
    if (this._sessionActive) {
      console.warn("[WrappedMcpClient] Session already active, ignoring startSession()");
      return;
    }

    const effectiveWorkflowId = workflowId ?? this._agentMetadata.workflowId;

    if (this._middleware) {
      await this._middleware.startSession(effectiveWorkflowId);
    }

    this._sessionActive = true;
  }

  /**
   * End the traced session
   *
   * Should be called at the end of agent execution.
   * Flushes any buffered traces and logs session_end event.
   * Also ends budget session if budget tracking is enabled.
   */
  async endSession(): Promise<void> {
    if (!this._sessionActive) {
      console.warn("[WrappedMcpClient] No active session, ignoring endSession()");
      return;
    }

    if (this._middleware) {
      await this._middleware.endSession();
    }

    // End budget session if budget tracking enabled
    if (this._budgetEnforcer && this._sessionId) {
      this._budgetEnforcer.endSession(this._sessionId);
    }

    this._sessionActive = false;
  }

  /**
   * Flush any buffered traces immediately
   *
   * Useful for ensuring traces are persisted before
   * critical checkpoints or when shutting down.
   */
  async flush(): Promise<void> {
    if (this._middleware) {
      await this._middleware.flush();
    }
  }

  /**
   * Log a decision point
   *
   * Records agent decisions with confidence scoring.
   */
  async logDecision(content: string, confidence: number): Promise<void> {
    if (this._middleware) {
      await this._middleware.logDecision(content, confidence);
    }
  }

  /**
   * Log a learning moment
   *
   * Records insights and patterns discovered during execution.
   */
  async logLearning(content: string, confidence?: number): Promise<void> {
    if (this._middleware) {
      await this._middleware.logLearning(content, confidence);
    }
  }

  /**
   * Get the validated group_id
   */
  getGroupId(): string {
    return this._agentMetadata.groupId;
  }

  /**
   * Get the agent_id
   */
  getAgentId(): string {
    return this._agentMetadata.agentId;
  }

  /**
   * Get current workflow_id
   */
  getWorkflowId(): string | undefined {
    return this._agentMetadata.workflowId;
  }

  /**
   * Get trace statistics
   */
  getStats(): {
    toolCallCount: number;
    bufferedCount: number;
    sessionActive: boolean;
    agentId: string;
    groupId: string;
    workflowId?: string;
    stepId?: string;
  } {
    return {
      toolCallCount: 0, // Would need to track in implementation
      bufferedCount: 0, // Would need to expose from middleware
      sessionActive: this._sessionActive,
      agentId: this._agentMetadata.agentId,
      groupId: this._agentMetadata.groupId,
      workflowId: this._agentMetadata.workflowId,
      stepId: this._agentMetadata.stepId,
    };
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this._sessionActive;
  }

  /**
   * Check if tracing is enabled
   */
  isTracingEnabled(): boolean {
    return this._traceConfig.enabled;
  }

  /**
   * Get budget status
   * Returns null if budget tracking is not enabled
   */
  getBudgetStatus(): ReturnType<BudgetEnforcer["getStatus"]> | null {
    if (this._budgetEnforcer && this._sessionId) {
      return this._budgetEnforcer.getStatus(this._sessionId);
    }
    return null;
  }

  /**
   * Get remaining budget
   * Returns null if budget tracking is not enabled
   */
  getRemainingBudget(): ReturnType<BudgetEnforcer["getRemainingBudget"]> | null {
    if (this._budgetEnforcer && this._sessionId) {
      return this._budgetEnforcer.getRemainingBudget(this._sessionId);
    }
    return null;
  }

  /**
   * Check if budget checking is enabled
   */
  isBudgetEnabled(): boolean {
    return this._budgetEnabled;
  }

  /**
   * Get current session ID for budget tracking
   */
  getSessionId(): SessionId | null {
    return this._sessionId;
  }

  /**
   * Destroy the client and cleanup resources
   *
   * Flushes remaining traces and clears timers.
   * Also ends budget session if budget tracking is enabled.
   */
  async destroy(): Promise<void> {
    if (this._middleware) {
      await this._middleware.destroy();
    }

    // End budget session if budget tracking enabled
    if (this._budgetEnforcer && this._sessionId) {
      this._budgetEnforcer.endSession(this._sessionId);
    }

    this._sessionActive = false;
  }

  /**
   * Create a typed convenience method for Notion page creation
   */
  async createPage(
    params: Parameters<EnforcedMcpClient["createPage"]>[0]
  ): Promise<McpOperationResult<unknown>> {
    if (this._enforcedClient) {
      return this._enforcedClient.createPage(params);
    }

    // Fallback: use callTool directly
    try {
      const result = await this.callTool("notion-create-pages", params as unknown as Record<string, unknown>);
      return {
        success: true,
        data: result,
        group_id: this._agentMetadata.groupId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        group_id: this._agentMetadata.groupId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create a typed convenience method for Notion page updates
   */
  async updatePage(
    params: Parameters<EnforcedMcpClient["updatePage"]>[0]
  ): Promise<McpOperationResult<unknown>> {
    if (this._enforcedClient) {
      return this._enforcedClient.updatePage(params);
    }

    try {
      const result = await this.callTool("notion-update-page", params as unknown as Record<string, unknown>);
      return {
        success: true,
        data: result,
        group_id: this._agentMetadata.groupId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        group_id: this._agentMetadata.groupId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create a typed convenience method for Notion search
   */
  async search(
    params: Parameters<EnforcedMcpClient["search"]>[0]
  ): Promise<McpOperationResult<unknown>> {
    if (this._enforcedClient) {
      return this._enforcedClient.search(params);
    }

    try {
      const result = await this.callTool("notion-search", params as unknown as Record<string, unknown>);
      return {
        success: true,
        data: result,
        group_id: this._agentMetadata.groupId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        group_id: this._agentMetadata.groupId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create a typed convenience method for Notion fetch
   */
  async fetch(
    params: Parameters<EnforcedMcpClient["fetch"]>[0]
  ): Promise<McpOperationResult<unknown>> {
    if (this._enforcedClient) {
      return this._enforcedClient.fetch(params);
    }

    try {
      const result = await this.callTool("notion-fetch", params as unknown as Record<string, unknown>);
      return {
        success: true,
        data: result,
        group_id: this._agentMetadata.groupId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        group_id: this._agentMetadata.groupId,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

/**
 * Factory function to create a wrapped MCP client
 *
 * @param config - Client configuration
 * @returns WrappedMcpClient instance
 * @throws Error if agentMetadata is invalid
 *
 * Example:
 * ```typescript
 * const client = createWrappedClient({
 *   agentMetadata: {
 *     agentId: 'memory-orchestrator',
 *     groupId: 'allura-faith-meats'
 *   }
 * });
 *
 * await client.startSession('workflow-123');
 * const result = await client.callTool('notion-create-pages', {...});
 * await client.endSession();
 * ```
 */
export function createWrappedClient(config: WrappedClientConfig): WrappedMcpClient {
  return new WrappedMcpClient(config);
}

/**
 * Factory function for common agent configurations
 *
 * Provides sensible defaults for different agent types.
 */
export function createAgentClient(
  agentId: string,
  groupId: string,
  options?: {
    workflowId?: string;
    buffered?: boolean;
    onTraceFailure?: TraceCaptureConfig["onTraceFailure"];
  }
): WrappedMcpClient {
  return new WrappedMcpClient({
    agentMetadata: {
      agentId,
      groupId,
      workflowId: options?.workflowId,
    },
    traceConfig: {
      flushIntervalMs: options?.buffered ? 5000 : 0,
      enabled: true,
      onTraceFailure: options?.onTraceFailure ?? "ignore",
    },
  });
}

/**
 * Create a client with tracing disabled
 *
 * Useful for testing or when trace overhead must be avoided.
 */
export function createUntracedClient(
  agentId: string,
  groupId: string,
  options?: { workflowId?: string }
): WrappedMcpClient {
  return new WrappedMcpClient({
    agentMetadata: {
      agentId,
      groupId,
      workflowId: options?.workflowId,
    },
    traceConfig: {
      enabled: false,
    },
  });
}

// Re-export types for consumers
export { GroupIdValidationError };
export type { McpOperationResult };
export { MIN_TURN_TOKENS, BudgetExceededError } from "@/lib/budget/middleware-integration";
export type { BudgetCheckResult, ToolCallMetadata, BudgetIntegrationConfig, BudgetExceededHandlerResult } from "@/lib/budget/middleware-integration";
