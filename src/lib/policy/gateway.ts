/**
 * Policy Gateway - Mandatory Tool Call Interceptor
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 *
 * This gateway intercepts ALL side-effecting tool calls and validates them
 * against typed contracts, RBAC, and security policies before execution.
 * Nothing bypasses this gateway.
 */

import type {
  ToolContract,
  ToolExecutionRequest,
  ToolExecutionResult,
  ExecutionContext,
  PolicyEvaluationResult,
  GatewayConfig,
  GatewayStats,
  RiskLevel,
  ApprovalRequest,
} from "./types";
import { PolicyEngine, createPolicyEngine } from "./engine";
import type { PolicySpec } from "./types";

/**
 * Tool executor function type
 */
export type ToolExecutor<TInput = unknown, TOutput = unknown> = (
  input: TInput,
) => Promise<TOutput>;

/**
 * Registered tool definition
 */
interface RegisteredTool {
  contract: ToolContract;
  executor: ToolExecutor;
}

/**
 * Policy Gateway - Mandatory interceptor for all tool calls
 */
export class PolicyGateway {
  private engine: PolicyEngine;
  private tools: Map<string, RegisteredTool> = new Map();
  private config: GatewayConfig;
  private stats: GatewayStats;
  private approvalRouter: ApprovalRouterInterface;

  constructor(
    policy: PolicySpec,
    config: Partial<GatewayConfig> = {},
    approvalRouter: ApprovalRouterInterface,
  ) {
    this.engine = createPolicyEngine(policy, {
      strictMode: true,
      enableCaching: true,
      logEvaluations: config.enableAudit ?? true,
    });

    this.config = {
      enabled: config.enabled ?? true,
      defaultDecision: config.defaultDecision ?? "deny",
      enableHotReload: config.enableHotReload ?? true,
      policyPath: config.policyPath ?? "config/policies",
      enableAudit: config.enableAudit ?? true,
      approvalTimeoutMs: config.approvalTimeoutMs ?? 300000,
      maxPendingApprovals: config.maxPendingApprovals ?? 100,
    };

    this.approvalRouter = approvalRouter;

    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      pendingApprovals: 0,
      averageEvaluationTimeMs: 0,
      ruleHitRate: {},
    };
  }

  /**
   * Register a tool with its contract and executor
   */
  registerTool<TInput = unknown, TOutput = unknown>(
    contract: ToolContract,
    executor: ToolExecutor<TInput, TOutput>,
  ): void {
    if (this.tools.has(contract.name)) {
      throw new Error(`Tool '${contract.name}' is already registered`);
    }

    this.tools.set(contract.name, {
      contract,
      executor: executor as ToolExecutor,
    });
  }

  /**
   * Execute a tool call through the gateway
   * This is the MANDATORY entry point for all tool calls
   */
  async execute<TInput = unknown, TOutput = unknown>(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResult<TOutput>> {
    if (!this.config.enabled) {
      return this.createBlockedResult(
        request,
        "Gateway is disabled",
        0,
      ) as ToolExecutionResult<TOutput>;
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    const tool = this.tools.get(request.toolName);
    if (!tool) {
      return this.createBlockedResult(
        request,
        `Tool '${request.toolName}' is not registered`,
        Date.now() - startTime,
      ) as ToolExecutionResult<TOutput>;
    }

    const contract = tool.contract;
    const validation = this.validateContract(contract, request);

    if (!validation.valid) {
      return this.createBlockedResult(
        request,
        validation.error ?? "Contract validation failed",
        Date.now() - startTime,
      ) as ToolExecutionResult<TOutput>;
    }

    const policyResult = this.engine.evaluate(
      `tool:${request.toolName}`,
      "execute",
      request.context,
    );

    if (policyResult.decision === "deny") {
      this.stats.deniedRequests++;
      return this.createBlockedResult(
        request,
        policyResult.reason ?? "Policy denied execution",
        Date.now() - startTime,
        policyResult,
      ) as ToolExecutionResult<TOutput>;
    }

    if (policyResult.decision === "review") {
      const approvalId = await this.requestApproval(
        request,
        contract.riskLevel,
        policyResult.reason ?? "Requires human review",
      );

      if (!approvalId) {
        this.stats.deniedRequests++;
        return this.createBlockedResult(
          request,
          "Failed to queue for approval",
          Date.now() - startTime,
          policyResult,
        ) as ToolExecutionResult<TOutput>;
      }

      this.stats.pendingApprovals++;

      return {
        success: false,
        error: "Action requires approval",
        executionTimeMs: Date.now() - startTime,
        policyResult: {
          ...policyResult,
          requiresApproval: true,
          approvalQueueId: approvalId,
        },
      } as ToolExecutionResult<TOutput>;
    }

    try {
      const data = (await tool.executor(request.input)) as TOutput;
      this.stats.allowedRequests++;
      this.updateEvaluationStats(policyResult.evaluationTimeMs);

      return {
        success: true,
        data,
        executionTimeMs: Date.now() - startTime,
        policyResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Execution failed",
        executionTimeMs: Date.now() - startTime,
        policyResult,
      };
    }
  }

  /**
   * Validate input against tool contract
   */
  private validateContract(
    contract: ToolContract,
    request: ToolExecutionRequest,
  ): { valid: boolean; error?: string } {
    if (contract.inputSchema && Object.keys(contract.inputSchema).length > 0) {
      const requiredFields = Object.entries(contract.inputSchema)
        .filter(([, schema]) => (schema as { required?: boolean }).required)
        .map(([field]) => field);

      for (const field of requiredFields) {
        if (!(field in request.input)) {
          return {
            valid: false,
            error: `Missing required field: ${field}`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Request approval for a blocked action
   */
  private async requestApproval(
    request: ToolExecutionRequest,
    riskLevel: RiskLevel,
    reason: string,
  ): Promise<string | null> {
    try {
      const approvalId = await this.approvalRouter.queueApproval({
        toolName: request.toolName,
        input: request.input,
        context: request.context,
        riskLevel,
        reason,
      });
      return approvalId;
    } catch {
      return null;
    }
  }

  /**
   * Create a blocked result
   */
  private createBlockedResult(
    request: ToolExecutionRequest,
    error: string,
    executionTimeMs: number,
    policyResult?: PolicyEvaluationResult,
  ): ToolExecutionResult {
    return {
      success: false,
      error,
      executionTimeMs,
      policyResult: policyResult ?? {
        decision: "deny",
        matchedRules: [],
        deniedRules: [],
        evaluationTimeMs: 0,
        reason: error,
      },
    };
  }

  /**
   * Update evaluation time statistics
   */
  private updateEvaluationStats(evaluationTimeMs: number): void {
    const currentAvg = this.stats.averageEvaluationTimeMs;
    const total = this.stats.totalRequests;
    this.stats.averageEvaluationTimeMs =
      (currentAvg * (total - 1) + evaluationTimeMs) / total;
  }

  /**
   * Check if a tool would be allowed without executing it
   */
  checkPermission(request: ToolExecutionRequest): PolicyEvaluationResult {
    return this.engine.evaluate(
      `tool:${request.toolName}`,
      "execute",
      request.context,
    );
  }

  /**
   * Get gateway statistics
   */
  getStats(): GatewayStats {
    return { ...this.stats };
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool contract
   */
  getToolContract(toolName: string): ToolContract | undefined {
    return this.tools.get(toolName)?.contract;
  }

  /**
   * Update policy (hot-reload)
   */
  updatePolicy(policy: PolicySpec): void {
    this.engine.updatePolicy(policy);
  }

  /**
   * Get the policy engine for direct inspection
   */
  getEngine(): PolicyEngine {
    return this.engine;
  }
}

/**
 * Approval Router Interface
 * Implemented by approval-router.ts
 */
export interface ApprovalRouterInterface {
  queueApproval(request: {
    toolName: string;
    input: Record<string, unknown>;
    context: ExecutionContext;
    riskLevel: RiskLevel;
    reason: string;
  }): Promise<string>;
  getPendingApprovals(): ApprovalRequest[];
  resolveApproval(resolution: {
    requestId: string;
    approved: boolean;
    resolvedBy: string;
    justification: string;
  }): Promise<boolean>;
  getApproval(id: string): ApprovalRequest | undefined;
}

/**
 * Create a policy gateway instance
 */
export function createPolicyGateway(
  policy: PolicySpec,
  approvalRouter: ApprovalRouterInterface,
  config?: Partial<GatewayConfig>,
): PolicyGateway {
  return new PolicyGateway(policy, config, approvalRouter);
}

/**
 * Wrap an existing function with gateway enforcement
 * Use this to ensure no tool bypasses the gateway
 */
export function wrapWithGateway<TInput = unknown, TOutput = unknown>(
  gateway: PolicyGateway,
  toolName: string,
  contract: ToolContract,
  executor: ToolExecutor<TInput, TOutput>,
): (input: TInput, context: ExecutionContext) => Promise<TOutput> {
  return async (input: TInput, context: ExecutionContext): Promise<TOutput> => {
    const result = await gateway.execute<TInput, TOutput>({
      toolName,
      input: input as Record<string, unknown>,
      context,
      contract,
    });

    if (!result.success) {
      throw new GatewayError(
        result.error ?? "Gateway blocked execution",
        result.policyResult,
      );
    }

    return result.data as TOutput;
  };
}

/**
 * Gateway Error - thrown when gateway blocks execution
 */
export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly policyResult: PolicyEvaluationResult,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}