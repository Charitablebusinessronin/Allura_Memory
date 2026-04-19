---
name: multi-search
description: Perform comprehensive research by combining multiple search sources - Context7 for documentation, Tavily for web search, and grep for codebases. Use this skill when you need to answer complex technical questions, research libraries/frameworks, find implementation patterns, or gather information from multiple sources to solve problems. This skill automatically coordinates Context7 (library docs), Tavily (web search), and grep (code search) to build complete answers.
---

# Multi-Search

## Overview

This skill combines three powerful search capabilities to provide comprehensive research:
- **Context7** - Up-to-date library documentation and code references
- **Tavily** - Web search for current information, tutorials, and examples  
- **Grep** - Search codebases for implementation patterns and examples

Use this skill when a single search source isn't enough to answer complex technical questions.

## When to Use This Skill

- **Researching libraries/frameworks**: Need docs + examples + real-world usage?
- **Solving implementation problems**: Need to see how others solved similar issues?
- **Understanding APIs**: Need official docs + community examples?
- **Finding patterns**: Need to search your own codebase + external resources?
- **Debugging**: Need docs + error solutions + code examples?

## Core Workflow

### Step 1: Analyze the Query

Determine what information is needed:
- **Library/Framework docs** → Context7
- **Current web info** → Tavily
- **Code patterns** → Grep

### Step 2: Execute Searches

Run searches in parallel using the appropriate tools:

```
# Context7 - Get official documentation
context7_resolve-library-id(libraryName="nextjs", query="app router documentation")
context7_query-docs(libraryId="/vercel/next.js", query="middleware usage patterns")

# Tavily - Search the web
tavily_tavily_search(query="Next.js 15 middleware examples 2025", max_results=10)

# Grep - Search codebase
grep_app_searchGitHub(query="middleware.ts", language=["TypeScript"], repo="vercel/next.js")
```

### Step 3: Synthesize Results

Combine findings into a comprehensive answer:
- Use Context7 for official API and patterns
- Use Tavily for current best practices and tutorials
- Use Grep for real implementation examples

## Search Strategies

### Strategy 1: Library Research

**Goal**: Understand a library or framework thoroughly

**Pattern**:
1. Context7: Resolve library ID and query docs for API reference
2. Tavily: Search for recent tutorials and best practices
3. Grep: Find real-world usage examples on GitHub

**Example**:
```
# Research Zustand state management
context7_resolve-library-id(libraryName="zustand")
context7_query-docs(libraryId="/pmndrs/zustand", query="persist middleware usage")

tavily_tavily_search(query="Zustand persist middleware best practices 2025")

grep_app_searchGitHub(query="create.*persist.*zustand", language=["TypeScript"])
```

### Strategy 2: Problem Solving

**Goal**: Find solutions to specific errors or problems

**Pattern**:
1. Tavily: Search for the error message and solutions
2. Context7: Query docs for proper usage
3. Grep: Find working implementations

**Example**:
```
# Solve "cannot find module" error
tavily_tavily_search(query='TypeScript "cannot find module" error ESNext moduleResolution')

context7_query-docs(libraryId="/microsoft/typescript", query="moduleResolution bundler vs nodeNext")

grep_app_searchGitHub(query="moduleResolution.*bundler", path="tsconfig.json")
```

### Strategy 3: Pattern Discovery

**Goal**: Find how to implement a specific pattern

**Pattern**:
1. Grep: Search for the pattern in popular repos
2. Context7: Understand the official way
3. Tavily: See variations and tradeoffs

**Example**:
```
# Find error handling patterns
grep_app_searchGitHub(
  query="try.*catch.*async function",
  language=["TypeScript"],
  repo="microsoft/vscode"
)

context7_query-docs(libraryId="/microsoft/typescript", query="error handling async await patterns")

tavily_tavily_search(query="TypeScript error handling patterns 2025 best practices")
```

## Complete Examples

### Example 1: Researching Authentication Patterns

```
# Step 1: Get official Next.js Auth docs
context7_resolve-library-id(libraryName="nextjs", query="authentication patterns")
context7_query-docs(libraryId="/vercel/next.js", query="NextAuth.js middleware authentication")

# Step 2: Search for current best practices
tavily_tavily_search(query="Next.js 15 authentication best practices 2025 NextAuth v5", max_results=10)

# Step 3: Find real implementations
grep_app_searchGitHub(query="auth.*middleware.*NextResponse", language=["TypeScript"], path="middleware.ts")

# Step 4: Query NextAuth specifically
context7_query-docs(libraryId="/nextauthjs/next-auth", query="v5 middleware configuration")
```

### Example 2: Debugging an Error

```
# Step 1: Search for the error online
tavily_tavily_search(query='TypeScript "Property X does not exist on type Y" interface extension')

# Step 2: Check TypeScript docs for proper typing
context7_query-docs(libraryId="/microsoft/typescript", query="interface declaration merging module augmentation")

# Step 3: Find how others solved this
grep_app_searchGitHub(query="declare module.*interface.*augmentation", language=["TypeScript"], useRegexp=true)
```

### Example 3: Comparing State Management

```
# Step 1: Get current comparison info
tavily_tavily_search(query="Zustand vs Redux vs Jotai 2025 comparison performance bundle size")

# Step 2: Get Zustand API docs
context7_resolve-library-id(libraryName="zustand")
context7_query-docs(libraryId="/pmndrs/zustand", query="create store persist middleware selectors")

# Step 3: Get Redux Toolkit docs
context7_query-docs(libraryId="/reduxjs/redux-toolkit", query="createSlice createAsyncThunk RTK Query")

# Step 4: Find real usage patterns
grep_app_searchGitHub(query="create.*persist.*zustand", language=["TypeScript"])
grep_app_searchGitHub(query="createSlice.*reducers", language=["TypeScript"])
```

## Tool Reference

### Context7 Tools

#### context7_resolve-library-id

Find a library's Context7 ID for documentation queries.

**Parameters:**
- `libraryName` (string): Library name to search for
- `query` (string): Your specific question/task

**Returns:** Library ID in format `/org/project`

**Example:**
```
context7_resolve-library-id(libraryName="react", query="hooks documentation")
# Returns: /facebook/react
```

#### context7_query-docs

Query a library's documentation.

**Parameters:**
- `libraryId` (string): Context7-compatible ID
- `query` (string): Your question about the library

**Returns:** Documentation excerpts and code examples

**Example:**
```
context7_query-docs(libraryId="/facebook/react", query="useEffect cleanup function examples")
```

### Tavily Tools

#### tavily_tavily_search

Search the web for current information.

**Parameters:**
- `query` (string): Search query - describe the ideal page
- `max_results` (number, optional): Number of results (default: 8)
- `search_depth` (string, optional): 'basic', 'advanced', 'fast', 'ultra-fast'

**Returns:** Clean text from top search results

**Example:**
```
tavily_tavily_search(query="blog post comparing React Query and SWR performance 2025", max_results=10)
```

### Grep Tools

#### grep_app_searchGitHub

Search for code patterns across GitHub repositories.

**Parameters:**
- `query` (string): Code pattern to search for (literal)
- `language` (array, optional): Filter by language (e.g., ["TypeScript"])
- `repo` (string, optional): Specific repository
- `path` (string, optional): File path pattern
- `useRegexp` (boolean, optional): Enable regex patterns

**Returns:** Real code examples from GitHub

**Examples:**
```
# Find useState hook usage
grep_app_searchGitHub(query="useState(0)", language=["TypeScript"])

# Find error boundary patterns
grep_app_searchGitHub(query="componentDidCatch", language=["TypeScript"], repo="facebook/react")

# Find async/await with cleanup
grep_app_searchGitHub(query="(?s)useEffect.*async function", useRegexp=true, language=["TypeScript"])
```

## Best Practices

### Query Construction

**Context7 queries**: Be specific about what you need
- Good: "useEffect cleanup function with async operations"
- Bad: "react hooks"

**Tavily queries**: Describe the ideal page
- Good: "blog post comparing React Query and SWR performance with benchmarks"
- Bad: "React Query vs SWR"

**Grep patterns**: Search for actual code
- Good: `useState(initialState)` or `async function.*await`
- Bad: "how to use useState"

### Parallel Execution

Always run independent searches in parallel for faster results.

### When to Stop Searching

Stop when you have:
- [ ] Official API documentation (Context7)
- [ ] Current context from web (Tavily)
- [ ] Working code examples (Grep)
- [ ] Enough information to answer the question confidently

Don't over-search - 2-3 targeted queries per source usually suffice.

## Search Priority Matrix

| Information Need | Primary Source | Secondary Source | Fallback |
|-----------------|---------------|------------------|----------|
| API Reference | Context7 | Tavily | Grep |
| Current Best Practices | Tavily | Context7 | Grep |
| Implementation Examples | Grep | Tavily | Context7 |
| Error Solutions | Tavily | Grep | Context7 |
| Pattern Discovery | Grep | Context7 | Tavily |
| Performance Comparison | Tavily | Grep | Context7 |
| Migration Guides | Tavily | Context7 | Grep |
| Quick Reference | Context7 | - | - |

## See Also

- Context7: https://context7.com
- Tavily Search: https://tavily.com
- GitHub Search Syntax: https://docs.github.com/en/search-github
