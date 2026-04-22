# Allura Dual-Context Retrieval

## Purpose

Retrieve the smallest context that improves the current task.

Think in two buckets:

1. **local/project context**
2. **global/cross-project context**

## Before Acting

Retrieve:

- relevant project-local memories
- recent decisions or blockers
- only the global memories that materially improve reasoning

## Before Writing

Search for:

- same entity
- same topic
- same project
- recent related memory
- likely duplicates

Prefer superseding or linking over rewriting.

## Ranking Guidance

Rank by:

- semantic relevance
- recency
- status
- scope match
- confidence

## Response Discipline

Return:

- concise relevant context
- latest durable state
- lineage hints when conflict matters

Avoid:

- dumping raw history without filtering
- mixing deprecated and active memories without explanation
- using global memory when project-local memory is enough

## Completion Pattern

After the task:

1. store raw trace if useful
2. optionally propose durable insight
3. attach source and timestamps
4. preserve lineage if the result updates prior truth
