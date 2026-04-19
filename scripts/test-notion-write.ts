#!/usr/bin/env bun
/**
 * Test Notion write via MCP tools.
 * Notion access is provided by mcp__claude_ai_Notion__* — no API key needed.
 *
 * Usage: invoke mcp__claude_ai_Notion__notion-create-pages directly from an
 * agent context, or use the Allura MCP server's memory_propose_insight tool
 * which routes through the curator pipeline.
 *
 * This script is intentionally a no-op placeholder — direct REST calls to
 * api.notion.com with a bearer token are deprecated in this codebase.
 */

const dbId = process.env.NOTION_INSIGHTS_DB_ID;

console.log('Notion write test: use mcp__claude_ai_Notion__notion-create-pages via MCP.');
console.log('Target database ID (from env):', dbId ?? '(not set — NOTION_INSIGHTS_DB_ID)');
console.log('No API key required. Remote MCP server handles auth.');
