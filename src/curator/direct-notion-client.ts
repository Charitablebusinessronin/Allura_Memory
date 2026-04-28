/**
 * Direct Notion API client — implements NotionMCPClient interface
 * without requiring MCP Docker delegation.
 *
 * This replaces the MCP-based Notion page creation with direct
 * HTTP calls to the Notion API, allowing the sync worker to
 * run autonomously as a cron job.
 *
 * RK-16 Fix: Worker now creates Notion pages directly instead of
 * preparing data and expecting an MCP agent to execute.
 */
import type { NotionMCPClient } from "./notion-bridge"

const NOTION_API_BASE = "https://api.notion.com/v1"
const NOTION_VERSION = "2022-06-28"

function getApiKey(): string {
  const key = process.env.NOTION_API_KEY
  if (!key) {
    throw new Error(
      "NOTION_API_KEY is required for direct Notion API calls. " +
      "Set it in .env or as an environment variable."
    )
  }
  return key
}

async function notionFetch<T>(path: string, init: RequestInit): Promise<T> {
  const key = getApiKey()
  const url = `${NOTION_API_BASE}${path}`

  const response = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "unknown error")
    throw new Error(
      `Notion API ${response.status} on ${path}: ${body.slice(0, 500)}`
    )
  }

  return response.json() as Promise<T>
}

// ─── Notion API Response Types ────────────────────────────────

interface NotionPageResponse {
  id: string
  url: string
  public_url?: string
  object: string
  properties: Record<string, unknown>
}

interface NotionError {
  object: "error"
  status: number
  message: string
  code: string
}

// ─── Property Formatting ──────────────────────────────────────

/**
 * Convert flat { key: value } properties to Notion API format.
 * Notion requires specific property type structures:
 *   Title → { title: [{ text: { content } }] }
 *   Select → { select: { name } }
 *   Date → { date: { start } }
 *   Checkbox → { checkbox: true/false }
 *   Rich text → { rich_text: [{ text: { content } }] }
 *   Number → { number: value }
 */
function formatNotionProperties(
  flat: Record<string, string | number>
): Record<string, unknown> {
  const formatted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(flat)) {
    // Title property
    if (key === "Title") {
      formatted[key] = {
        title: [{ text: { content: String(value) } }],
      }
      continue
    }

    // Select properties
    if (key === "Status" || key === "Type") {
      formatted[key] = { select: { name: String(value) } }
      continue
    }

    // Date properties (format: "date:PropName:start")
    if (key.startsWith("date:")) {
      const parts = key.split(":")
      const propName = parts[1]
      const subField = parts[2] // "start" or "end"

      if (!formatted[propName]) {
        formatted[propName] = { date: {} }
      }
      const dateObj = (formatted[propName] as { date: Record<string, string> }).date
      dateObj[subField] = String(value)
      continue
    }

    // Checkbox properties
    if (value === "__YES__" || value === "__NO__") {
      formatted[key] = { checkbox: value === "__YES__" }
      continue
    }

    // Number properties
    if (typeof value === "number") {
      formatted[key] = { number: value }
      continue
    }

    // Default: rich text
    formatted[key] = {
      rich_text: [{ text: { content: String(value) } }],
    }
  }

  return formatted
}

// ─── Direct Notion API Client ─────────────────────────────────

/**
 * Direct Notion API client that implements NotionMCPClient.
 * Uses NOTION_API_KEY for authentication — no MCP required.
 */
export class DirectNotionClient implements NotionMCPClient {
  private readonly dataMapping: {
    parentData_source_id: string
  }

  constructor(private readonly dataSourceId?: string) {
    // RK-16 Fix: Use actual Notion database_id, not data_source_id
    // data_source_id is a collection:// concept; Notion API needs database_id
    this.dataMapping = {
      parentData_source_id: dataSourceId ?? "08d2e672-2a73-45b0-a31d-b4a7be551e16",
    }
  }

  async createPages(params: {
    parent: { data_source_id: string }
    pages: Array<{
      properties: Record<string, string | number>
      content?: string
    }>
  }): Promise<{ pageId: string; pageUrl: string }[]> {
    const results: { pageId: string; pageUrl: string }[] = []

    for (const page of params.pages) {
      const notionProperties = formatNotionProperties(page.properties)

      // Build the Notion API request body
      const body: Record<string, unknown> = {
        parent: { database_id: params.parent.data_source_id },
        properties: notionProperties,
      }

      // Add page content as children blocks if provided
      if (page.content) {
        body.children = [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ text: { content: page.content.slice(0, 2000) } }],
            },
          },
        ]
      }

      const response = await notionFetch<NotionPageResponse>(
        "/pages",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      )

      results.push({
        pageId: response.id,
        pageUrl: response.url,
      })
    }

    return results
  }

  async updatePage(params: {
    page_id: string
    command: "update_properties" | "update_content"
    properties: Record<string, string | number>
    content_updates?: Array<{ old_str: string; new_str: string }>
  }): Promise<{ success: boolean }> {
    const notionProperties = formatNotionProperties(params.properties)

    await notionFetch<NotionPageResponse>(
      `/pages/${params.page_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ properties: notionProperties }),
      }
    )

    return { success: true }
  }
}

// ─── Factory ──────────────────────────────────────────────────

/**
 * Create a Direct Notion API client.
 * Requires NOTION_API_KEY environment variable.
 */
export function createDirectNotionClient(dataSourceId?: string): DirectNotionClient {
  // Validate API key at construction time
  getApiKey()
  return new DirectNotionClient(dataSourceId)
}