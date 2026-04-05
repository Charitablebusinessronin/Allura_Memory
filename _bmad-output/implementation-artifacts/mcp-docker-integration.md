# MCP_DOCKER Integration Guide

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.


> **Version:** 1.0  
> **Date:** 2026-04-04  
> **Status:** Implementation Guide

---

## Overview

The Model Context Protocol (MCP) provides a standardized way for AI agents to interact with external services. Docker Hub hosts an MCP Catalog with containerized MCP servers that agents can discover, configure, and use.

**Key Insight:** MCP_DOCKER tools bridge agents to external services (Notion, PostgreSQL, Neo4j, etc.) through a standardized protocol.

---

## MCP Server Categories for roninmemory

### 1. **Data Layer** (PostgreSQL + Neo4j)

| Server | Purpose | Priority | Why Needed |
|--------|---------|----------|------------|
| `prisma-postgres` | PostgreSQL ORM access | P1 | Raw event storage (traces) |
| `database-server` | Generic SQL (PostgreSQL/MySQL/SQLite) | P1 | Raw event storage |
| `neo4j` | Official Neo4j MCP server | P1 | Knowledge graph (curated insights) |
| `neo4j-memory` | Neo4j with memory capabilities | P1 | Persistent agent memory |
| `neo4j-cypher` | Cypher query execution | P2 | Advanced graph queries |
| `cockroachdb` | Distributed SQL | P3 | Future scaling |

### 2. **Human Workspace** (Notion)

| Server | Purpose | Priority | Why Needed |
|--------|---------|----------|------------|
| `notion` | Official Notion MCP server | P1 | HITL governance, human approval flows |
| `notion-official` | Same as notion | P1 | Duplicate entry |

### 3. **Research & Discovery** (Web Search)

| Server | Purpose | Priority | Why Needed |
|--------|---------|----------|------------|
| `tavily` | Web search + research | P1 | External documentation lookup |
| `brave-search` | Alternative search | P2 | Fallback search engine |
| `perplexity` | AI-powered research | P2 | Deep research capabilities |
| `exa-web-search` | AI-curated search | P2 | Alternative to Tavily |
| `context7` | Code documentation lookup | P1 | Up-to-date library docs |

### 4. **Development Tools**

| Server | Purpose | Priority | Why Needed |
|--------|---------|----------|------------|
| `github-official` | GitHub API access | P1 | Repository operations, PRs |
| `github` | Community GitHub tools | P2 | Alternative GitHub access |
| `gitlab` | GitLab API access | P3 | Future GitLab support |
| `desktop-commander` | File/terminal operations | P2 | Local automation |

### 5. **Observability**

| Server | Purpose | Priority | Why Needed |
|--------|---------|----------|------------|
| `grafana` | Metrics + incident management | P2 | Monitoring dashboards |
| `elasticsearch` | Log analysis | P3 | Log aggregation |

---

## Agent → MCP Tool Mapping

### MemoryOrchestrator (Primary Coordinator)

**Primary Responsibilities:**
- Discover and configure MCP servers
- Coordinate multi-agent workflows
- Ensure group_id enforcement across all operations

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **MCP Management** | `mcp-find`, `mcp-add`, `mcp-config-set`, `mcp-exec` | Discover, configure, execute MCP servers |
| **Workflow Coordination** | `code-mode` | Combine multiple MCPs into orchestrated workflows |
| **Memory Operations** | `MCP_DOCKER_*_notion-*` | Create pages for workflow artifacts |

**Why:** Needs infrastructure access to set up sessions for other agents.

---

### MemoryArchitect (Design Lead)

**Primary Responsibilities:**
- Create and maintain architectural decision records (ADRs)
- Document system patterns in Notion
- Review and approve design proposals

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Documentation** | `notion-fetch`, `notion-create-pages`, `notion-update-page` | Read/write ADRs, architecture docs |
| **Research** | `tavily-search`, `tavily-research` | Research architectural patterns |
| **Knowledge Graph** | `notion-query-database-view` | Query architectural decisions |

**Why:** Designs architecture, needs to document decisions and research best practices.

---

### MemoryBuilder (Implementation)

**Primary Responsibilities:**
- Implement approved designs
- Write PostgreSQL traces and Neo4j insights
- Execute code combining multiple data sources

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Database** | `mcp-exec` → PostgreSQL operations | Write raw traces |
| **Graph Database** | `mcp-exec` → Neo4j operations | Write curated insights |
| **Code Execution** | `code-mode` | Combine PostgreSQL + Neo4j + MCP logic |
| **Testing** | GitHub tools for CI checks | Validate implementations |

**Why:** Implements infrastructure, needs direct database access and code execution.

---

### MemoryAnalyst (Metrics & Analysis)

**Primary Responsibilities:**
- Analyze memory system performance
- Track knowledge promotion rates
- Generate insights from query patterns

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Query** | `notion-query-database-view`, `notion-query-meeting-notes` | Analyze Notion databases |
| **User Analysis** | `notion-get-users`, `notion-get-teams` | User activity analysis |
| **Discussion** | `notion-get-comments` | Analyze HITL discussion patterns |
| **Research** | `tavily-search` | Research metrics/standards |

**Why:** Analyzes data, needs query and research capabilities.

---

### MemoryScout (Context Discovery)

**Primary Responsibilities:**
- Find relevant context before execution
- Search across documentation and code
- Retrieve standards and patterns

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Search** | `notion-search` | Search internal documentation |
| **Research** | `tavily-search`, `web_search_exa` | Find external resources |
| **Fetch** | `tavily-extract` | Retrieve specific documentation |
| **Context** | `context7` | Get current library documentation |

**Why:** Discovers context, needs comprehensive search across internal and external sources.

---

### MemoryRetriever (Targeted Retrieval)

**Primary Responsibilities:**
- Retrieve specific context on demand
- Minimal search, maximum precision

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Search** | `notion-search` | Find specific docs quickly |

**Why:** Targeted retrieval only, minimal tool footprint.

---

### MemoryChronicler (Documentation)

**Primary Responsibilities:**
- Create and maintain documentation
- Write specifications
- Update ADRs and standards

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **CRUD** | `notion-fetch`, `notion-create-pages`, `notion-update-page` | Full document lifecycle |
| **Database** | `notion-create-database`, `notion-create-view` | Create doc structures |
| **Comment** | `notion-create-comment` | Add review comments |

**Why:** Writes documentation, needs full CRUD on Notion.

---

### MemoryScribe (Specs & Writing)

**Primary Responsibilities:**
- Create specification documents
- Maintain PRDs and tech specs
- Write agent prompts and user-facing copy

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Document** | `notion-fetch`, `notion-create-pages`, `notion-update-page` | Spec management |
| **Template** | `notion-duplicate-page` | Create from templates |

**Why:** Creates specs from templates, needs document duplication.

---

### MemoryCopywriter (Prompt Writing)

**Primary Responsibilities:**
- Write agent prompts
- Create user-facing copy
- Refine documentation language

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Read/Update** | `notion-fetch`, `notion-update-page` | Edit existing copy |

**Why:** Refines existing content, minimal write needs.

---

### MemoryRepoManager (Git Operations)

**Primary Responsibilities:**
- Manage repository structure
- Organize document hierarchy in Notion

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Organization** | `notion-move-pages` | Reorganize docs |
| **GitHub** | `github-official` tools | Repository management |

**Why:** Manages doc organization and git operations.

---

### MemoryInfrastructure (DevOps)

**Primary Responsibilities:**
- Configure MCP servers
- Manage environment variables
- Set up database connections

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **MCP Setup** | `mcp-find`, `mcp-add`, `mcp-config-set`, `mcp-remove` | Configure MCP servers |
| **Database** | `database-server` config | Set up PostgreSQL |
| **Graph** | `neo4j` config | Set up Neo4j |

**Why:** Infrastructure setup requires MCP server configuration.

---

### MemoryValidator (Build Validation)

**Primary Responsibilities:**
- Validate builds
- Run type checks
- Verify contracts

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **CI/CD** | GitHub tools | Build validation |

**Why:** Needs GitHub access for CI validation.

---

### MemoryTester (QA Engineer)

**Primary Responsibilities:**
- Write and run tests
- Validate behavior
- Regression testing

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Testing** | GitHub tools | Run tests in CI |
| **Quality** | `notion-query-database-view` | Track test metrics |

**Why:** Needs GitHub for CI, Notion for metrics.

---

### MemoryGenerator (Agent Generator)

**Primary Responsibilities:**
- Generate new agent definitions
- Create agent prompt templates
- Produce agent configuration files

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Templates** | `notion-fetch`, `notion-duplicate-page` | Generate from templates |

**Why:** Needs template retrieval and duplication.

---

### MemoryOrganizer (Context Organization)

**Primary Responsibilities:**
- Organize context files
- Structure knowledge domains
- Create domain models

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Organization** | `notion-move-pages`, `notion-create-database` | Structure knowledge |

**Why:** Needs to create and organize domain structures.

---

### MemoryGuardian (Code Reviewer)

**Primary Responsibilities:**
- Review code for quality
- Validate architectural patterns
- Ensure group_id enforcement

**MCP Tools Needed:**

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Review** | GitHub tools | Code review in PRs |
| **Docs** | `notion-update-page` | Update standards |

**Why:** Reviews code, needs GitHub and documentation access.

---

## MCP Server Configuration Guide

### Step 1: Discover MCP Servers

```javascript
// Search for PostgreSQL servers
MCP_DOCKER_mcp-find({
  query: "postgres database",
  limit: 10
})

// Search for memory systems
MCP_DOCKER_mcp-find({
  query: "memory knowledge",
  limit: 10
})
```

### Step 2: Add MCP Server

```javascript
// Add Neo4j memory server
MCP_DOCKER_mcp-add({
  name: "neo4j-memory",
  activate: true
})
```

### Step 3: Configure MCP Server

```javascript
// Configure Neo4j connection
MCP_DOCKER_mcp-config-set({
  server: "neo4j-memory",
  config: {
    url: "bolt://localhost:7687",
    username: "neo4j",
    database: "roninmemory"
  }
})
```

### Step 4: Execute MCP Tools

```javascript
// Execute Neo4j query
MCP_DOCKER_mcp-exec({
  name: "neo4j-memory",
  arguments: {
    query: "CREATE (n:Insight {group_id: 'allura-faith-meats'})"
  }
})
```

---

## Current Session MCP Tools

**Available in this session:**

| Tool Category | Tools |
|---------------|-------|
| **Notion** | `notion-fetch`, `notion-search`, `notion-create-*`, `notion-update-*`, `notion-move-pages`, `notion-get-*`, `notion-query-*`, `notion-duplicate-page` |
| **Tavily** | `tavily-search`, `tavily-extract`, `tavily-crawl`, `tavily-map`, `tavily-research` |
| **Exa** | `web_search_exa` |
| **MCP Management** | `mcp-find`, `mcp-add`, `mcp-config-set`, `mcp-remove`, `mcp-exec`, `code-mode` |

**NOT YET CONFIGURED (need to add):**

| Server | Purpose | Config File Needed |
|--------|---------|-------------------|
| `prisma-postgres` | PostgreSQL access | `.env` with DATABASE_URL |
| `neo4j-memory` | Knowledge graph | NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD |
| `github-official` | Repository operations | GITHUB_TOKEN |
| `context7` | Library docs | No secrets needed |

---

## Recommended MVP Configuration

### Phase 1: Core Infrastructure

```javascript
// Add PostgreSQL
MCP_DOCKER_mcp-add({
  name: "prisma-postgres",
  activate: true
})

// Add Neo4j
MCP_DOCKER_mcp-add({
  name: "neo4j-memory",
  activate: true
})

// Configure PostgreSQL
// Read credentials from .env.local file
MCP_DOCKER_mcp-config-set({
  server: "database-server",
  config: {
    // Use environment variable: DATABASE_URL or POSTGRES_PASSWORD
    // Example: postgresql://user:password@host:port/database
    database_url: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER || 'ronin4life'}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'memory'}`
  }
})

// Configure Neo4j
MCP_DOCKER_mcp-config-set({
  server: "neo4j-memory",
  config: {
    url: "bolt://localhost:7687",
    username: "neo4j",
    database: "neo4j"
  }
})
```

### Phase 2: Development Tools

```javascript
// Add GitHub
MCP_DOCKER_mcp-add({
  name: "github-official",
  activate: true
})

// Add Context7 for library docs
MCP_DOCKER_mcp-add({
  name: "context7",
  activate: true
})
```

---

## Security & Credential Management

**Secrets Required:**

| Server | Secret | Environment Variable |
|--------|--------|---------------------|
| `notion` | API Key | `NOTION_API_KEY` |
| `neo4j-memory` | Password | `NEO4J_PASSWORD` |
| `github-official` | PAT | `GITHUB_TOKEN` |
| `tavily` | API Key | `TAVILY_API_KEY` |
| `exa` | API Key | `EXA_API_KEY` |

**Never store secrets in code.** Use environment variables or secure secret management.

---

## Usage Patterns

### Pattern 1: Agent Discovery Workflow

```javascript
// Orchestrator discovers servers
const postgresServers = await MCP_DOCKER_mcp-find({
  query: "postgres",
  limit: 5
});

// Orchestrator adds best server
await MCP_DOCKER_mcp-add({
  name: postgresServers.servers[0].name,
  activate: true
});
```

### Pattern 2: Multi-Tool Agent Workflow

```javascript
// Builder uses code-mode to combine tools
const result = await MCP_DOCKER_code-mode({
  name: "query-memory-system",
  servers: ["prisma-postgres", "neo4j-memory", "notion"]
});

// code-mode creates JavaScript that can:
// 1. Query PostgreSQL for traces
// 2. Query Neo4j for insights
// 3. Create Notion page for human review
```

### Pattern 3: Research + Document Workflow

```javascript
// Scout researches external resources
const research = await MCP_DOCKER_tavily_research({
  input: "multi-agent memory architecture patterns"
});

// Chronicler creates Notion page with findings
await MCP_DOCKER_notion-create-pages({
  parent: { page_id: "architectural-decisions-page-id" },
  pages: [{
    properties: { title: "Research: Multi-Agent Memory" },
    content: research.summary
  }]
});
```

---

## References

- Docker MCP Catalog: https://hub.docker.com/mcp
- MCP Specification: https://spec.modelcontextprotocol.io/
- Neo4j + MCP: https://github.com/neo4j/neo4j-mcp-server
- Notion + MCP: https://github.com/makenotion/notion-mcp-server

---

**Document Status:** ✅ Ready for implementation  
**Next Steps:** Configure Phase 1 MCP servers, test PostgreSQL + Neo4j connectivity