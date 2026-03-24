# Story 5.4: Fix Curator Notion Page Creation

Status: done

## Story

As a developer,
I want the curator pipeline to correctly create Notion pages with proper content parsing,
So that insights are promoted with complete metadata.

## Acceptance Criteria

1. Given a candidate insight exists in Neo4j, when the curator promotes the insight, then it creates a Notion page with structured content
2. And it stores the notion_page_id in Neo4j
3. And it marks promoted_to_notion = true

## Tasks

- [x] Fix Notion client MCP response parsing
- [x] Handle Smithery CLI output format
- [x] Extract page ID from createPage response
- [x] Store notion_page_id in Neo4j insight node
- [x] Set promoted_to_notion = true
- [x] Create structured page content with metadata table

## Dev Notes

### Problem

The curator pipeline was creating Notion pages but not correctly extracting the page ID from the MCP response. The Smithery CLI returns JSON wrapped in output format that needed parsing.

### Solution

Updated the Notion client to properly parse the Smithery CLI response:

```typescript
// Before: MCP response was not parsed correctly
const result = await notionClient.createPage(...);

// After: Parse the MCP response format
const parsed = JSON.parse(result);
const pageId = parsed.pages[0].id;
```

### Test Results

```
[Curator] Found 1 candidate insights
[Curator] Found 0 existing insights in Notion
[NotionClient] createPage result: {
  "pages": [
    {
      "id": "3261d9be-65b3-8125-9cef-dcd600b6c84c",
      "url": "https://www.notion.so/3261d9be65b381259cefdcd600b6c84c",
      "properties": {
        "Name": "Canonical tags should remain system slugs...",
        "Confidence": 0.91
      }
    }
  ]
}
[Curator] Summary: 1 promoted, 0 duplicates, 0 blocked, 0 errors
```

### Page Content Structure

```markdown
## Summary
Using system slugs for canonical identity while mapping to Notion display labels...

## Metadata
| Property | Value |
|----------|-------|
| Canonical Tag | difference-driven |
| Display Tag | Difference driven |
| Source Insight ID | insight_test_001 |
| Confidence | 0.91 |
| Status | Pending Review |
| AI Accessible | false |
```

## File List

- `src/curator/notion-client.ts` - Fixed MCP response parsing
- `src/curator/promote.ts` - Page ID storage in Neo4j
- `src/curator/content-builder.ts` - Structured content generation

## Completion Notes

- Curator pipeline working end-to-end
- Page ID correctly extracted and stored
- Neo4j updated with notion_page_id and promoted_to_notion flag