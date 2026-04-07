/**
 * OpenClaw Client
 * Connects Paperclip to OpenClaw Gateway
 */

const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://localhost:3200';

export interface OpenClawTool {
  name: string;
  description: string;
}

export async function listTools(): Promise<OpenClawTool[]> {
  const response = await fetch(`${OPENCLAW_URL}/tools`);
  if (!response.ok) {
    throw new Error(`OpenClaw error: ${response.status}`);
  }
  const data = await response.json();
  return data.tools;
}

export async function executeTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${OPENCLAW_URL}/tools/${toolName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  
  if (!response.ok) {
    throw new Error(`Tool execution failed: ${response.status}`);
  }
  
  return response.json() as Promise<T>;
}

export async function healthCheck(): Promise<{ status: string; port: number }> {
  const response = await fetch(`${OPENCLAW_URL}/health`);
  if (!response.ok) {
    throw new Error('OpenClaw health check failed');
  }
  return response.json();
}
