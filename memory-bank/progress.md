## 2026-05-16: Contract-Unblock Unblock Run

- Project: allura-memory
- Agent: execution assistant (Ralph unblock run)
- Decision: NO_GO

- Summary:
  - Executed contract-hygiene unblock step for `contract_unblock` with strict gate shape.
  - Added canonical run contract artifact at `ralph/PROMPT_plan.md`.
  - Created `.opencode/config.json` aligned to canonical scope and required context/skills.
  - Updated `ralph_ready_status.json` and `blocking_list.md` to the exact runtime schema with B04/B05 treated as PASS, B03 as concrete, and one unresolved blocker remaining.

- Evidence:
  - active_notion_contract_scope set to `https://www.notion.so/ce13dc069ff347689fcc7cbe188232c8`.
  - `validation_commands`: `bun test src/lib/validation/group-id.test.ts` (pass noted in status artifact).
  - MCP discovery/activation pinned notion tooling via MCP_DOCKER was recorded as PASS in status artifact.

- Unresolved risks:
  - `B01` remains OPEN until run-time validator accepts one canonical plan binding and sibling plan-like artifacts are treated as non-authoritative without ambiguity.

- Next action:
  - Resolve `B01`, set `blocking_count = 0`, then switch `execution_go` to GO and run `./ralph/loop.sh`.

## 2026-05-16: Runtime model pinned to GPT-5.3 Codex Spark

- Scope: allura-memory / contract_unblock loop
- Decision: mandatory model selection update
- Evidence: `.opencode/config.json` updated to `model: "gpt-5.3-codex-spark"`
- Outcome: model binding for runtime contract now explicitly set to GPT-5.3 Codex Spark.

## 2026-05-16: B01 resolved (single canonical plan artifact)

- Agent: execution assistant (Ralph unblock run)
- Decision: READY_FOR_GO (post-validation)
- Result: `B01` closed.
  - Canonical plan bound to `ralph/PROMPT_plan.md`.
  - `.opencode/config.json` updated with `runtime_contract.canonical_plan_path = "ralph/PROMPT_plan.md"`, matching `canonical_plan_id` and concrete `active_notion_contract_scope`.
  - Legacy plan-like files (`ralph/IMPLEMENTATION_PLAN.md`, `ralph/PROMPT_build.md`, `ralph/PROMPT_ulw.md`) now explicitly carry `NON_AUTHORITATIVE_ONLY` guard.
- Gate output: `ralph_ready_status.json` now all PASS with `execution_go: GO`.

## 2026-04-22: Session Complete

- Project: allura-roninmemory
- Agent: brooks
- Summary: Started with Brain hydration and repo verification, then analyzed and partially advanced the pgvector/HNSW rollout for 4096d embeddings.
- Key changes:
  - Added guarded migration `docker/postgres-init/23-enable-4096d-hnsw.sql`
  - Updated `docker-compose.yml` Postgres image path after discovering `pgvector/pgvector:0.8.4-pg16` does not exist upstream
  - Updated `docker/postgres-init/16-ruvector-memories.sql` comments to match the staged HNSW strategy
  - Validated targeted RuVector tests passed
- Why:
  - To restore an indexed vector retrieval path for 4096-dimensional qwen3 embeddings without assuming unsupported pgvector image tags
- Final state:
  - Live Postgres was recreated on `pgvector/pgvector:pg16` and is healthy
  - HNSW restoration is not yet proven on the live DB
  - Allura Brain was unavailable at session end, so this file is the durable fallback record
- Important lesson:
  - Verify actual `vector` extension version before rollout and never assume new init scripts apply to an existing external volume

## 2026-04-22: Session Complete

- Project: allura-roninmemory
- Agent: brooks
- Summary: Completed documentation and orchestrator alignment for the new Team RAM memory model.
- Key changes:
  - Updated canonical architecture docs to remove the custom monolithic MCP runtime model
  - Updated primary and auxiliary skill docs to align on Brooks/Team RAM orchestration and packaged MCP server usage
  - Pruned noisy temporary summary files from `.opencode/skills/`
  - Updated `src/team-ram/orchestrator.ts` to enforce true staged execution
  - Added/updated orchestrator tests to verify memory-first execution order
- Why:
  - To establish one coherent runtime contract: `neo4j-memory` first, `database-server` second, and `neo4j-cypher` only when needed
- Final state:
  - Canonical docs, core skill docs, and auxiliary skill docs are aligned on the new architecture
  - Team RAM orchestrator now executes in staged order rather than parallel fan-out for mixed memory tasks
  - Remaining follow-up work is focused on legacy runtime/config drift and tightening routing intent inference
- Important lesson:
  - Plan order is not execution order; architecture only becomes real when the runtime contract enforces it

## 2026-04-25: Session Complete

- Project: allura-system / Allura Memory
- Agent: brooks-architect
- Summary: Recovered and validated the canonical MCP Streamable HTTP gateway path after memory tool and runtime drift investigation.
- Key changes:
  - Fixed `src/mcp/canonical-http-gateway.ts` by replacing reused stateless transport with stateful per-session transport management keyed by `Mcp-Session-Id`.
  - Fixed env loading in `env.mjs` and `src/mcp/canonical-tools/connection.ts` so runtime-injected env vars remain authoritative while `.env.local` can override `.env` only when variables are not already set.
  - Updated `docker-compose.yml` MCP/http-gateway secret handling to avoid interpolated secret overrides that bypass `env_file` precedence.
  - Updated `opencode.json` toward canonical HTTP gateway usage instead of local `npx tsx` stdio runtime drift.
  - Added `scripts/validate-env.sh` and updated `.env.example`.
- Why:
  - The governed memory path had multiple ingress surfaces; tool namespace availability did not prove end-to-end health. The canonical HTTP gateway needed real MCP initialize/tools protocol validation, not just `/ready` health.
- Validation:
  - Pruned Docker build cache after Docker reported no space left on device.
  - Rebuilt `mcp` and `http-gateway` containers successfully.
  - `bash scripts/brain-stack.sh wait-ready 120` passed.
  - `RUN_MCP_TESTS=true ALLURA_MCP_HTTP_URL="http://127.0.0.1:5888" bun vitest run src/__tests__/mcp-streamable-http.test.ts` passed: 12/12 tests.
  - `bun run typecheck` passed.
- Final state:
  - Canonical MCP Streamable HTTP gateway at `http://127.0.0.1:5888/mcp` is validated.
  - Chat-harness `allura-brain_memory_add` still fails with stale SASL/password behavior, indicating a separate ingress path remains drifted from the rebuilt canonical gateway.
  - Working tree has uncommitted changes pending review/commit.
- Important lesson:
  - Health probes are not protocol proofs. A castle gate may look sound from the road, yet still fail to lower the drawbridge; validate the actual client path.

## 2026-05-15: Ralph Readiness Blocked — contract_unblock

- Agent: execution assistant (Ralph unblock run)
- Project: allura-memory
- Decision: NO_GO

- Summary:
  - Performed strict plan scan, MCP discovery, and minimal smoke checks.
  - Group-id enforcement remains implemented and targeted tests passed.
  - Gate remains blocked due missing authoritative `PROMPT_plan*` artifact, missing `.opencode/config.json`, unresolved Notion scope input, missing Brain-tool execution path, and notion-server activation authorization failure.

- Evidence:
  - `mcp_find("notion")` returned `notion` and `notion-remote`.
  - `mcp__MCP_DOCKER__mcp_add("notion-remote", { activate: true })` failed with authorization request.
  - `bun test src/lib/validation/group-id.test.ts` passed (44 pass, 0 fail).
  - Notion probe using `mcp__codex_apps__notion._notion_get_teams` returned empty team arrays.

- Unresolved risks:
  - No single authoritative plan file resolved to drive gate-safe Ralph execution.
  - Source-of-truth drift (`.opencode/config.json` missing) may hide other compliance drift.
  - Brain memory search cannot be performed until required session/skill path is activated.
