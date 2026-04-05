# Embedding Provider System

## Overview

Multi-provider embedding system for Allura Memory with Ollama as default. Supports semantic search, similarity matching, and vector operations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Embedding Provider                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  getEmbedding(text) → EmbeddingResult                         │
│  getEmbeddings(texts[]) → EmbeddingResult[]                  │
│                                                               │
└───────────────┬─────────────┬─────────────┬───────────────────┘
                │             │             │
        ┌───────▼─────┐ ┌─────▼──────┐ ┌───▼────────┐
        │   Ollama    │ │   OpenAI   │ │  Voyage    │
        │  (Default)  │ │            │ │            │
        └─────────────┘ └────────────┘ └────────────┘
```

## Configuration

All configuration loaded from `config.ts` (environment variables):

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_PROVIDER` | Provider: `ollama`, `openai`, `voyage` | `ollama` |
| `EMBEDDING_MODEL` | Model name (see supported models) | `nomic-embed-text` |
| `EMBEDDING_BASE_URL` | Ollama base URL | `http://localhost:11434` |
| `OPENAI_API_KEY` | OpenAI API key (required for OpenAI) | - |
| `VOYAGE_API_KEY` | Voyage API key (required for Voyage) | - |

## Supported Models

### Ollama (Default)

- `nomic-embed-text` (768 dimensions) - Default, fast
- `snowflake-arctic-embed` (1024 dimensions) - Better accuracy
- `all-minilm` (384 dimensions) - Lightweight

**API**: `http://localhost:11434/api/embeddings`

```json
POST /api/embeddings
{
  "model": "nomic-embed-text",
  "prompt": "text to embed"
}
```

### OpenAI

- `text-embedding-3-small` (1536 dimensions) - Cost-effective
- `text-embedding-3-large` (3072 dimensions) - High accuracy

**API**: `https://api.openai.com/v1/embeddings`

```json
POST /v1/embeddings
{
  "model": "text-embedding-3-small",
  "input": "text to embed"
}
Authorization: Bearer sk-...
```

### Voyage

- `voyage-3` (1024 dimensions) - High quality

**API**: `https://api.voyageai.com/v1/embeddings`

```json
POST /v1/embeddings
{
  "model": "voyage-3",
  "input": "text to embed"
}
Authorization: Bearer voy-...
```

## Usage

### Basic Usage

```typescript
import { getEmbedding, getEmbeddings } from '@/lib/memory/embeddings';

// Single embedding
const result = await getEmbedding('search query');
console.log(result.dimensions); // 768 (nomic-embed-text)
console.log(result.provider); // 'ollama'

// Multiple embeddings
const results = await getEmbeddings(['query1', 'query2', 'query3']);
console.log(results.length); // 3
```

### Result Structure

```typescript
interface EmbeddingResult {
  embedding: number[];           // Vector array
  model: string;                 // Model name
  provider: 'ollama' | 'openai' | 'voyage';
  dimensions: number;            // Vector size
  usage?: {                      // Token usage (OpenAI/Voyage only)
    prompt_tokens: number;
    total_tokens: number;
  };
}
```

### With Configuration

```typescript
// In .env.local
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-large
OPENAI_API_KEY=sk-your-key-here

// Code
const result = await getEmbedding('test');
// Uses OpenAI with text-embedding-3-large
```

## Error Handling

### Missing API Key

```typescript
// OpenAI
throw new Error('OpenAI API key required. Set OPENAI_API_KEY in .env.local');

// Voyage
throw new Error('Voyage API key required. Set VOYAGE_API_KEY in .env.local');
```

### Network Failures

- **Retry**: Exponential backoff (3 retries)
- **Delay**: 1s → 2s → 4s
- **Timeout**: 30 seconds

```typescript
// Retry logic
attempt 1 → fail → wait 1s
attempt 2 → fail → wait 2s
attempt 3 → fail → throw error
```

### Invalid Responses

```typescript
// Missing embedding
throw new Error('Invalid Ollama response: missing or invalid embedding array');

// HTTP error
throw new Error('Ollama embedding failed: 500 Internal Server Error. {...}');
```

## Testing

### Run Tests

```bash
bun vitest run src/lib/memory/embeddings.test.ts
```

### Manual Testing

```bash
# Ollama (default)
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "test"
}'

# Verify dimensions
bun -e "import { getEmbedding } from './src/lib/memory/embeddings'; getEmbedding('test').then(r => console.log(r.dimensions))"
```

## Implementation Details

### Retry Logic

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw error;
}
```

### Timeout Protection

```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('timeout')), 30000);
});

return Promise.race([embeddingPromise, timeoutPromise]);
```

### Provider Selection

```typescript
switch (config.provider) {
  case 'ollama': return await getOllamaEmbedding(text, config);
  case 'openai': return await getOpenAIEmbedding(text, config);
  case 'voyage': return await getVoyageEmbedding(text, config);
}
```

## Future Enhancements

- [ ] Batch embedding for OpenAI/Voyage (array of texts in single request)
- [ ] Embedding caching layer (avoid re-computing same text)
- [ ] Cost tracking for OpenAI/Voyage token usage
- [ ] Health check endpoint for provider availability
- [ ] Fallback provider chain (Ollama → OpenAI → Voyage)

## Security

- **No hardcoded credentials**: All API keys from environment
- **Clear error messages**: Missing keys show clear setup instructions
- **Network isolation**: Ollama runs locally (no external network calls)
- **API key validation**: Early validation before making requests

## Performance Considerations

| Provider | Latency | Cost | Dimensions | Quality |
|----------|---------|------|------------|---------|
| Ollama (nomic) | ~50ms | Free | 768 | Good |
| Ollama (arctic) | ~100ms | Free | 1024 | Better |
| OpenAI (small) | ~200ms | $0.02/1M tokens | 1536 | Great |
| OpenAI (large) | ~300ms | $0.13/1M tokens | 3072 | Excellent |
| Voyage | ~150ms | $0.12/1M tokens | 1024 | Excellent |

**Recommendation**: Use Ollama (nomic-embed-text) for development, Voyage or OpenAI for production.