# Story 5.5: Fix Approval Sync to Update Notion Content

Status: done

## Story

As a developer,
I want the approval flow to update both Neo4j status and Notion page content,
So that approval state is reflected in all systems.

## Acceptance Criteria

1. Given an insight is approved in Neo4j, when the approval sync runs, then it updates Neo4j: status = "Approved", approved_by, ai_accessible = true
2. And it updates Notion page content: Status = "Approved", AI Accessible = true
3. And it handles HTML table content format correctly

## Tasks

- [x] Fix approval sync to use notion_page_id from Neo4j
- [x] Update Neo4j insight status on approval
- [x] Parse HTML table content for Status and AI Accessible fields
- [x] Use replace_content to update Notion page
- [x] Add approval metadata (Approved By, Approved At)

## Dev Notes

### Problem

The approval flow was updating Neo4j correctly but failing to update the Notion page. The content search for Status and AI Accessible fields failed due to HTML table formatting.

### Solution

1. Use the `notion_page_id` stored in Neo4j directly instead of searching by content
2. Use `replace_content` command to update the entire page content with approved status
3. Add approval metadata to the updated content

### Neo4j Update Query

```cypher
MATCH (i:Insight {id: $insightId})
SET i.status = "Approved",
    i.approved_by = $approver,
    i.approved_at = datetime(),
    i.ai_accessible = true
RETURN i
```

### Notion Content Update

```markdown
## Metadata
| Property | Value |
|----------|-------|
| Canonical Tag | difference-driven |
| Display Tag | Difference driven |
| Source Insight ID | insight_test_001 |
| Confidence | 0.91 |
| Status | **Approved** |
| AI Accessible | **true** |

## Approval
**Status:** Approved
**Approved by:** Sabir
**Date:** 2026-03-17
**AI Accessible:** true
```

### Test Results

```
Neo4j Insight:
- i.id: "insight_test_001"
- i.status: "Approved"
- i.approved_by: "Sabir"
- i.ai_accessible: TRUE
- i.notion_page_id: "3261d9be-65b3-8125-9cef-dcd600b6c84c"

Notion Page: notion.so/3261d9be65b381259cefdcd600b6c84c
- Status: Approved ✓
- AI Accessible: true ✓
```

## File List

- `src/curator/approval-sync.ts` - Approval sync logic
- `src/curator/notion-client.ts` - Content update methods
- `src/curator/commands/approve.ts` - CLI command

## Completion Notes

- Approval flow working end-to-end
- Neo4j and Notion both updated
- HTML table content parsing fixed
- Approval metadata properly recorded