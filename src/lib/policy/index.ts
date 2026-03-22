/**
 * Policy Gateway Module
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 *
 * Public API for the policy gateway system.
 */

export type {
  Role,
  PermissionAction,
  ResourceType,
  RiskLevel,
  PolicyDecision,
  PolicyEffect,
  ConditionOperator,
  PolicyCondition,
  PolicyRule,
  RolePermission,
  Permission,
  PolicySpec,
  ToolContract,
  ToolExecutionRequest,
  ExecutionContext,
  PolicyEvaluationResult,
  ToolExecutionResult,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalResolution,
  GatewayConfig,
  PolicyEngineOptions,
  GatewayStats,
} from "./types";

export {
  PolicyEngine,
  createPolicyEngine,
  validatePolicySpec,
} from "./engine";

export {
  PolicyGateway,
  GatewayError,
  createPolicyGateway,
  wrapWithGateway,
} from "./gateway";

export type {
  ApprovalRouterInterface,
  ToolExecutor,
} from "./gateway";

export {
  ApprovalRouter,
  createApprovalRouter,
  isPendingApproval,
  isResolvedApproval,
  isExpiredApproval,
} from "./approval-router";

export type {
  ApprovalRouterConfig,
  ApprovalEventType,
  ApprovalEvent,
  ApprovalEventListener,
} from "./approval-router";

export {
  loadPolicyFile,
  loadPolicyString,
  PolicyHotReloader,
  createPolicyHotReloader,
  getDefaultPolicyPath,
  loadDefaultPolicy,
} from "./loader";