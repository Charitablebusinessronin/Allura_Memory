# Story 5.2: Fix Tags Property Overload in Master Knowledge Base

Status: done

## Story

As a knowledge engineer,
I want the Tags property separated into dedicated Project, Domain, Status, and Priority properties,
So that agents don't confuse project identity with workflow state.

## Acceptance Criteria

1. Given Master Knowledge Base has overloaded Tags property, when the schema migration runs, then it creates distinct properties: Project (multi-select), Domain (multi-select), Status (select), Priority (select)
2. And it migrates existing tag values to correct properties
3. And Tags becomes a free-form classification property

## Tasks

- [x] Create Project multi-select property with values: faith-meats, difference-driven, patriot-awning, global-coding-skills
- [x] Create Domain multi-select property with values: AI, RAG, Coding, Infrastructure, Memory, Governance
- [x] Create Status select property with values: Draft, In Progress, Completed, Archived
- [x] Create Priority select property with values: Urgent, Normal, Low
- [x] Migrate existing Tags values to correct properties
- [x] Retain Tags as free-form classification

## Dev Notes

### Problem Analysis

The Tags property was overloaded with:
- Project identity: Faith meats, Difference driven
- Technical tags: Python, Docker, Neo4j
- Workflow state: Urgent, Completed
- Operational status: Operational, Strategic

This caused:
- Agents thinking "Urgent" is a project ID
- "Completed" becoming a group_id
- Cross-context contamination

### Solution Implemented

Created dedicated properties:
```
Project (multi_select): faith-meats, difference-driven, patriot-awning, global-coding-skills
Domain (multi_select): AI, RAG, Coding, Infrastructure, Memory, Governance
Status (select): Draft, In Progress, Completed, Archived
Priority (select): Urgent, Normal, Low
```

### Migration Executed

Existing Tags values were parsed and migrated:
- Project tags → Project property
- Domain tags → Domain property
- Status tags → Status property
- Priority tags → Priority property
- Remaining tags → Tags (retained)

## File List

- Notion schema update documentation
- Migration script (if automated)

## Completion Notes

- Schema migration completed 2026-03-17
- Tags overload resolved
- Clean separation of concerns achieved