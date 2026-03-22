# Story 5.6: Validate End-to-End Promotion Workflow

Status: done

## Story

As a QA engineer,
I want a complete end-to-end test of the insight lifecycle,
So that we verify the pipeline from creation to approval.

## Acceptance Criteria

1. Given a test insight in Neo4j, when the full workflow executes, then curator creates Notion page successfully
2. And approval updates Neo4j and Notion correctly
3. And rejection marks insight as rejected
4. And duplicates are detected and blocked

## Tasks

- [x] Create test insight in Neo4j
- [x] Run curator promotion
- [x] Verify Notion page creation
- [x] Verify Neo4j notion_page_id storage
- [x] Test approval flow
- [x] Verify Notion content update
- [x] Test rejection flow
- [x] Test duplicate detection

## Dev Notes

### Test Insight Created

```cypher
CREATE (i:Insight {
  id: "insight_test_001",
  title: "Canonical tags should remain system slugs even when Notion uses display labels",
  summary: "Using system slugs for canonical identity while mapping to Notion display labels prevents cross-context contamination",
  confidence: 0.91,
  group_id: "difference-driven",
  status: "Proposed",
  created_at: datetime(),
  ai_accessible: false
})
```

### End-to-End Test Results

#### Step 1: Create Test Insight
```
✅ Neo4j insight created: insight_test_001
```

#### Step 2: Run Curator
```
[Curator] Found 1 candidate insights
[Curator] Found 0 existing insights in Notion
Summary: 1 promoted, 0 duplicates, 0 blocked, 0 errors
```

#### Step 3: Verify Notion Page
```
✅ Page created: notion.so/3261d9be65b381259cefdcd600b6c84c
✅ Promoted flag set in Neo4j
```

#### Step 4: Approve Insight
```
npm run curator:approve insight_test_001 Sabir
[INFO] Approving insight insight_test_001 by Sabir...
✅ Neo4j status = "Approved"
✅ Notion content updated
```

#### Step 5: Verify Final State

**Neo4j:**
```
i.id: "insight_test_001"
i.status: "Approved"
i.approved_by: "Sabir"
i.ai_accessible: TRUE
i.notion_page_id: "3261d9be-65b3-8125-9cef-dcd600b6c84c"
```

**Notion:**
```
Status: Approved
AI Accessible: true
Approved By: Sabir
Date: 2026-03-17
```

### Duplicate Detection Test

```
Create duplicate insight → Curator detects duplicate → Blocked promotion
✅ Duplicate detection working
```

### Rejection Flow Test

```
npm run curator:reject insight_test_002 "Duplicate"
✅ Status = "Rejected"
✅ Rejection reason recorded
```

## Pipeline Summary

```
Neo4j Insight (Proposed, confidence ≥ 0.7)
         │
         ▼
npm run curator:run
         │
         ▼
Notion Page Created (Pending Review)
         │
         ▼
npm run curator:approve -- <id> <approver>
         │
         ▼
Neo4j: status = "Approved", ai_accessible = true
Notion: Status = "Approved", AI Accessible = true
```

## File List

- Test insight creation script
- End-to-end test results documentation
- Curator CLI commands documentation

## Completion Notes

- Full pipeline validated 2026-03-17
- All acceptance criteria met
- Promotion, approval, rejection, and duplicate detection all working