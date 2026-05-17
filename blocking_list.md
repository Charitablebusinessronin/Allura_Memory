# blocking_list

> Current scope: Allura Memory Phase 0 finish blockers as reconciled on 2026-05-17.
> Notion remains the canonical status authority; this file is the local execution ledger.
> Brain receipts are audit traces, not proof of Done.

| id | status | blocker_type | check | evidence | remediation |
|---|---|---|---|---|---|
| B01 | DONE | Review gate | IRIS Brand approval / 2.1 Token Audit | PR #28 merged at `0595f78924ef6ba93baa78238e1421ea1047e8a7`; Notion `2.1 Token Audit` moved to Done; Brain receipts `3361ad3a-61b9-43f0-996d-a608c029dd40`, `f5347a2c-84de-4d19-b898-b4e74bf26187`, `2e3d9fe9-10a6-4641-bdda-0a9e057f35ba` | No further action unless Notion is reopened |
| B02 | DIRECT_GREEN_RALPH_BLOCKED | Multi-role review | Pike + Fowler + Ralph + IRIS `/allura` gate | PR #29 merged at `ae7c11116fba28c4aa493ec74482574b10bf181e`; direct lint/typecheck/tests/browser smoke green; Notion comment `3631d9be-65b3-816b-96aa-001d27b0d322`; Brain receipt `c6ade62b-4f8c-4ddc-bf19-e1704262249e` | Resolve/waive Ralph nested runtime blocker: `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted` |
| B03 | OPEN | Decision ambiguity | 3100 target undefined | Downstream cutover/parity cards blocked | Explicit owner decision: MCP gateway, dashboard UI, or superseded |
| B04 | OPEN | Scope ambiguity | Cash tracker source missing | No canonical Notion source identified | Captain decision: in-scope with source OR out-of-scope |
| B05 | VALIDATED_PENDING_MERGE | Build gap | Memory Explorer fetch unstable | Notion card `35d1d9be-65b3-81cb-8ad8-c6b903ddd37d`; root cause was unmerged `368c4eb8` regression fix: Neo4j `Record` values parsed as plain objects, causing `created_at` to become `undefined` and throw `Invalid time value`; also needed 127.0.0.1 dev-origin allowance | Patched on `codex/phase0-b05-live-data`; local API/UI validation green; attach PR evidence, merge, then move Notion card to Done |
| B06 | IN_PROGRESS | Evidence scatter | Notion + artifacts + memory | PR #27/#28/#29 evidence attached, but Phase 0 closure evidence still split across board, Brain, and local artifacts | Keep this ledger plus Notion finish plan synchronized as each blocker closes |
| B07 | DEFERRED | Scope drift | Board-config discussions | Phase 1 board-config is explicitly blocked until Phase 0 closes | Do not start Phase 1 board config until all Phase 0 rows are closed/waived |
| B08 | DIRECT_GREEN_RALPH_BLOCKED | Board evidence completeness | `/allura` split work items | `/allura` direct evidence green via PR #29; Ralph evidence blocked by nested bwrap runtime | Attach waiver or rerun Ralph after runtime fix |
| B09 | IN_REVIEW | Validation gap | CARD-2.4-E | PR #31 opened from `codex/b09-approval-guard`; local evidence: targeted approval audit/promotion guard/Knowledge Hub tests `64 pass / 0 fail / 146 expect()`, targeted lint pass, typecheck pass, `git diff --check` pass | Watch GitHub checks, merge once green, then attach final merge evidence to Notion |
