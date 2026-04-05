# policy

> API documentation for `policy` module.

## Functions

### `createApprovalRouter`

Create an approval router instance

---

### `isPendingApproval`

Check if an approval request is pending

---

### `isResolvedApproval`

Check if an approval request is resolved

---

### `isExpiredApproval`

Check if an approval request has expired

---

### `createPolicyEngine`

Create a policy engine instance

---

### `validatePolicySpec`

Validate a policy specification

---

### `data`

Execute a tool call through the gateway This is the MANDATORY entry point for all tool calls

---

### `createPolicyGateway`

Create a policy gateway instance

---

### `wrapWithGateway`

Wrap an existing function with gateway enforcement Use this to ensure no tool bypasses the gateway

---

### `parseYaml`

Simple YAML parser for policy files This is a minimal implementation - in production, use a proper YAML library

---

### `transformToPolicySpec`

Transform parsed YAML into PolicySpec

---

### `loadPolicyFile`

Load a policy from a YAML file

---

### `loadPolicyString`

Load policy from string content

---

### `createPolicyHotReloader`

Create a hot-reloader instance

---

### `getDefaultPolicyPath`

Get default policy path

---

### `loadDefaultPolicy`

Load the default policy

---

## Classes

### `ApprovalStore`

In-memory storage for approval requests In production, this would be backed by PostgreSQL

---

### `ApprovalRouter`

Approval Router Implementation Queues blocked actions for Mission Control review

---

### `PolicyEngine`

Policy Engine - evaluates actions against policy specifications

---

### `PolicyGateway`

Policy Gateway - Mandatory interceptor for all tool calls

---

### `GatewayError`

Gateway Error - thrown when gateway blocks execution

---

### `PolicyHotReloader`

Policy Hot-Reloader

---

## Interfaces

### `ApprovalRouterConfig`

Approval Router configuration

---

### `ApprovalEvent`

Approval event

---

### `CacheEntry`

Policy evaluation cache entry

---

### `RegisteredTool`

Registered tool definition

---

### `ApprovalRouterInterface`

Approval Router Interface Implemented by approval-router.ts

---

### `PolicyWatcher`

Policy file watcher for hot-reload

---

### `PolicyCondition`

Policy condition definition

---

### `PolicyRule`

Policy rule definition

---

### `RolePermission`

Role permission mapping

---

### `Permission`

Permission definition

---

### `PolicySpec`

Policy specification (YAML/JSON format)

---

### `ToolContract`

Tool input contract

---

### `ToolExecutionRequest`

Tool execution request

---

### `ExecutionContext`

Execution context for policy evaluation

---

### `PolicyEvaluationResult`

Policy evaluation result

---

### `ToolExecutionResult`

Tool execution result

---

### `ApprovalRequest`

Approval request for blocked actions

---

### `ApprovalResolution`

Approval resolution

---

### `GatewayConfig`

Gateway configuration

---

### `PolicyEngineOptions`

Policy engine options

---

### `GatewayStats`

Gateway statistics

---

## Type Definitions

### `ApprovalEventType`

Approval event types

---

### `ApprovalEventListener`

Event listener type

---

### `ToolExecutor`

Tool executor function type

---

### `Role`

Role definition for RBAC

---

### `PermissionAction`

Permission actions

---

### `ResourceType`

Resource types that can be governed by policy

---

### `RiskLevel`

Risk level classification for tool calls

---

### `PolicyDecision`

Policy decision result

---

### `PolicyEffect`

Policy rule effect

---

### `ConditionOperator`

Condition operator types

---

### `ApprovalStatus`

Approval status

---
