/**
 * Mock for @mcp-docker/next-devtools
 * 
 * TODO: Replace with real implementation when available
 * This mock provides stub implementations for Next.js devtools MCP tools
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any[];

export async function devtools_inspect(..._args: AnyArgs): Promise<{ result: Record<string, unknown> }> {
  return { result: {} };
}

export async function devtools_reload(..._args: AnyArgs): Promise<{ ok: boolean }> {
  return { ok: true };
}

export async function nextjs_runtime(..._args: AnyArgs): Promise<{ 
  status: string;
  version: string;
}> {
  return { 
    status: "running",
    version: "14.0.0"
  };
}