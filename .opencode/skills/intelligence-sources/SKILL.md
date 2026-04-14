---
name: intelligence-sources
description: Comprehensive reference for Team RAM's three research/intelligence tools — Context7 (official docs), prompts.chat (AI instruction patterns), and grep-mcp (real GitHub code). Teaches agents which tool to use, when, and how. Include the priority matrix, dispatch map, workflow patterns, and quick reference for all three sources plus Tavily as fallback.
---

# Intelligence Sources — Team RAM Research Toolkit

## Complementarity — The Three-Tool Triad

No single research tool covers every need. These three sources form a complementary triad:

| Tool             | Answers                              | Analogy                            |
| ---------------- | ------------------------------------ | ---------------------------------- |
| **Context7**     | "What does the API officially say?"  | The reference manual               |
| **prompts.chat** | "How do people instruct AI to do X?" | The cookbook of agent recipes      |
| **grep-mcp**     | "How do people actually code X?"     | The corpus of real implementations |

**Context7** gives you canonical, version-pinned documentation — the ground truth of what a library supports. **prompts.chat** gives you battle-tested AI instruction patterns — how practitioners shape agent behavior. **grep-mcp** gives you real, running code — what actually works in production.

When all three agree, you have high confidence. When they disagree, investigate — the gap is usually where bugs or deprecated patterns hide. **Tavily** (via MCP_DOCKER_tavily_search) serves as the fallback for current events, blog posts, and recent best practices that haven't yet reached official docs.

For automated multi-source orchestration, use the `multi-search` skill — it coordinates Context7, Tavily, and grep in a single workflow.

---

## Priority Matrix

When you need information, pick the right primary source. Fall back to others when the primary is insufficient.

| Info Need              | Context7    | prompts.chat    | grep-mcp    | Tavily     |
| ---------------------- | ----------- | --------------- | ----------- | ---------- |
| Official API           | ✅ Primary  | —               | —           | Fallback   |
| AI agent instructions  | —           | ✅ Primary      | —           | Fallback   |
| Real code examples     | —           | —               | ✅ Primary  | Fallback   |
| Current best practices | Fallback    | Fallback        | Fallback    | ✅ Primary |
| Library/Framework docs | ✅ Context7 | —               | Grep        | Tavily     |
| Debugging solutions    | Tavily      | Grep            | ✅ Context7 | —          |
| Pattern discovery      | Grep        | Context7        | ✅ Tavily   | —          |
| Prompt engineering     | —           | ✅ prompts.chat | —           | —          |

**Reading the matrix:** Row = what you need. Cell = which tool to use. `✅ Primary` = go here first. Named tool = strong secondary. `Fallback` = use if primary is empty.

---

## Team RAM Dispatch Map

Each agent has preferred intelligence sources based on their role. Use this map to decide which tools to invoke.

| Agent         | Context7 Use                       | prompts.chat Use                 | grep-mcp Use                            |
| ------------- | ---------------------------------- | -------------------------------- | --------------------------------------- |
| **Brooks**    | Architecture docs before decisions | Save/improve arch review prompts | Reference architectures in top repos    |
| **Woz**       | API signatures before writing code | Implementation templates         | Real code examples before building      |
| **Scout**     | Fast library resolution            | Prompt/skill discovery           | Codebase scans for patterns             |
| **Bellard**   | Version-diff debugging             | Debugging agent prompts          | Bug fix patterns in similar repos       |
| **Knuth**     | Schema/driver docs                 | Data modeling prompts            | Migration patterns, SQL examples        |
| **Fowler**    | Deprecation detection              | Refactor instruction improvement | Before/after refactoring examples       |
| **Pike**      | API surface validation             | API design skills                | Interface contract patterns             |
| **Carmack**   | Optimization API docs              | Optimization prompt templates    | Performance patterns in high-perf repos |
| **Hightower** | Infra tool docs                    | Deployment/CI skills             | Docker/K8s config patterns              |
| **Jobs**      | —                                  | Validate gate prompts            | Scope management patterns               |

---

## Tool Reference

### 1. Context7 — Official Library Documentation

Context7 provides version-locked, authoritative documentation from library maintainers. Use it when you need the canonical answer.

**Workflow:** Resolve the library ID first, then fetch docs by ID.

#### Resolve Library ID

Before fetching docs, resolve the library name to a Context7-compatible ID.

```
MCP_DOCKER_resolve-library-id(libraryName="next.js")
# Returns: { id: "/vercel/next.js", trust: 10, snippets: 2306, ... }
```

Always resolve first — library IDs follow `/org/project` format and are not always guessable. The resolver returns trust scores and snippet counts to help you pick the right library when multiple matches exist.

#### Fetch Library Docs

Once you have the ID, fetch documentation focused on your topic.

```
MCP_DOCKER_get-library-docs(
  context7CompatibleLibraryID="/vercel/next.js",
  topic="server actions",
  tokens=5000
)
```

**Parameters:**

- `context7CompatibleLibraryID` (required) — The ID from resolve-library-id, e.g. `/vercel/next.js`
- `topic` (optional) — Focus the docs on this subject (e.g., `"middleware"`, `"server actions"`)
- `tokens` (optional) — Max tokens to return. Default 10000. Use lower values (2000-5000) for focused queries, higher (10000+) for broad exploration.

**When to use Context7:**

- Before writing code that calls a library API — verify signatures and return types
- Before designing an integration — understand the official interface contract
- When debugging — check if you're using the API correctly according to docs
- When evaluating architecture decisions — get the canonical feature set

### 2. prompts.chat — AI Instruction Patterns

prompts.chat is a registry of prompts and skills for AI agents. Use it when you need to understand how practitioners instruct AI, or when you want to improve your own prompts.

#### Search Prompts

Search for prompts by keyword, type, category, or tags.

```
prompts_chat_search_prompts(query="code review", limit=10)
prompts_chat_search_prompts(query="refactoring", category="development", limit=10)
prompts_chat_search_prompts(query="debugging", type="STRUCTURED", tag="agent")
```

**Parameters:**

- `query` (required) — Search query
- `limit` (optional) — Max results (default 10, max 50)
- `category` (optional) — Filter by category slug
- `tag` (optional) — Filter by tag slug
- `type` (optional) — Filter by type: TEXT, STRUCTURED, IMAGE, VIDEO, AUDIO

#### Get Prompt

Retrieve a specific prompt by ID. Optionally fill template variables.

```
prompts_chat_get_prompt(id="prompt_id")
prompts_chat_get_prompt(id="prompt_id", fill_variables=true)
```

#### Improve Prompt

Transform a basic prompt into a well-structured, comprehensive one using AI.

```
prompts_chat_improve_prompt(
  prompt="Review this code for bugs",
  outputType="text",
  outputFormat="structured_json"
)
```

**Parameters:**

- `prompt` (required) — The basic prompt to enhance
- `outputType` (optional) — Content type: "text", "image", "video", "sound"
- `outputFormat` (optional) — Response format: "text", "structured_json", "structured_yaml"

#### Save Prompt

Create and store your own prompts for team reuse.

```
prompts_chat_save_prompt(
  title="Allura Code Review Gate",
  content="Review the following diff for...",
  description="Code review prompt for Allura team",
  category="development",
  tags=["code-review", "allura", "gate"],
  type="TEXT"
)
```

#### Search Skills

Discover multi-file agent skill packages (SKILL.md + scripts + config).

```
prompts_chat_search_skills(query="deployment", limit=10)
```

#### Get Skill

Retrieve a full skill package by ID, including all files.

```
prompts_chat_get_skill(id="skill_id")
```

#### Save Skill

Publish a skill to the registry for team or community reuse.

```
prompts_chat_save_skill(
  title="Allura Debugging Workflow",
  description="Systematic debugging with memory integration",
  files=[
    { filename: "SKILL.md", content: "..." },
    { filename: "scripts/debug.sh", content: "..." }
  ],
  tags=["debugging", "allura"]
)
```

#### Skill File Operations

Manage files within an existing skill:

```
prompts_chat_add_file_to_skill(skillId="id", filename="reference.md", content="...")
prompts_chat_update_skill_file(skillId="id", filename="SKILL.md", content="...")
prompts_chat_remove_file_from_skill(skillId="id", filename="reference.md")
```

**When to use prompts.chat:**

- Designing agent instructions or prompts — learn from existing patterns
- Looking for skill templates — find multi-file agent skill packages
- Improving a draft prompt — use `improve_prompt` for AI-assisted refinement
- Creating reusable team prompts — save and share across agents
- Discovering how others solve problems with AI — community knowledge

### 3. grep-mcp — Real GitHub Code Search

grep-mcp searches GitHub's public code corpus. Use it when you need real, working implementations.

#### Search Code

```
grep-mcp_grep_query(
  query="SUPERSEDES relationship",
  language="TypeScript"
)
```

```
grep-mcp_grep_query(
  query="createStore.*persist",
  repo="pmndrs/zustand"
)
```

**Parameters:**

- `query` (required) — Search query. Supports literal strings and regex patterns.
- `language` (optional) — Filter by programming language (e.g., `"TypeScript"`, `"Python"`)
- `repo` (optional) — Filter to a specific repo in `owner/repo` format (e.g., `"vercel/next.js"`)
- `path` (optional) — Filter by file path pattern (e.g., `"src/lib/"`)

**Tips for effective grep queries:**

- Use specific code patterns, not natural language: `"useServer.*export"` not "how to use server actions"
- Combine with `repo` to narrow results: `"middleware"` in `vercel/next.js` is more useful than everywhere
- Use `language` to filter noise: always specify `"TypeScript"` for Allura's stack
- `path` is powerful for finding config patterns: `path="tsconfig.json"` for TypeScript config

**When to use grep-mcp:**

- Before building — find real implementations of the pattern you need
- When debugging — find working code that doesn't have your bug
- During review — verify your pattern matches production usage in top repos
- For discovery — see how popular projects structure similar features

---

## Allura Memory — Pre-Resolved Context7 Libraries

These libraries are pre-resolved for Allura's stack. Use their IDs directly — no need to resolve again.

| Library       | Context7 ID                             | Trust | Snippets | Use For                                 |
| ------------- | --------------------------------------- | ----- | -------- | --------------------------------------- |
| Next.js       | `/vercel/next.js`                       | 10    | 2,306    | Server actions, App Router, middleware  |
| Neo4j         | `/websites/neo4j`                       | 10    | 1,090    | General graph DB reference              |
| Neo4j APOC    | `/websites/neo4j_apoc_current`          | 10    | 1,428    | APOC procedures (SUPERSEDES versioning) |
| Neo4j Cypher  | `/websites/neo4j_cypher-manual_current` | 10    | 2,772    | Cypher queries                          |
| Neo4j Drivers | `/neo4j/docs-drivers`                   | 9     | 1,313    | JS/TS driver connections                |
| Zustand       | `/pmndrs/zustand`                       | 9.6   | 453      | State management patterns               |

**Usage example — fetch Neo4j APOC docs for SUPERSEDES versioning:**

```
MCP_DOCKER_get-library-docs(
  context7CompatibleLibraryID="/websites/neo4j_apoc_current",
  topic="SUPERSEDES versioning",
  tokens=5000
)
```

---

## Workflow Patterns

### Pattern 1: Library Research (Woz, Knuth, Carmack)

Use when you need to understand a library before writing code that uses it.

1. **Context7** — Resolve library ID → fetch docs for API reference
2. **grep-mcp** — Find real-world usage examples on GitHub
3. **Tavily** — Search for recent tutorials and best practices

**Example:** Researching Zustand persist middleware

```
# Step 1: Get official docs
MCP_DOCKER_resolve-library-id(libraryName="zustand")
MCP_DOCKER_get-library-docs(context7CompatibleLibraryID="/pmndrs/zustand", topic="persist middleware", tokens=3000)

# Step 2: Find real implementations
grep-mcp_grep_query(query="persist.*create", language="TypeScript", repo="pmndrs/zustand")

# Step 3: Get current best practices
MCP_DOCKER_tavily_search(query="Zustand persist middleware TypeScript best practices 2025")
```

### Pattern 2: Agent Instruction Design (Brooks, Jobs, Fowler)

Use when designing, improving, or validating AI agent prompts and skills.

1. **prompts.chat** — Search for similar agent role prompts
2. **prompts.chat** — Improve your draft prompt with `improve_prompt`
3. **prompts.chat** — Save the refined prompt for team reuse

**Example:** Creating an architecture review prompt

```
# Step 1: Find existing patterns
prompts_chat_search_prompts(query="architecture review", limit=10)
prompts_chat_search_prompts(query="code review gate", category="development", limit=5)

# Step 2: Improve your draft
prompts_chat_improve_prompt(
  prompt="Review this architecture for scalability and maintainability issues",
  outputType="text",
  outputFormat="structured_json"
)

# Step 3: Save for team reuse
prompts_chat_save_prompt(
  title="Allura Architecture Review Gate",
  content="[improved prompt content]",
  description="Architecture review prompt for Allura team",
  tags=["architecture", "review", "allura"]
)
```

### Pattern 3: Bug Investigation (Bellard, Scout)

Use when debugging an error or unexpected behavior.

1. **Tavily** — Search for the error message and solutions
2. **Context7** — Query docs for proper API usage
3. **grep-mcp** — Find working implementations that don't have the bug

**Example:** Debugging a Neo4j driver connection error

```
# Step 1: Search for solutions
MCP_DOCKER_tavily_search(query="Neo4j Bolt connection refused ECONNREFUSED TypeScript driver")

# Step 2: Check official docs
MCP_DOCKER_get-library-docs(context7CompatibleLibraryID="/neo4j/docs-drivers", topic="connection configuration", tokens=3000)

# Step 3: Find working implementations
grep-mcp_grep_query(query="Neo4j.*driver.*session", language="TypeScript")
```

### Pattern 4: Pattern Discovery (Fowler, Pike)

Use when evaluating architectural patterns or interface designs.

1. **grep-mcp** — Search for the pattern in popular repos
2. **Context7** — Understand the official way
3. **prompts.chat** — See how others instruct AI on this pattern

**Example:** Evaluating repository pattern for data access

```
# Step 1: Find real implementations
grep-mcp_grep_query(query="class.*Repository.*findById", language="TypeScript")
grep-mcp_grep_query(query="interface.*Repository", language="TypeScript", path="src/repositories/")

# Step 2: Get official guidance
MCP_DOCKER_resolve-library-id(libraryName="typescript")
MCP_DOCKER_get-library-docs(context7CompatibleLibraryID="/microsoft/typescript", topic="interface generics patterns", tokens=3000)

# Step 3: Find AI instruction patterns
prompts_chat_search_prompts(query="repository pattern design", limit=10)
prompts_chat_search_skills(query="data architecture", limit=5)
```

---

## Quick Reference

Copy-paste ready invocations for fast access.

```
# ── Context7 — Current library docs ──────────────────────────────
MCP_DOCKER_resolve-library-id(libraryName="next.js")
MCP_DOCKER_get-library-docs(context7CompatibleLibraryID="/vercel/next.js", topic="server actions", tokens=5000)
MCP_DOCKER_get-library-docs(context7CompatibleLibraryID="/websites/neo4j_cypher-manual_current", topic="MERGE CREATE", tokens=3000)
MCP_DOCKER_get-library-docs(context7CompatibleLibraryID="/websites/neo4j_apoc_current", topic="SUPERSEDES versioning", tokens=3000)

# ── prompts.chat — AI prompt/skill discovery ─────────────────────
prompts_chat_search_prompts(query="code review", limit=10)
prompts_chat_search_prompts(query="debugging agent", category="development", limit=10)
prompts_chat_get_prompt(id="prompt_id")
prompts_chat_improve_prompt(prompt="basic prompt text", outputType="text", outputFormat="text")
prompts_chat_search_skills(query="debugging", limit=10)
prompts_chat_save_prompt(title="Title", content="...", tags=["tag"])

# ── grep-mcp — GitHub code search ───────────────────────────────
grep-mcp_grep_query(query="SUPERSEDES relationship", language="TypeScript")
grep-mcp_grep_query(query="createStore.*persist", repo="pmndrs/zustand")
grep-mcp_grep_query(query="middleware.*NextResponse", language="TypeScript", path="middleware.ts")
```

---

## Rate Limits & Quirks

### Context7

- **API key:** `CONTEXT7_API_KEY` is configured in `.env.local` — no manual setup needed.
- **Token budget:** Default 10000 tokens per query. Use `tokens` param to control cost vs. detail. 2000-5000 for focused queries; 10000+ for broad exploration.
- **Trust scores:** Libraries with trust ≥ 9 are production-grade. Those below may have incomplete or outdated docs.
- **Quirk:** Always call `resolve-library-id` first — IDs follow `/org/project` format and are not always guessable. Ambiguous names (e.g., "react" vs "react-native") require resolution.
- **Quirk:** When multiple libraries match, pick the one with the highest trust score and snippet count.

### prompts.chat

- **Rate limit:** Standard API rate limits apply. No hard cap documented, but batch operations rather than rapid-fire individual calls.
- **Quirk:** `search_prompts` and `search_skills` return metadata only. Use `get_prompt` or `get_skill` to retrieve full content.
- **Quirk:** `improve_prompt` is AI-powered and may take a few seconds — it's worth the wait for complex prompts.
- **Quirk:** Saved prompts are private by default. Set `isPrivate: false` to share with the team.
- **Strengths beyond search:** The `quality.check()` SDK, semantic search at `/api/search/ai`, prompt builder, and similarity/dedup features are available through prompts.chat but not directly through MCP tools. Use the platform UI for advanced features.

### grep-mcp

- **Rate limit:** ~10 requests per minute on the free tier. Batch your searches — target them carefully rather than spraying broad queries.
- **Quirk:** Returns a maximum of 10 results per query. Narrow with `language`, `repo`, and `path` filters to get the most relevant 10.
- **Quirk:** Regex support varies — simple patterns work reliably. Complex lookaheads may not.
- **Quirk:** GitHub's index may lag up to 24 hours behind live repos. Brand-new code may not appear immediately.
- **Strategy:** Start with broad queries to discover patterns, then narrow with `repo` and `path` for specific implementations.

### Tavily (Fallback)

- **Rate limit:** 20 requests per minute via MCP_DOCKER.
- **Depth options:** `basic` for quick lookups, `advanced` for thorough research, `fast` for low-latency needs.
- **Best for:** Current events, blog posts, tutorials, changelog entries, and anything too recent for Context7 or grep-mcp.

---

## Automated Orchestration

For multi-source research without manual tool selection, use the `multi-search` skill. It automatically coordinates Context7, Tavily, and grep to build comprehensive answers from all three sources.

**When to use `multi-search` instead of manually picking tools:**

- Complex research questions that span official docs, community knowledge, and real code
- When you're unsure which source has the best answer
- When you need a comprehensive answer synthesizing all perspectives

**When to pick tools manually (using this skill):**

- You know exactly which source you need (e.g., just Context7 for API signatures)
- Rate limit conservation matters (manual selection uses fewer API calls)
- You need precise control over query parameters
- You're following a specific workflow pattern from the dispatch map above
