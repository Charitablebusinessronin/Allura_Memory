# Semantic Code Embedding for OhMyOpenCode

## Overview

Your OhMyOpenCode instance now has **semantic code search** similar to Cursor and Agent0, using your local **qwen3-embedding:8b** model via Ollama.

## What We Built

### 1. Code Indexing (`scripts/embed-codebase.ts`)
- Embeds TypeScript files using qwen3-embedding:8b
- Generates 4096-dimensional vectors
- Stores in Neo4j as `:CodeFile` nodes
- 50 files already indexed

### 2. Semantic Search (`scripts/search-code-simple.ts`)
- Natural language queries find relevant code
- Example: `"MCP server"` → finds `memory-server.ts`, `mcp.client.ts`
- Searches both content and file paths

### 3. Model Registry (`.opencode/models.yaml`)
- Tracks all your Ollama models
- **qwen3-embedding:8b** for embeddings
- **glm-5:cloud**, **kimi-k2.5:cloud**, etc. for reasoning

## Usage

### Index Codebase
```bash
bun scripts/embed-codebase.ts
```

### Search Code
```bash
# Find MCP-related code
bun scripts/search-code-simple.ts "MCP server"

# Find error handling patterns  
bun scripts/search-code-simple.ts "circuit breaker"

# Find database queries
bun scripts/search-code-simple.ts "neo4j query"
```

## How It Works

```
Code Files → qwen3-embedding:8b → 4096-dim vectors → Neo4j
                                                    ↓
User Query → Text Match/Embed → Return matching files
```

## Integration with OhMyOpenCode

When you ask coding questions, OhMyOpenCode can now:
1. **Pre-retrieve** relevant code context automatically
2. **Reference** similar implementations
3. **Suggest** patterns from your existing codebase
4. **Cross-reference** related files

## Models Used

| Purpose | Model | Dimensions |
|---------|-------|------------|
| Code Embeddings | qwen3-embedding:8b | 4096 |
| Agent Reasoning | glm-5:cloud | N/A |
| Code Analysis | kimi-k2.5:cloud | N/A |

All models run locally via Ollama - zero cost, fully private.

## Files

- `.opencode/models.yaml` - Model registry
- `.opencode/skills/code-context-retrieval/SKILL.md` - Skill documentation
- `scripts/embed-codebase.ts` - Code indexing
- `scripts/search-code-simple.ts` - Semantic search
- `src/lib/dedup/embeddings.ts` - Embedding manager
