---
name: code-context-retrieval
description: Semantic code search and context retrieval for OhMyOpenCode. Uses qwen3-embedding:8b to index and search codebase, providing relevant code snippets as context for coding tasks.
---

# Code Context Retrieval

This skill provides semantic code search for OhMyOpenCode, similar to Cursor's codebase indexing.

## How It Works

1. **Indexing**: Code files are embedded using qwen3-embedding:8b (4096-dim vectors)
2. **Storage**: Embeddings stored in Neo4j as `:CodeFile` nodes
3. **Retrieval**: Natural language queries are embedded and matched to code
4. **Context**: Top-K similar code snippets returned as context

## When to Use

- Before implementing a new feature (find similar code)
- Debugging (find where error handling is done)
- Refactoring (find all usages of a pattern)
- Learning codebase (semantic exploration)
- Code review (find related implementations)

## Usage

### Search Code Semantically

```typescript
// Find code related to "circuit breaker pattern"
const results = await searchCode("circuit breaker error handling");
// Returns: src/lib/circuit-breaker/breaker.ts, src/lib/ralph/loop.ts, etc.
```

### Get Context for Task

```typescript
// Before implementing, get relevant context
const context = await getRelevantCode("implement timeout for HTTP requests");
// Returns similar implementations to use as reference
```

## Implementation

The embedding pipeline:

```
Code Files → qwen3-embedding:8b → 4096-dim vectors → Neo4j
                                                     ↓
User Query → qwen3-embedding:8b → Vector similarity → Return top-K
```

## Integration with OhMyOpenCode

OhMyOpenCode can now:

1. **Pre-retrieve context** before answering coding questions
2. **Cross-reference** similar implementations
3. **Suggest patterns** based on existing code
4. **Find edge cases** by searching error handling patterns

## Example Workflow

**User**: "How do I add a new MCP tool?"

**System**:
1. Embed query: "add MCP tool implementation"
2. Search Neo4j for similar code
3. Return: `memory-server.ts`, `mcp.client.ts` as context
4. OhMyOpenCode answers with actual codebase references

## Commands

```bash
# Index codebase
bun scripts/embed-codebase.ts

# Query embeddings (via Neo4j)
docker exec knowledge-neo4j cypher-shell -u neo4j -p 'Kamina2025*' "
  MATCH (c:CodeFile)
  WHERE c.path CONTAINS 'mcp'
  RETURN c.path, substring(c.content, 0, 200)
"
```

## Models

- **Embedding**: qwen3-embedding:8b (Ollama)
- **Dimensions**: 4096
- **Storage**: Neo4j
- **Similarity**: Cosine similarity on vectors
