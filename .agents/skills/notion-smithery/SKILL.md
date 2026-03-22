---
name: notion-smithery
description: Connect to and interact with Notion workspaces through Smithery MCP. Use when the user wants to search Notion, create/update pages, manage databases, add comments, or integrate Notion with AI workflows. Triggers on mentions of "Notion", "search Notion", "create Notion page", "update Notion", "Notion database", or working with Notion content.
---

# Notion Smithery

## Overview

This skill enables AI agents to connect to and interact with Notion workspaces through the Smithery MCP (Model Context Protocol) server. It provides full CRUD operations on pages, databases, and comments, as well as semantic search across the entire workspace and connected sources.

## When to Use This Skill

Use this skill when the user requests:
- Searching Notion workspace for pages, databases, or users
- Creating new pages or databases in Notion
- Updating existing page content or properties
- Managing database schemas and data sources
- Adding or retrieving comments on Notion pages
- Moving or duplicating pages

## Quick Start

### Connection Status

Check if Notion is connected:

```bash
smithery mcp list
```

If `notion` is not in the list, add it:

```bash
smithery mcp add https://server.smithery.ai/notion --id notion
```

### List Available Tools

```bash
smithery tool list notion
```

### Check Authentication

If a tool call returns `auth_required` status, the user must authenticate:

```bash
smithery mcp list
# Look for "auth_url" in the response
# Tell user to open the auth_url in browser, then retry
```

## Core Workflows

### 1. Search Notion

Search across the workspace and connected sources (Slack, Google Drive, GitHub, Jira, etc.):

```bash
smithery tool call notion notion-search '{
  "query": "quarterly revenue report",
  "query_type": "internal"
}'
```

**Parameters:**
- `query` (required): Semantic search query
- `query_type`: `"internal"` for content search, `"user"` for user search
- `page_size`: Max results (1-25, default 10)
- `filters`: Optional date range and creator filters
- `data_source_url`: Search within a specific data source
- `teamspace_id`: Restrict to a specific teamspace

**Examples:**

```bash
# Search with date filter
smithery tool call notion notion-search '{
  "query": "project updates",
  "query_type": "internal",
  "filters": {
    "created_date_range": {
      "start_date": "2024-01-01",
      "end_date": "2024-12-31"
    }
  }
}'

# Search within a database (use collection:// URL from fetch)
smithery tool call notion notion-search '{
  "query": "design review",
  "data_source_url": "collection://f336d0bc-b841-465b-8045-024475c079dd"
}'
```

### 2. Fetch Page/Database Details

Retrieve full content of a page, database, or data source:

```bash
smithery tool call notion notion-fetch '{
  "id": "page-uuid-or-url"
}'
```

**Parameters:**
- `id` (required): Page URL, database URL, UUID, or `collection://` URL
- `include_discussions`: Include comment markers (default: false)

**ID Formats Accepted:**
- Full Notion URL: `https://notion.so/workspace/Page-Title-1234567890`
- Notion Site URL: `https://myspace.notion.site/Page-Title-abc123def456`
- Raw UUID: `12345678-90ab-cdef-1234-567890abcdef`
- Data source URL: `collection://12345678-90ab-cdef-1234-567890abcdef`

### 3. Create Pages

Create one or more pages with properties and content:

```bash
# Create a standalone page
smithery tool call notion notion-create-pages '{
  "pages": [
    {
      "properties": {"title": "My Page"},
      "content": "# Section 1\nSection 1 content",
      "icon": "🚀",
      "cover": "https://example.com/cover.jpg"
    }
  ]
}'

# Create a page under a parent
smithery tool call notion notion-create-pages '{
  "parent": {"page_id": "parent-uuid"},
  "pages": [
    {
      "properties": {"title": "Child Page"},
      "content": "Page content here"
    }
  ]
}'

# Create a page in a database
smithery tool call notion notion-create-pages '{
  "parent": {"data_source_id": "collection-uuid"},
  "pages": [
    {
      "properties": {
        "Task Name": "New Task",
        "Status": "In Progress",
        "Priority": 5,
        "Is Complete": "__YES__",
        "date:Due Date:start": "2024-12-25",
        "date:Due Date:is_datetime": 0
      }
    }
  ]
}'
```

**Property Formats:**
- Regular properties: `"Property Name": "value"`
- Number properties: Use JavaScript numbers, not strings
- Checkbox: `"__YES__"` or `"__NO__"`
- Date: `"date:PropertyName:start"`, `"date:PropertyName:end"`, `"date:PropertyName:is_datetime"`
- Place: `"place:PropertyName:name"`, `"place:PropertyName:address"`, etc.

### 4. Update Pages

Update page properties or content:

```bash
# Update properties
smithery tool call notion notion-update-page '{
  "page_id": "page-uuid",
  "command": "update_properties",
  "properties": {
    "title": "New Title",
    "status": "In Progress"
  }
}'

# Replace entire content
smithery tool call notion notion-update-page '{
  "page_id": "page-uuid",
  "command": "replace_content",
  "new_str": "# New Content\nAll new content here"
}'

# Search-and-replace content
smithery tool call notion notion-update-page '{
  "page_id": "page-uuid",
  "command": "update_content",
  "content_updates": [
    {
      "old_str": "Old text",
      "new_str": "New text"
    }
  ]
}'
```

### 5. Create Databases

Create a new database with SQL DDL syntax:

```bash
# Minimal database
smithery tool call notion notion-create-database '{
  "schema": "CREATE TABLE (\"Name\" TITLE)"
}'

# Task database with multiple properties
smithery tool call notion notion-create-database '{
  "title": "Tasks",
  "parent": {"page_id": "parent-uuid"},
  "schema": "CREATE TABLE (
    \"Task Name\" TITLE,
    \"Status\" SELECT(\"To Do\":red, \"Done\":green),
    \"Priority\" NUMBER FORMAT \"dollar\",
    \"Due Date\" DATE
  )"
}'
```

**Type Syntax:**
- Simple: `TITLE`, `RICH_TEXT`, `DATE`, `PEOPLE`, `CHECKBOX`, `URL`, `EMAIL`, `PHONE_NUMBER`, `STATUS`, `FILES`
- Select: `SELECT("opt1":color, "opt2":color)`
- Multi-select: `MULTI_SELECT("tag1":blue, "tag2":pink)`
- Number with format: `NUMBER FORMAT "dollar"`
- Relations: `RELATION("data_source_id")` or `RELATION("data_source_id", DUAL "synced_name")`

### 6. Update Database Schema

Add, remove, or rename columns:

```bash
smithery tool call notion notion-update-data-source '{
  "data_source_id": "collection-uuid",
  "statements": "ADD COLUMN \"Priority\" SELECT(\"High\":red, \"Medium\":yellow, \"Low\":green)"
}'

smithery tool call notion notion-update-data-source '{
  "data_source_id": "collection-uuid",
  "statements": "RENAME COLUMN \"Status\" TO \"Project Status\""
}'

smithery tool call notion notion-update-data-source '{
  "data_source_id": "collection-uuid",
  "statements": "DROP COLUMN \"Old Property\""
}'
```

### 7. Comments

Add and retrieve comments:

```bash
# Page-level comment
smithery tool call notion notion-create-comment '{
  "page_id": "page-uuid",
  "rich_text": [{"text": {"content": "This is a comment"}}]
}'

# Comment on specific content
smithery tool call notion notion-create-comment '{
  "page_id": "page-uuid",
  "selection_with_ellipsis": "# Section Ti...tle content",
  "rich_text": [{"text": {"content": "Comment on this section"}}]
}'

# Get all comments
smithery tool call notion notion-get-comments '{
  "page_id": "page-uuid",
  "include_all_blocks": true,
  "include_resolved": false
}'
```

### 8. Move and Duplicate

```bash
# Move pages to a new parent
smithery tool call notion notion-move-pages '{
  "page_or_database_ids": ["page-uuid-1", "page-uuid-2"],
  "new_parent": {"page_id": "new-parent-uuid"}
}'

# Duplicate a page
smithery tool call notion notion-duplicate-page '{
  "page_id": "page-uuid"
}'
```

## Workflow Decision Tree

```
User wants to work with Notion
│
├── Search/find content?
│   └── Use notion-search with query
│       └── Need full details? Use notion-fetch with result URL/ID
│
├── Create new content?
│   ├── New page? Use notion-create-pages
│   │   └── In database? Use data_source_id as parent
│   │   └── Standalone? Omit parent
│   └── New database? Use notion-create-database
│       └── Need specific schema? Use SQL DDL syntax
│
├── Update existing content?
│   ├── Properties? Use notion-update-page with update_properties
│   ├── Content? Use notion-update-page with update_content
│   └── Database schema? Use notion-update-data-source
│
├── Comments?
│   ├── Add? Use notion-create-comment
│   └── Read? Use notion-get-comments
│
└── Move/organize?
    ├── Move pages? Use notion-move-pages
    └── Duplicate? Use notion-duplicate-page
```

## Common Patterns

### Fetch Database Schema Before Creating Pages

Always fetch the database first to understand its schema:

```bash
# 1. Fetch database to get schema
smithery tool call notion notion-fetch '{"id": "database-uuid"}'

# 2. Check <data-source> tags for collection:// URLs
# 3. Check <schema> for property names and types
# 4. Create pages with correct property names
```

### Working with Multi-Source Databases

Some databases have multiple data sources. Always use the specific `collection://` URL:

```bash
# Fetch database first
smithery tool call notion notion-fetch '{"id": "database-url"}'

# Use the data_source_id from <data-source url="collection://...">
smithery tool call notion notion-create-pages '{
  "parent": {"data_source_id": "f336d0bc-b841-465b-8045-024475c079dd"},
  "pages": [{"properties": {"Title": "New Entry"}}]
}'
```

### Date Property Handling

Date properties use a split format:

```json
{
  "date:Start Date:start": "2024-01-15",
  "date:Start Date:end": "2024-01-20",
  "date:Start Date:is_datetime": 0
}
```

### Checkbox Property Handling

Use special tokens for checkboxes:

```json
{
  "Is Complete": "__YES__",
  "Is Draft": "__NO__"
}
```

## Resources

### references/extended-markdown-spec.md

Full Notion-flavored Markdown specification. Load this reference when:
- Creating complex page content with formatting
- Using advanced blocks (toggles, callouts, code blocks)
- Unsure about Markdown syntax for Notion

To load: Read the references/extended-markdown-spec.md file.

## Error Handling

### Authentication Required

If you see `auth_required` status:

1. Check the `auth_url` in the response
2. Tell the user to open the URL in their browser
3. Have them complete the OAuth flow
4. Retry the operation

### Validation Errors

Common validation errors:
- **"Property not found"**: Fetch the database schema first; property names are case-sensitive
- **"Parent must be data_source_id"**: Database has multiple sources; use the collection:// URL
- **"Content would be deleted"**: Set `allow_deleting_content: true` after confirming with user

## Best Practices

1. **Always fetch before update** — Get current content/schema to ensure accuracy
2. **Use semantic search** — The search tool understands context, so write natural queries
3. **Batch creates** — Create multiple pages in one call when possible
4. **Preserve child pages** — When replacing content, preserve `<page url="...">` and `<database url="...">` tags
5. **Lower page_size** — Reduce response size by requesting fewer results