---
name: notion-smithery
description: Connect to Notion via Smithery MCP platform. Handles OAuth flows, workspace search, and CRUD operations through Smithery's managed Notion MCP server.
---

# Notion Smithery Integration

This skill provides guidance for integrating Notion with the Smithery MCP platform, handling OAuth flows, workspace search, and page/database operations.

## When to Use

Use this skill when:
- Setting up Notion MCP server through Smithery
- Searching Notion workspace content
- Creating/updating pages or databases in Notion
- Troubleshooting Notion authentication via Smithery

## Quick Start

```bash
# 1. Add Notion via Smithery
smithery mcp add notion --id notion-memory

# 2. If auth_required, open the authorization URL
# Example: https://api.smithery.ai/connect/{namespace}/notion-memory/auth

# 3. Check status
smithery mcp list | grep notion-memory
# Should show: "status": "connected"

# 4. List available tools
smithery tool list notion-memory

# 5. Search workspace
smithery tool call notion-memory notion-search '{"query": "project", "query_type": "internal", "page_size": 10}'
```

## Available Tools

Once connected, the following tools are available:

| Tool | Purpose |
|------|---------|
| `notion-search` | Semantic search over Notion workspace |
| `notion-fetch` | Retrieve page/database details |
| `notion-create-pages` | Create new pages |
| `notion-update-page` | Update existing pages |
| `notion-move-pages` | Move pages to new parent |
| `notion-duplicate-page` | Duplicate a page |
| `notion-create-database` | Create new databases |
| `notion-update-data-source` | Update database schema |
| `notion-create-comment` | Add comments to pages |
| `notion-get-comments` | Retrieve page comments |

## Usage Examples

### Search Workspace

```bash
smithery tool call notion-memory notion-search \
  '{"query": "quarterly report", "query_type": "internal", "page_size": 5}'
```

### Create a Page

```bash
smithery tool call notion-memory notion-create-pages \
  '{
    "parent": {"page_id": "your-parent-page-id"},
    "pages": [{
      "properties": {"title": "New Page Title"},
      "content": "# Section 1\n\nContent here...",
      "icon": "📝"
    }]
  }'
```

### Fetch Page Details

```bash
smithery tool call notion-memory notion-fetch \
  '{"id": "page-uuid-here"}'
```

## Authentication Flow

1. **Add server**: Creates connection with `auth_required` status
2. **Authorize**: Open the `authorizationUrl` in browser
3. **Complete OAuth**: Sign in with Notion and authorize Smithery
4. **Connected**: Status changes to `connected`

## Token Handling

Smithery manages tokens automatically:
- OAuth tokens (`ntn_`) are handled via GitHub OAuth flow
- No manual token management needed
- Token refresh is automatic

## Troubleshooting

### Status shows `auth_required`

**Solution**: Complete OAuth by opening the authorization URL in browser.

### 401 Unauthorized errors

**Causes**:
1. OAuth not completed
2. Token expired (rare - Smithery auto-refreshes)
3. Workspace permissions changed

**Fix**:
```bash
# Remove and re-add
smithery mcp remove notion-memory
smithery mcp add notion --id notion-memory
# Then complete OAuth again
```

### Can't find pages

**Check**:
1. Verify OAuth granted access to the workspace
2. Check if pages are in a private workspace vs shared workspace
3. Ensure integration has access to specific databases (via "Connections")

## References

- [Smithery Documentation](https://smithery.ai/docs)
- [Notion API Reference](https://developers.notion.com/reference)
