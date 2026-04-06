/**
 * Mock for @mcp-docker/playwright
 * 
 * TODO: Replace with real implementation when available
 * This mock provides stub implementations for browser automation MCP tools
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any[];

export async function browser_navigate(..._args: AnyArgs): Promise<{ ok: boolean }> {
  return { ok: true };
}

export async function browser_take_screenshot(..._args: AnyArgs): Promise<{ screenshot: string }> {
  return { screenshot: "base64" };
}

export async function browser_click(..._args: AnyArgs): Promise<{ ok: boolean }> {
  return { ok: true };
}

export async function browser_type(..._args: AnyArgs): Promise<{ ok: boolean }> {
  return { ok: true };
}

export async function browser_wait_for(..._args: AnyArgs): Promise<{ ok: boolean }> {
  return { ok: true };
}

export async function browser_evaluate(..._args: AnyArgs): Promise<{
  itemCount: number;
  hasEmptyState: boolean;
  hasCards: boolean;
  isVertical: boolean;
  isHorizontal: boolean;
}> {
  return {
    itemCount: 0,
    hasEmptyState: false,
    hasCards: false,
    isVertical: false,
    isHorizontal: false,
  };
}

export async function browser_console_messages(..._args: AnyArgs): Promise<string[]> {
  return [];
}