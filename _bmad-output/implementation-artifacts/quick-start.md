# Allura Memory - Quick Start Guide

## Setup (Like opencode-mem)

### Step 1: Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# PostgreSQL
POSTGRES_PASSWORD=your-postgres-password

# Neo4j
NEO4J_PASSWORD=your-neo4j-password

# For local Ollama (default)
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

# For OpenAI embeddings (optional)
# EMBEDDING_PROVIDER=openai
# EMBEDDING_MODEL=text-embedding-3-small
# OPENAI_API_KEY=sk-your-key
```

### Step 2: Pull Embedding Model (Ollama)

```bash
# Pull the embedding model (274MB)
ollama pull nomic-embed-text

# Verify it works
ollama run nomic-embed-text "test embedding"
```

### Step 3: Optional User Config (Like opencode-mem)

Create `~/.config/allura/memory.jsonc`:

```jsonc
{
  // Multi-tenant default
  "defaultGroupId": "my-project",

  // Use local Ollama for embeddings
  "embeddingProvider": "ollama",
  "embeddingModel": "nomic-embed-text",

  // Use local Qwen3 for auto-capture
  "opencodeProvider": "ollama",
  "opencodeModel": "qwen3:8b",

  // Auto-capture memories from prompts
  "autoCaptureEnabled": true,

  // Web UI port
  "webServerPort": 4748
}
```

### Step 4: Start the Server

```bash
npm run dev
# or
bun dev
```

Open: http://localhost:4748/memory

---

## Usage (API)

### Add a Memory

```bash
curl -X POST http://localhost:3000/api/memory/traces \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "my-project",
    "type": "memory",
    "content": "User prefers dark mode for UI",
    "agent": "claude"
  }'
```

### Search Memories

```bash
curl "http://localhost:3000/api/memory/search?group_id=my-project&query=dark+mode"
```

### Get Raw Traces

```bash
curl "http://localhost:3000/api/memory/traces?group_id=my-project&limit=10"
```

### Propose for Promotion (HITL)

```bash
curl -X POST http://localhost:3000/api/memory/promotions \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "my-project",
    "trace_id": "abc-123",
    "content": "User prefers dark mode - proposed as workflow pattern"
  }'
```

---

## Usage (Plugin Interface)

If using as an OpenCode plugin (opencode-mem compatible):

```typescript
// In your OpenCode plugin
import { memory } from 'allura-memory';

// Add memory
await memory({
  mode: 'add',
  content: 'Project uses microservices architecture',
  group_id: 'my-project'
});

// Search memories
const results = await memory({
  mode: 'search',
  query: 'architecture decisions',
  group_id: 'my-project'
});

// Get profile
const profile = await memory({
  mode: 'profile',
  group_id: 'my-project'
});

// List memories
const memories = await memory({
  mode: 'list',
  limit: 10,
  group_id: 'my-project'
});
```

---

## Supported Embedding Models

| Provider | Models | Dimensions | Notes |
|---------|--------|------------|-------|
| **Ollama** | `nomic-embed-text` | 768 | ✅ Recommended, local |
| **Ollama** | `snowflake-arctic-embed` | 1024 | Alternative |
| **Ollama** | `all-minilm` | 384 | Smaller, faster |
| **OpenAI** | `text-embedding-3-small` | 1536 | Remote API |
| **OpenAI** | `text-embedding-3-large` | 3072 | Better quality |
| **Voyage** | `voyage-3` | 1024 | Alternative provider |

---

## Configuration Priority

1. **User config** (`~/.config/allura/memory.jsonc`) - highest priority
2. **Environment variables** (`.env.local`)
3. **Default values** (built-in)

---

## Comparison with opencode-mem

| Feature | opencode-mem | Allura |
|---------|--------------|--------|
| Config location | `~/.config/opencode/opencode-mem.jsonc` | `~/.config/allura/memory.jsonc` |
| Environment file | None | `.env.local` |
| Storage backend | SQLite + USearch | PostgreSQL + Neo4j |
| Embeddings | Local Transformers.js | Ollama / OpenAI / Voyage |
| Auto-capture | ✅ | ✅ |
| User profile | ✅ | ✅ |
| Multi-tenant | ❌ | ✅ (`group_id`) |
| Governance | ❌ | ✅ (HITL) |
| Versioning | ❌ | ✅ (SUPERSEDES) |
| Web UI port | 4747 | 4748 |

---

## Environment Variable Reference

```bash
# PostgreSQL
POSTGRES_HOST=localhost              # Required
POSTGRES_PORT=5432                  # Default: 5432
POSTGRES_DB=memory                  # Default: memory
POSTGRES_USER=ronin4life           # Default: ronin4life
POSTGRES_PASSWORD=your-password     # Required

# Neo4j
NEO4J_URI=bolt://localhost:7687     # Required
NEO4J_USER=neo4j                    # Default: neo4j
NEO4J_PASSWORD=your-password        # Required

# Multi-tenant
DEFAULT_GROUP_ID=allura-default     # Default: allura-default

# Embeddings
EMBEDDING_PROVIDER=ollama           # ollama | openai | voyage
EMBEDDING_MODEL=nomic-embed-text    # Model name
EMBEDDING_BASE_URL=http://localhost:11434  # For Ollama

# LLM (for auto-capture)
OPENCODE_PROVIDER=ollama            # ollama | openai | anthropic
OPENCODE_MODEL=qwen3:8b             # Model name
OPENCODE_BASE_URL=http://localhost:11434

# For OpenAI/Anthropic (optional)
OPENAI_API_KEY=sk-your-key          # If using OpenAI
ANTHROPIC_API_KEY=your-key          # If using Anthropic

# Auto-capture
AUTO_CAPTURE_ENABLED=true           # Enable/disable

# Web UI
WEB_SERVER_ENABLED=true             # Enable UI
WEB_SERVER_PORT=4748                # UI port

# Retention
TRACE_RETENTION_DAYS=365            # Days to keep raw traces
```