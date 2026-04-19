# S7 Implementation Plan — Allura Memory Stabilization

**Sprint:** S7-allura-memory-stabilization  
**Created:** 2026-04-19  
**Status:** IN PROGRESS

## P0 Tasks (MUST complete first)

- [ ] **S7-8**: Fix MODEL_REGISTRY provider prefixes
  - Files: `.opencode/MODEL_REGISTRY.md`, `.opencode/config/MODEL_REGISTRY.md`
  - Fix: `ollama-cloud/gpt-5.4` → `openai/gpt-5.4`, `ollama-cloud/gpt-5.4-mini` → `openai/gpt-5.4-mini`
  - Fix: Primary models for Woz, Bellard, Fowler, Knuth, Carmack in config/MODEL_REGISTRY.md to match `.md` frontmatter
  - Acceptance: `grep -r 'ollama-cloud/gpt-5' .opencode/MODEL_REGISTRY.md .opencode/config/MODEL_REGISTRY.md` returns zero matches

- [ ] **S7-9**: Align agent-routing.md primary/fallback models
  - File: `.opencode/rules/agent-routing.md`
  - Fix primary models: Woz→openai/gpt-5.4-mini, Bellard→openai/gpt-5.4-mini, Carmack→openai/gpt-5.4-mini, Fowler→openai/gpt-5.4-mini, Knuth→openai/gpt-5.4-mini
  - Fix fallbacks to match `.md` frontmatter exactly
  - Acceptance: Every agent row in the routing table matches `.opencode/agent/*.md`

- [ ] **S7-10**: Add NOTION_API_KEY + env vars
  - Files: `.env.example`, `docker/docker-compose.yml`, `src/curator/config.ts`, `src/lib/notion/client.ts`
  - Add: NOTION_API_KEY, NOTION_INSIGHTS_DB_ID, NOTION_KNOWLEDGE_DB_ID, NOTION_AGENTS_DB_ID
  - Throw on missing NOTION_API_KEY in production
  - Acceptance: App throws clear error on startup if NOTION_API_KEY missing in production

## P1 Tasks (after all P0s)

- [ ] **S7-11**: Fix Docker health check (wget → curl)
  - Files: `docker-compose.yml`, `docker/docker-compose.yml`, `Dockerfile`
  - Fix: Replace `wget` in healthcheck with `curl` or install wget in Dockerfile
  - Acceptance: `docker ps` shows `allura-web` as `(healthy)`
  - BLOCKED BY: None (independent)

- [ ] **S7-12**: Purge 773 orphan load-test proposals (SQL, append-only)
  - SQL: Mark proposals as `cancelled` (never DELETE)
  - Cancel DLQ test artifact
  - Acceptance: Orphan query returns 0 results
  - BLOCKED BY: None (independent)

- [ ] **S7-4**: Resolve 28 stuck notion_sync_pending events
  - BLOCKED BY: S7-10 (need NOTION_API_KEY first)
  - After API key is configured, re-process or resolve stuck events

## P2 Tasks (after all P1s)

- [ ] **S7-7**: Update Neo4j agent-nodes.ts to Team RAM naming
  - File: `src/lib/neo4j/agent-nodes.ts`
  - Replace legacy `memory-*` agent names with Team RAM names
  - Add all 10 agents, matching `.md` frontmatter models
  - Add `fallback_model` to AgentInsert interface
  - BLOCKED BY: S7-8, S7-9 (model fixes must land first)

- [ ] **S7-5**: Commit untracked .opencode/rules/ files
  - Files: `.opencode/rules/AI-GUIDELINES.md`, `.opencode/rules/_bootstrap.md`
  - Acceptance: `git status` shows zero untracked files in `.opencode/rules/`

## Progress Log

| Time | Task | Action | Result |
|------|------|--------|--------|
| 2026-04-19 06:00Z | - | Ralph loop started | - |