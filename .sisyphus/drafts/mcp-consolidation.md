# Draft: MCP Consolidation

## Requirements (confirmed)
- Target first-class MCP servers: Allura, mcp_docker, Perplexica.
- Goal: reduce MCP sprawl and simplify routing.
- Routing intent:
  - Allura = memory, recall, project knowledge, long-term context.
  - mcp_docker = primary gateway/default tool fabric for operational integrations and other tools.
  - Perplexica = web research / external search.
- Decision rule:
  - Memory-related MCPs stay in Allura.
  - Web-search-related MCPs stay in Perplexica.
  - General integration/tool MCPs should be removed as standalone if Docker can host/proxy them.
  - Uncertain replacements should be marked Unsure with rationale.
- Desired output structure from the eventual analysis:
  1. Assumptions
  2. Current inventory
  3. Keep/Remove/Unsure table
  4. Target architecture
  5. Migration plan
  6. Final reduced config
  7. Validation checklist
  8. Risks and rollback
- User selected option 3: Both.
- Required order:
  1. Audit current MCP config first.
  2. Produce staged migration plan with removal order, dependency checks, auth/env impacts, validation, and rollback.
  3. End with reduced target config, before/after mapping or diff, validation checklist, and risks/unknowns.
- Migration should prefer low-risk removals first, then uncertain items.
- Style: technical, concise, opinionated; call out redundant MCPs aggressively.

## Technical Decisions
- Preserve Allura and Perplexica as standalone first-class MCPs regardless of overlap.
- Treat mcp_docker as the default consolidation layer.
- Secret/auth migration must avoid exposing raw values; only variable names, presence checks, and schema expectations should be discussed.

## Research Findings
- Loaded `mcp-docker` skill: Docker MCP catalog can route common database, web/search, developer, productivity, and filesystem integrations; recommended pattern is discover → configure → add/activate → execute.
- Loaded `varlock` skill: auth/env planning must not read or print secret values; use env var names/schemas and masked validation only.

## Open Questions
- Current MCP/server configuration has not been provided yet.
- Existing config format/location is unknown.
- Need the actual config contents to audit and produce a faithful reduced config.
- Need to know whether this should become a `.sisyphus/plans/*.md` work plan after the config audit, or whether the user wants the audit/migration response inline only.

## Scope Boundaries
- INCLUDE: audit current MCP inventory, classify keep/remove/unsure, map Docker replacements, identify env/auth updates, risks, validation, target config.
- EXCLUDE: removing servers, editing live config, executing migration, exposing secret values.
