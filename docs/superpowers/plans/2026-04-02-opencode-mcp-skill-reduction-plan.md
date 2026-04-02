# OpenCode MCP Skill Reduction & Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce overlapping MCP skills and align active `.opencode` guidance to one consistent orchestration model.

**Architecture:** Keep `mcp-docker` as the MCP orchestration skill and `memory-client` as runtime memory behavior guidance. Convert large overlapping skills (`mcp-decision-guide`, `mcp-docker-database`) into minimal deprecation wrappers, then update active prompts/commands to stop referencing deprecated direct DB/Cypher patterns.

**Tech Stack:** Markdown docs, OpenCode agent/skill config, MCP_DOCKER workflows, grep-based policy validation.

---

## File Map

| File | Purpose |
| --- | --- |
| `.opencode/skills/mcp-decision-guide/SKILL.md` | Reduce from broad catalog to deprecation wrapper with canonical redirects. |
| `.opencode/skills/mcp-docker-database/SKILL.md` | Reduce from legacy DB-specific instructions to deprecation wrapper. |
| `.opencode/skills/mcp-docker/SKILL.md` | Canonical MCP orchestration policy (Exa-first research, Tavily fallback, lifecycle). |
| `.opencode/skills/memory-client/SKILL.md` | Canonical runtime memory policy (query past actions, reflect/log outcomes). |
| `.opencode/command/start-session.md` | Remove deprecated skill + legacy direct DB/Cypher tool assumptions. |
| `.opencode/agent/core/openagent.md` | Align core orchestration prompt with canonical policy. |
| `.opencode/agent/core/opencoder.md` | Align coding architecture prompt with canonical policy. |
| `.opencode/agent/subagents/**/*.md` | Sweep active subagents for stale references to deprecated skills/tool patterns. |

---

## Task 1: Reduce `mcp-decision-guide` and `mcp-docker-database` First

**Files:**
- Modify `.opencode/skills/mcp-decision-guide/SKILL.md`
- Modify `.opencode/skills/mcp-docker-database/SKILL.md`

- [ ] **Step 1:** Replace `mcp-decision-guide` body with a minimal deprecation wrapper (target 30-60 lines) that states:
  - deprecated status,
  - redirect to `mcp-docker` for orchestration,
  - Exa-first, Tavily-fallback research policy,
  - redirect to `memory-client` for runtime memory behavior.
- [ ] **Step 2:** Replace `mcp-docker-database` body with a minimal deprecation wrapper that removes hardcoded legacy tool list and redirects to `mcp-docker` lifecycle + project-specific configured tools.
- [ ] **Step 3:** Ensure both files retain valid frontmatter and clear migration notes.
- [ ] **Step 4:** Confirm neither file contains deprecated direct tool examples like `MCP_DOCKER_query_database` or `MCP_DOCKER_read_neo4j_cypher`.

---

## Task 2: Align Canonical Skills (`mcp-docker`, `memory-client`)

**Files:**
- Modify `.opencode/skills/mcp-docker/SKILL.md`
- Modify `.opencode/skills/memory-client/SKILL.md`

- [ ] **Step 1:** Add explicit “research consistency policy” to `mcp-docker`:
  - Exa first: `MCP_DOCKER_web_search_exa`
  - Tavily fallback only when Exa is insufficient
  - lifecycle: `mcp-find -> mcp-config-set -> mcp-add -> mcp-exec`
- [ ] **Step 2:** Add explicit runtime loop to `memory-client`:
  - query past actions first,
  - execute task,
  - reflect and log outcomes.
- [ ] **Step 3:** Ensure examples avoid deprecated direct DB/Cypher tool references in favor of canonical skill responsibilities.

---

## Task 3: Update Active Commands and Core Agents

**Files:**
- Modify `.opencode/command/start-session.md`
- Modify `.opencode/agent/core/openagent.md`
- Modify `.opencode/agent/core/opencoder.md`

- [ ] **Step 1:** Update `start-session` frontmatter to remove deprecated `skill: mcp-docker-memory-system` and use valid active skill references.
- [ ] **Step 2:** Rewrite `start-session` examples to avoid deprecated direct DB/Cypher MCP tool assumptions; keep startup behavior consistent with canonical policy.
- [ ] **Step 3:** In `openagent.md`, enforce:
  - query past actions before implementation,
  - Exa-first research,
  - Tavily fallback,
  - reflection logging.
- [ ] **Step 4:** In `opencoder.md`, apply the same policy with implementation-focused wording.

---

## Task 4: Subagent Sweep for Stale References

**Files:**
- Modify active `.opencode/agent/subagents/**/*.md` where needed

- [ ] **Step 1:** Remove references to deprecated skills (`mcp-docker-memory-system`, etc.).
- [ ] **Step 2:** Remove stale direct-tool snippets that conflict with canonical orchestration.
- [ ] **Step 3:** Preserve each subagent’s role-specific behavior while aligning memory + research policy.

---

## Task 5: Verification and Acceptance Checks

- [ ] **Step 1:** Run banned-pattern checks:
  - `mcp-docker-memory-system`
  - `MCP_DOCKER_query_database`
  - `MCP_DOCKER_read_neo4j_cypher`
- [ ] **Step 2:** Run required-pattern checks:
  - `MCP_DOCKER_web_search_exa`
  - `query past actions`
  - `reflect` / `log outcomes`
  - `mcp-find`, `mcp-config-set`, `mcp-add`, `mcp-exec`
- [ ] **Step 3:** Validate OpenCode starts with the updated configuration guidance and no deprecated-skill dependency in active startup path.

---

## Command Checklist

```bash
grep -Rni "mcp-docker-memory-system\|MCP_DOCKER_query_database\|MCP_DOCKER_read_neo4j_cypher" .opencode --include="*.md"
grep -Rni "MCP_DOCKER_web_search_exa\|query past actions\|reflect\|log outcomes\|mcp-find\|mcp-config-set\|mcp-add\|mcp-exec" .opencode --include="*.md"
```

---

## Done Criteria

- `mcp-decision-guide` and `mcp-docker-database` are reduced and clearly deprecated.
- Canonical behavior is concentrated in `mcp-docker` and `memory-client`.
- `start-session` and core agents no longer teach deprecated patterns.
- Active subagents are aligned with canonical memory + MCP policy.
- Verification checks show banned patterns removed and required patterns present.
