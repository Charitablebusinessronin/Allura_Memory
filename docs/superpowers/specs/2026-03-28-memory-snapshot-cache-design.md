# Memory Snapshot Cache Design

**Author:** roninmemory-project agent  
**Date:** 2026-03-28  
**Status:** Draft  
**Scope:** roninmemory repository (branch: `new-main`)

## 1. Summary

We will accelerate memory hydration by generating a compact JSON cache that summarizes the canonical documentation trees (`docs/roninmemory/` and `docs/Carlos_plan_framework/`). A Bun CLI parses the sources, extracts titles/summaries/timestamps, and writes `memory-bank/index.json`. Startup then reads this file (sub-second), logs a session briefing, and syncs any new or changed entries into the existing memory system (Postgres traces + Neo4j insights) under `group_id = "roninmemory"`. This removes direct filesystem scanning from the <30s startup window while keeping canonical docs untouched.

## 2. Goals & Success Criteria

1. Hydrate each session with relevant doc context in <30 seconds.  
2. Keep docs as source of truth; snapshot is generated, never edited manually.  
3. Integrate with existing memory infrastructure so new/updated docs automatically become searchable insights/events.  
4. Support incremental refresh: unchanged files are skipped to keep cache builds fast.  
5. Provide deterministic artifact (`memory-bank/index.json`) that other workflows (OpenClaw, MCP tools) can reuse.

## 3. Out of Scope

- Building a long-running file watcher or daemon (future iteration).  
- Modifying doc content/structure.  
- Changing Postgres/Neo4j schemas beyond storing new insights/events.

## 4. Architecture Overview

### 4.1 Components

| Component | Responsibility |
| --- | --- |
| `scripts/build-memory-snapshot.ts` | Bun CLI that scans doc directories, extracts metadata, and emits JSON snapshot + metadata. |
| `memory-bank/index.json` | Cache consumed at startup; array of structured entries with `path`, `title`, `summary`, `tags`, `lastModified`, `hash`. |
| `memory-bank/index.meta.json` | Tracks snapshot build metadata (run timestamp, per-file hash map) for incremental updates. |
| `scripts/hydrate-session-from-snapshot.ts` | Startup helper invoked by session bootstrap. Reads snapshot, logs `session_briefing` event, syncs changed entries into memory system via MCP tools. |
| MCP Memory Tools (`create_insight`, `log_event`) | Persist curated summaries into Postgres/Neo4j, respecting `group_id`. |

### 4.2 Data Flow

1. **Build step (manual or pre-session hook):**  
   - CLI reads prior metadata, glob scans doc directories, computes file hashes, extracts first meaningful heading + summary sentences (configurable).  
   - Updated entries written into `index.json`; metadata file updated with timestamp + hash map.  
   - CLI output includes stats (files scanned, new, updated, skipped) and runtime.

2. **Startup hydration:**  
   - Session bootstrap script reads `index.json` (fast) and selects top entries (by priority heuristics, e.g., root README, blueprints, tasks).  
   - Logs a `session_briefing` event via `MCP_DOCKER_insert_data` summarizing key docs + counts.  
   - For each entry flagged as new/changed since last hydration, call MCP memory server to create an insight with `topic_key` derived from file path (e.g., `roninmemory.docs.roninmemory.blueprint`). Each insight includes: summary text, tags, file path, hash, and `SUPERSEDES` reference if an older version exists.  
   - Optionally, queue asynchronous ingestion for bulk updates if >N files changed.

3. **Agent consumption:**  
   - The agent reads the `session_briefing` event + snapshot summary to understand context immediately.  
   - When deeper detail is needed, the agent can open the underlying doc (path preserved in snapshot) or query the stored insight via MCP search.

## 5. Data Schema

Snapshot entry structure:

```json
{
  "path": "docs/roninmemory/README.md",
  "relativePath": "docs/roninmemory/README.md",
  "title": "Roninmemory Overview",
  "summary": "High-level description of roninmemory architecture, tenants, and guardrails.",
  "tags": ["overview", "architecture"],
  "lastModified": "2026-03-26T22:15:00Z",
  "hash": "sha256:...",
  "priority": 10
}
```

`index.meta.json` example:

```json
{
  "generatedAt": "2026-03-28T10:05:00Z",
  "sourceDirs": ["docs/roninmemory", "docs/Carlos_plan_framework"],
  "fileHashes": {
    "docs/roninmemory/README.md": "sha256:...",
    "docs/Carlos_plan_framework/BLUEPRINT.md": "sha256:..."
  }
}
```

## 6. Workflows

> Reference: the repository README now documents the operator flow in detail (see [Memory snapshot workflow](../../../README.md#memory-snapshot-workflow)).

### 6.1 Snapshot Build CLI

1. Parse CLI args (source dirs default to the two doc trees, output path default `memory-bank`).  
2. Load previous metadata if present.  
3. Use `fast-glob` via Bun to collect markdown/docs.  
4. For each file:
   - Compute hash (e.g., SHA-256).  
   - If unchanged and incremental mode on, skip reading content.  
   - Otherwise read content, derive title (first `#` heading or filename), summary (first paragraph truncated to N chars), tags (via heuristics or simple mapping).  
   - Add/replace entry in snapshot array.  
5. Write `index.json` deterministically (sorted by priority/path).  
6. Write `index.meta.json` with new hashes + timestamp.  
7. Emit CLI stats + exit code 0.

### 6.2 Startup Hydration Script

1. Read `memory-bank/index.json`; fail fast with actionable error if missing (suggest running build CLI).  
2. Determine changed entries by comparing snapshot hashes against last ingested hash map (persisted via Postgres event metadata).  
3. Construct `session_briefing` event payload (top N entries, counts of new/updated/total). Call `MCP_DOCKER_insert_data` with `status='pending'` to satisfy schema.  
4. For each changed entry:
   - Compose `topic_key` (sanitize path).  
   - Call `create_insight` or equivalent, referencing previous insight via `SUPERSEDES` relation if known.  
   - Log `memory_sync` events for observability.  
5. Emit a follow-up `session_briefing_completed` event (new insert, never update prior row) capturing ingestion metrics and cache the latest hash map for next session (e.g., `memory-bank/ingestion.meta.json`).

### 6.3 Tenant & group_id Propagation

- The snapshot CLI reads `group_id` from explicit CLI flag (default `roninmemory`) and writes it into the metadata file for downstream consumers.  
- The hydration script requires `GROUP_ID` env var or CLI flag; it validates against the canonical tag regex already enforced in `src/mcp/memory-server.ts`.  
- Every Postgres insert (via `MCP_DOCKER_insert_data`) and Neo4j insight creation (via `create_insight`/`create_relation`) must include this `group_id`.  
- If validation fails (missing/empty/mismatched), the script aborts before performing any writes and logs a `memory_hydration_error` event.

## 7. Performance & Timing

- Snapshot build is offline/pre-session; incremental hashing keeps runtime low even for large doc trees (<5s expected).  
- Startup script only reads small JSON + touches memory APIs, easily <30s even with dozens of changed entries.  
- Both scripts implemented with Bun for fast startup and shared tooling.

## 8. Testing Strategy

1. Unit tests for snapshot builder (hash skip logic, title extraction, summary truncation).  
2. Integration test that runs CLI on fixture docs and validates JSON output.  
3. Startup hydration test that mocks MCP memory tools and ensures new entries emit expected events/insights.  
4. Performance smoke test measuring runtime on sample doc tree.

## 9. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Large doc files slow parsing | Limit summary length, optionally skip >N KB with warning. |
| Snapshot missing -> startup fails | Script emits actionable error and points to CLI command. Consider fallback to direct doc read if necessary. |
| Memory system drift (hash mismatch) | Store hash per entry; if mismatch, re-ingest entire entry and log event. |
| Schema changes in future | JSON schema version field to allow migrations. |

## 10. Open Questions / Future Work

- Add file watcher or Git hook to auto-build snapshot on changes.  
- Expand tag extraction via front-matter or AI summarization.  
- Surface snapshot data in UI dashboards (OpenClaw).  
- Consider storing snapshots per branch if docs diverge significantly.

## Appendix A: Event Payload Schema

`session_briefing` event payload (inserted via `MCP_DOCKER_insert_data`):

```json
{
  "group_id": "roninmemory",
  "event_type": "session_briefing",
  "agent_id": "roninmemory-project",
  "workflow_id": "DebugSession-2026-03-28-roninmemory-new-main",
  "status": "pending",
  "metadata": {
    "snapshotPath": "memory-bank/index.json",
    "totalEntries": 42,
    "newEntries": 5,
    "updatedEntries": 3,
    "topDocs": ["docs/roninmemory/README.md", "docs/Carlos_plan_framework/BLUEPRINT.md"]
  }
}
```

Follow-up `session_briefing_completed` event contains the same identifiers with `event_type` set accordingly and `metadata` summarizing ingestion outcomes. No updates are issued; append-only inserts preserve trace immutability.

## Appendix B: Neo4j Insight Structure

Each new/updated snapshot entry produces an `Insight` node with properties:

| Property | Description |
| --- | --- |
| `topic_key` | Derived from file path (e.g., `roninmemory.docs.roninmemory.readme`). |
| `group_id` | Always `roninmemory`, supplied from validated CLI/env input. |
| `summary` | Snapshot summary text (<= 500 chars). |
| `hash` | SHA-256 of file contents to detect drift. |
| `tags` | Array of tags from snapshot. |
| `source_path` | Relative file path. |
| `generated_at` | Timestamp when snapshot was ingested. |

Relationships:

- `(:Insight {hash: oldHash})-[:SUPERSEDES]->(:Insight {hash: newHash})` maintains lineage.  
- Optional `(:Insight)-[:EVIDENCE_OF]->(:DocumentSource {path: ...})` if we later model doc nodes.

These inserts are executed through the existing memory MCP server, which enforces `group_id` validation and appends events to Postgres for traceability.
