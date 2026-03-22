# Notion MCP Tool Reference

Tool schemas and detailed usage for the Notion MCP server.

## Tool Summary

| Tool | Purpose | Read/Write |
|------|---------|------------|
| `notion-search` | Search workspace, users, databases | Read-only |
| `notion-fetch` | Get page/database/data source details | Read-only |
| `notion-create-pages` | Create one or more pages | Write |
| `notion-update-page` | Update properties or content | Write |
| `notion-move-pages` | Move pages to new parent | Write |
| `notion-duplicate-page` | Duplicate a page | Write |
| `notion-create-database` | Create new database | Write |
| `notion-update-data-source` | Modify database schema | Write |
| `notion-create-comment` | Add comment to page | Write |
| `notion-get-comments` | Retrieve comments | Read-only |

---

## notion-search

**Description:** Perform semantic search over Notion workspace and connected sources.

**Input Schema:**
```json
{
  "query": "string (required)",
  "query_type": "internal | user",
  "content_search_mode": "workspace_search | ai_search",
  "data_source_url": "string (optional)",
  "page_url": "string (optional)",
  "teamspace_id": "string (optional)",
  "filters": {
    "created_date_range": {
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD"
    },
    "created_by_user_ids": ["uuid"]
  },
  "page_size": 1-25,
  "max_highlight_length": 0-500
}
```

**Use Cases:**
- Find pages by semantic query
- Search within specific databases or teamspaces
- Filter results by date or creator
- Find users by name or email

---

## notion-fetch

**Description:** Retrieve details about a Notion entity by URL or ID.

**Input Schema:**
```json
{
  "id": "string (required) - URL, UUID, or collection://",
  "include_discussions": "boolean (optional)",
  "include_transcript": "boolean (optional)"
}
```

**ID Formats:**
- Full Notion URL: `https://notion.so/workspace/Page-Title-1234567890`
- Notion Site URL: `https://myspace.notion.site/Page-Title-abc123def456`
- Raw UUID: `12345678-90ab-cdef-1234-567890abcdef`
- Data source URL: `collection://12345678-90ab-cdef-1234-567890abcdef`

**Output includes:**
- Page content in Notion-flavored Markdown
- Data source URLs for databases
- Schema information
- Discussion markers (if `include_discussions: true`)

---

## notion-create-pages

**Description:** Create one or more Notion pages with properties and content.

**Input Schema:**
```json
{
  "parent": {
    "page_id": "uuid",
    "database_id": "uuid",
    "data_source_id": "uuid"
  },
  "pages": [
    {
      "properties": { "title": "Page Title", "Property": "value" },
      "content": "Markdown content",
      "template_id": "uuid (optional)",
      "icon": "emoji or URL (optional)",
      "cover": "URL (optional)"
    }
  ]
}
```

**Property Value Formats:**

| Type | Format |
|------|--------|
| Title/Text | `{"Title": "string"}` |
| Number | `{"Count": 42}` |
| Checkbox | `{"Complete": "__YES__"}` or `"__NO__"` |
| Date | `{"date:Due:start": "2024-01-01", "date:Due:end": "2024-01-05", "date:Due:is_datetime": 0}` |
| Select | `{"Status": "In Progress"}` |
| Multi-select | `{"Tags": ["tag1", "tag2"]}` |
| People | `{"Assignee": "user-uuid"}` |
| URL | `{"Link": "https://..."}` |

---

## notion-update-page

**Description:** Update page properties, content, or apply templates.

**Commands:**

### update_properties
```json
{
  "page_id": "uuid",
  "command": "update_properties",
  "properties": { "title": "New Title" }
}
```

### replace_content
```json
{
  "page_id": "uuid",
  "command": "replace_content",
  "new_str": "# New Content\nAll content replaced",
  "allow_deleting_content": false
}
```

### update_content (search-and-replace)
```json
{
  "page_id": "uuid",
  "command": "update_content",
  "content_updates": [
    {
      "old_str": "Old text",
      "new_str": "New text"
    }
  ]
}
```

### apply_template
```json
{
  "page_id": "uuid",
  "command": "apply_template",
  "template_id": "uuid"
}
```

### update_verification
```json
{
  "page_id": "uuid",
  "command": "update_verification",
  "verification_status": "verified",
  "verification_expiry_days": 90
}
```

---

## notion-create-database

**Description:** Create a new Notion database using SQL DDL syntax.

**Input Schema:**
```json
{
  "schema": "CREATE TABLE (\"Name\" TITLE, ...)",
  "title": "string (optional)",
  "description": "string (optional)",
  "parent": { "page_id": "uuid" }
}
```

**Type Syntax:**

| Type | Syntax |
|------|--------|
| Title | `TITLE` |
| Rich Text | `RICH_TEXT` |
| Number | `NUMBER` or `NUMBER FORMAT 'dollar'` |
| Select | `SELECT('opt1':color, 'opt2':color)` |
| Multi-select | `MULTI_SELECT('tag1':blue, 'tag2':pink)` |
| Date | `DATE` |
| People | `PEOPLE` |
| Checkbox | `CHECKBOX` |
| URL | `URL` |
| Email | `EMAIL` |
| Phone | `PHONE_NUMBER` |
| Files | `FILES` |
| Status | `STATUS` |
| Relation | `RELATION('data_source_id')` |
| Two-way relation | `RELATION('data_source_id', DUAL 'synced_name')` |
| Rollup | `ROLLUP('rel_prop', 'target_prop', 'function')` |
| Unique ID | `UNIQUE_ID PREFIX 'X'` |
| Created time | `CREATED_TIME` |
| Last edited | `LAST_EDITED_TIME` |

**Colors:** default, gray, brown, orange, yellow, green, blue, purple, pink, red

**Example:**
```sql
CREATE TABLE (
  "Task Name" TITLE,
  "Status" SELECT('To Do':red, 'In Progress':yellow, 'Done':green),
  "Priority" NUMBER FORMAT 'dollar',
  "Due Date" DATE,
  "Assignee" PEOPLE,
  "Tags" MULTI_SELECT('bug':red, 'feature':blue, 'docs':gray),
  "Task ID" UNIQUE_ID PREFIX 'TSK'
)
```

---

## notion-update-data-source

**Description:** Modify database schema, title, or attributes.

**Input Schema:**
```json
{
  "data_source_id": "uuid (required)",
  "statements": "DDL statements (optional)",
  "title": "string (optional)",
  "description": "string (optional)",
  "is_inline": "boolean (optional)",
  "in_trash": "boolean (optional)"
}
```

**DDL Statements:**
- `ADD COLUMN "Name" TYPE` — Add property
- `DROP COLUMN "Name"` — Remove property
- `RENAME COLUMN "Old" TO "New"` — Rename property
- `ALTER COLUMN "Name" SET TYPE` — Change type

---

## notion-move-pages

**Description:** Move pages or databases to a new parent.

**Input Schema:**
```json
{
  "page_or_database_ids": ["uuid1", "uuid2"],
  "new_parent": {
    "page_id": "uuid",
    "database_id": "uuid",
    "data_source_id": "uuid",
    "type": "workspace"
  }
}
```

---

## notion-duplicate-page

**Description:** Duplicate a page asynchronously.

**Input Schema:**
```json
{
  "page_id": "uuid (required)"
}
```

**Note:** Duplication completes asynchronously. Don't rely on returned ID being immediately available.

---

## notion-create-comment

**Description:** Add a comment to a page or specific content.

**Input Schema:**
```json
{
  "page_id": "uuid (required)",
  "rich_text": [
    { "text": { "content": "Comment text" } }
  ],
  "discussion_id": "string (for replies)",
  "selection_with_ellipsis": "Start...end (for content comments)"
}
```

**Comment Types:**
- Page-level: Just `page_id` + `rich_text`
- Content-specific: Add `selection_with_ellipsis` (~10 chars start/end)
- Reply to discussion: Add `discussion_id`

---

## notion-get-comments

**Description:** Retrieve comments and discussions from a page.

**Input Schema:**
```json
{
  "page_id": "uuid (required)",
  "include_all_blocks": "boolean (default false)",
  "include_resolved": "boolean (default false)",
  "discussion_id": "string (for specific thread)"
}
```

**Output Format:**
- Returns discussions in XML format
- Use `fetch` with `include_discussions: true` first to see discussion anchors
- Discussion IDs match `discussion://` URLs from fetch output
