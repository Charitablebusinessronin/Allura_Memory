/**
 * Policy Gateway Type Definitions
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 */

/**
 * Role definition for RBAC
 */
export type Role = "admin" | "operator" | "agent" | "viewer" | "guest";

/**
 * Permission actions
 */
export type PermissionAction = "execute" | "read" | "write" | "admin";

/**
 * Resource types that can be governed by policy
 */
export type ResourceType =
  | "tool"
  | "database"
  | "api"
  | "file"
  | "network"
  | "system";

/**
 * Risk level classification for tool calls
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * Policy decision result
 */
export type PolicyDecision = "allow" | "deny" | "review";

/**
 * Policy rule effect
 */
export type PolicyEffect = "allow" | "deny";

/**
 * Condition operator types
 */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists"
  | "matches";

/**
 * Policy condition definition
 */
export interface PolicyCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
  description?: string;
}

/**
 * Policy rule definition
 */
export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  effect: PolicyEffect;
  actions: PermissionAction[];
  resources: string[];
  conditions?: PolicyCondition[];
  priority?: number;
  enabled?: boolean;
}

/**
 * Role permission mapping
 */
export interface RolePermission {
  role: Role;
  permissions: Permission[];
}

/**
 * Permission definition
 */
export interface Permission {
  action: PermissionAction;
  resource: string;
  conditions?: PolicyCondition[];
}

/**
 * Policy specification (YAML/JSON format)
 */
export interface PolicySpec {
  version: string;
  name: string;
  description?: string;
  defaultDecision: PolicyDecision;
  roles: RolePermission[];
  rules: PolicyRule[];
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    [key: string]: unknown;
  };
}

/**
 * Tool input contract
 */
export interface ToolContract {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  riskLevel: RiskLevel;
  resourceType: ResourceType;
  requiredPermissions: Permission[];
  sideEffects: boolean;
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  toolName: string;
  input: Record<string, unknown>;
  context: ExecutionContext;
  contract?: ToolContract;
}

/**
 * Execution context for policy evaluation
 */
export interface ExecutionContext {
  groupId: string;
  agentId: string;
  sessionId?: string;
  role: Role;
  permissions?: Permission[];
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  matchedRules: string[];
  deniedRules: string[];
  evaluationTimeMs: number;
  reason?: string;
  conditions?: {
    passed: PolicyCondition[];
    failed: PolicyCondition[];
  };
  requiresApproval?: boolean;
  approvalQueueId?: string;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
  policyResult: PolicyEvaluationResult;
  traceId?: string;
}

/**
 * Approval request for blocked actions
 */
export interface ApprovalRequest {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  context: ExecutionContext;
  riskLevel: RiskLevel;
  reason: string;
  status: ApprovalStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  justification?: string;
}

/**
 * Approval status
 */
export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

/**
 * Approval resolution
 */
export interface ApprovalResolution {
  requestId: string;
  approved: boolean;
  resolvedBy: string;
  justification: string;
  resolvedAt: Date;
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  enabled: boolean;
  defaultDecision: PolicyDecision;
  enableHotReload: boolean;
  policyPath: string;
  enableAudit: boolean;
  approvalTimeoutMs: number;
  maxPendingApprovals: number;
}

/**
 * Policy engine options
 */
export interface PolicyEngineOptions {
  strictMode?: boolean;
  enableCaching?: boolean;
  cacheTtlMs?: number;
  logEvaluations?: boolean;
}

/**
 * Gateway statistics
 */
export interface GatewayStats {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  pendingApprovals: number;
  averageEvaluationTimeMs: number;
  ruleHitRate: Record<string, number>;
}