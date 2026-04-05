// groupIdEnforcer.ts
// Semantic Firewall - Zero-Trust group_id enforcement
// Rejects any request without valid group_id or Agent Identity Card (AIC)

import { validateTenantGroupId } from '../validation/tenant-group-id';
import { GroupIdValidationError } from '../validation/group-id';

export interface RequestLike {
  method: string;
  body: {
    group_id?: string;
    [key: string]: unknown;
  };
  headers?: {
    'x-agent-identity'?: string;
    [key: string]: string | string[] | undefined;
  };
}

export interface ResponseLike {
  status(code: number): ResponseLike;
  json(data: Record<string, unknown>): void;
}

export type NextFunction = () => void;

export interface EnforcerResult {
  allowed: boolean;
  error?: string;
  group_id?: string;
  agent_identity?: string;
}

/**
 * Validate request has required identity credentials
 * - group_id: mandatory on all requests, must be allura-{org} format
 * - Agent Identity Card (AIC): optional but validated if present
 */
export function validateRequestIdentity(req: RequestLike): EnforcerResult {
  const { group_id } = req.body;
  const agentIdentity = req.headers?.['x-agent-identity'];

  // Hard fail: group_id is mandatory for all operations
  if (!group_id) {
    return {
      allowed: false,
      error: 'RK-01: Missing group_id. Every request must include a valid group_id for tenant isolation.',
    };
  }

  // Validate group_id format with allura-{org} enforcement
  try {
    const validatedGroupId = validateTenantGroupId(group_id);
    
    // Validate Agent Identity Card if present
    if (agentIdentity && typeof agentIdentity === 'string') {
      // AIC format: agent-name:version:timestamp:signature
      const aicParts = agentIdentity.split(':');
      if (aicParts.length < 2) {
        return {
          allowed: false,
          error: 'RK-01: Invalid Agent Identity Card format. Expected: agent-name:version:...',
        };
      }
    }

    return {
      allowed: true,
      group_id: validatedGroupId,
      agent_identity: agentIdentity as string | undefined,
    };
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return {
        allowed: false,
        error: `RK-01: ${error.message}`,
      };
    }
    throw error;
  }
}

/**
 * Express-style middleware for group_id enforcement
 * Usage: app.use(groupIdEnforcer);
 */
export function groupIdEnforcer(
  req: RequestLike,
  res: ResponseLike,
  next: NextFunction
): void {
  const result = validateRequestIdentity(req);

  if (!result.allowed) {
    res.status(400).json({ error: result.error });
    return;
  }

  // Attach validated identity to request for downstream use
  (req as unknown as Record<string, unknown>).validatedIdentity = result;

  next();
}

/**
 * MCP Tool wrapper - enforces group_id before tool execution
 * Usage: wrapToolHandler(memorySearchHandler)
 */
export function wrapToolHandler<TArgs extends Record<string, unknown>, TReturn>(
  handler: (args: TArgs) => Promise<TReturn>
): (args: TArgs) => Promise<TReturn> {
  return async (args: TArgs) => {
    const group_id = (args as Record<string, unknown>).group_id as string | undefined;

    if (!group_id) {
      throw new Error('RK-01: Tool invocation rejected: missing group_id parameter');
    }

    try {
      const validatedGroupId = validateTenantGroupId(group_id);
      // Replace with validated group_id
      const validatedArgs = { ...args, group_id: validatedGroupId };
      return handler(validatedArgs as TArgs);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        throw new Error(`RK-01: Tool invocation rejected: ${error.message}`);
      }
      throw error;
    }
  };
}

export default groupIdEnforcer;
