/**
 * Policy File Loader
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 *
 * Loads policy specifications from YAML files with support for hot-reloading.
 */

import type { PolicySpec, Role, PermissionAction, ConditionOperator } from "./types";
import { validatePolicySpec } from "./engine";
import * as fs from "fs";
import * as path from "path";

/**
 * Policy file watcher for hot-reload
 */
interface PolicyWatcher {
  filePath: string;
  callback: (policy: PolicySpec) => void;
  lastModified: number;
  interval?: NodeJS.Timeout;
}

/**
 * Simple YAML parser for policy files
 * This is a minimal implementation - in production, use a proper YAML library
 */
function parseYaml(content: string): unknown {
  const lines = content.split("\n");
  const result: Record<string, unknown> = {};
  let currentSection = "";
  let currentArray: unknown[] | null = null;
  let currentObject: Record<string, unknown> | null = null;
  let indentLevel = 0;
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const indent = line.search(/\S/);
    const content = trimmed.trim();

    if (indent === 0) {
      if (content.includes(":")) {
        const [key, ...valueParts] = content.split(":");
        const keyTrimmed = key.trim();
        const value = valueParts.join(":").trim();

        if (value === "") {
          currentSection = keyTrimmed;
          result[keyTrimmed] = {};
          stack.length = 0;
          stack.push({ obj: result as Record<string, unknown>, indent: 0 });
        } else {
          result[keyTrimmed] = parseValue(value);
        }
      }
    } else {
      handleIndentedLine(
        content,
        indent,
        stack,
        currentSection,
      );
    }
  }

  return result;

  function handleIndentedLine(
    content: string,
    indent: number,
    stack: Array<{ obj: Record<string, unknown>; indent: number }>,
    _section: string,
  ): void {
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.obj ?? result;

    if (content.startsWith("- ")) {
      const value = content.slice(2).trim();
      if (!parent.array) {
        parent.array = [];
      }
      (parent.array as unknown[]).push(parseValue(value));
    } else if (content.includes(":")) {
      const [key, ...valueParts] = content.split(":");
      const keyTrimmed = key.trim();
      const value = valueParts.join(":").trim();

      if (value === "" || value.startsWith("\n")) {
        const newObj: Record<string, unknown> = {};
        parent[keyTrimmed] = newObj;
        stack.push({ obj: newObj, indent });
      } else {
        parent[keyTrimmed] = parseValue(value);
      }
    }
  }

  function parseValue(value: string): unknown {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1);
    }
    if (value.startsWith("[")) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
}

/**
 * Transform parsed YAML into PolicySpec
 */
function transformToPolicySpec(parsed: unknown): PolicySpec {
  const p = parsed as Record<string, unknown>;

  const policy: PolicySpec = {
    version: String(p.version ?? "1.0.0"),
    name: String(p.name ?? "unnamed-policy"),
    description: p.description ? String(p.description) : undefined,
    defaultDecision: parseDefaultDecision(p.defaultDecision),
    roles: parseRoles(p.roles),
    rules: parseRules(p.rules),
    metadata: p.metadata as PolicySpec["metadata"],
  };

  return policy;
}

function parseDefaultDecision(value: unknown): "allow" | "deny" | "review" {
  if (value === "allow" || value === "deny" || value === "review") {
    return value;
  }
  return "deny";
}

function parseRoles(roles: unknown): PolicySpec["roles"] {
  if (!Array.isArray(roles)) return [];

  return roles.map((role: Record<string, unknown>) => ({
    role: String(role.role) as Role,
    permissions: Array.isArray(role.permissions)
      ? role.permissions.map((p: Record<string, unknown>) => ({
          action: String(p.action) as PermissionAction,
          resource: String(p.resource),
          conditions: p.conditions
            ? parseConditions(p.conditions)
            : undefined,
        }))
      : [],
  }));
}

function parseRules(rules: unknown): PolicySpec["rules"] {
  if (!Array.isArray(rules)) return [];

  return rules.map((rule: Record<string, unknown>) => ({
    id: String(rule.id),
    name: String(rule.name),
    description: rule.description ? String(rule.description) : undefined,
    effect: rule.effect === "allow" ? "allow" : "deny",
    actions: Array.isArray(rule.actions)
      ? rule.actions.map((a: string) => String(a) as PermissionAction)
      : [],
    resources: Array.isArray(rule.resources)
      ? rule.resources.map(String)
      : [],
    conditions: rule.conditions
      ? parseConditions(rule.conditions)
      : undefined,
    priority: rule.priority ? Number(rule.priority) : undefined,
    enabled: rule.enabled !== false,
  }));
}

function parseConditions(conditions: unknown): PolicySpec["rules"][0]["conditions"] {
  if (!Array.isArray(conditions)) return [];

  return conditions.map((cond: Record<string, unknown>) => ({
    field: String(cond.field),
    operator: String(cond.operator) as ConditionOperator,
    value: cond.value,
    description: cond.description ? String(cond.description) : undefined,
  }));
}

/**
 * Load a policy from a YAML file
 */
export function loadPolicyFile(filePath: string): PolicySpec {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Policy file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseYaml(content);
  const policy = transformToPolicySpec(parsed);

  const validation = validatePolicySpec(policy);
  if (!validation.valid) {
    throw new Error(
      `Invalid policy specification: ${validation.errors.join(", ")}`,
    );
  }

  return policy;
}

/**
 * Load policy from string content
 */
export function loadPolicyString(content: string): PolicySpec {
  const parsed = parseYaml(content);
  const policy = transformToPolicySpec(parsed);

  const validation = validatePolicySpec(policy);
  if (!validation.valid) {
    throw new Error(
      `Invalid policy specification: ${validation.errors.join(", ")}`,
    );
  }

  return policy;
}

/**
 * Policy Hot-Reloader
 */
export class PolicyHotReloader {
  private watchers: Map<string, PolicyWatcher> = new Map();

  /**
   * Watch a policy file for changes
   */
  watch(
    filePath: string,
    callback: (policy: PolicySpec) => void,
    intervalMs: number = 5000,
  ): () => void {
    const absolutePath = path.resolve(filePath);
    const stat = fs.statSync(absolutePath);
    const lastModified = stat.mtimeMs;

    const watcher: PolicyWatcher = {
      filePath: absolutePath,
      callback,
      lastModified,
    };

    watcher.interval = setInterval(() => {
      try {
        const currentStat = fs.statSync(absolutePath);
        if (currentStat.mtimeMs > watcher.lastModified) {
          watcher.lastModified = currentStat.mtimeMs;
          const policy = loadPolicyFile(absolutePath);
          callback(policy);
        }
      } catch (error) {
        console.error(
          `[PolicyHotReloader] Error reloading policy ${absolutePath}:`,
          error,
        );
      }
    }, intervalMs);

    this.watchers.set(absolutePath, watcher);

    return () => {
      if (watcher.interval) {
        clearInterval(watcher.interval);
      }
      this.watchers.delete(absolutePath);
    };
  }

  /**
   * Stop watching all policy files
   */
  stopAll(): void {
    for (const watcher of this.watchers.values()) {
      if (watcher.interval) {
        clearInterval(watcher.interval);
      }
    }
    this.watchers.clear();
  }
}

/**
 * Create a hot-reloader instance
 */
export function createPolicyHotReloader(): PolicyHotReloader {
  return new PolicyHotReloader();
}

/**
 * Get default policy path
 */
export function getDefaultPolicyPath(): string {
  return path.join(process.cwd(), "config", "policies", "default.yaml");
}

/**
 * Load the default policy
 */
export function loadDefaultPolicy(): PolicySpec {
  const defaultPath = getDefaultPolicyPath();
  if (fs.existsSync(defaultPath)) {
    return loadPolicyFile(defaultPath);
  }

  return {
    version: "1.0.0",
    name: "deny-all",
    description: "Default deny-all policy",
    defaultDecision: "deny",
    roles: [],
    rules: [],
  };
}