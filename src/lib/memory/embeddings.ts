/**
 * Embedding Provider System
 * 
 * Supports Ollama (default), OpenAI, and Voyage embedding providers.
 * All configuration comes from environment variables via config.ts.
 */

import { getConfig, getApiKey } from './config.js';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  provider: 'ollama' | 'openai' | 'voyage';
  dimensions: number;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingConfig {
  provider: 'ollama' | 'openai' | 'voyage';
  model: string;
  baseUrl: string;
  apiKey?: string;
}

/**
 * Get embedding configuration from env
 */
function getEmbeddingConfig(): EmbeddingConfig {
  const config = getConfig();
  
  const provider = config.embeddingProvider;
  const model = config.embeddingModel;
  const baseUrl = config.embeddingBaseUrl;
  
  let apiKey: string | undefined;
  
  if (provider === 'openai') {
    apiKey = getApiKey(undefined, 'OPENAI_API_KEY');
  } else if (provider === 'voyage') {
    apiKey = getApiKey(undefined, 'VOYAGE_API_KEY');
  }
  
  return { provider, model, baseUrl, apiKey };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Get embedding from Ollama
 */
async function getOllamaEmbedding(
  text: string,
  config: EmbeddingConfig
): Promise<EmbeddingResult> {
  const response = await fetch(`${config.baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt: text
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Ollama embedding failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
    );
  }

  const data = await response.json();
  
  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error(`Invalid Ollama response: missing or invalid embedding array`);
  }

  return {
    embedding: data.embedding,
    model: config.model,
    provider: 'ollama',
    dimensions: data.embedding.length
  };
}

/**
 * Get embedding from OpenAI
 */
async function getOpenAIEmbedding(
  text: string,
  config: EmbeddingConfig
): Promise<EmbeddingResult> {
  if (!config.apiKey) {
    throw new Error(
      'OpenAI API key required. Set OPENAI_API_KEY in .env.local'
    );
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      input: text
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI embedding failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
    );
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error(`Invalid OpenAI response: missing data array`);
  }

  const embeddingData = data.data[0];
  
  if (!embeddingData.embedding || !Array.isArray(embeddingData.embedding)) {
    throw new Error(`Invalid OpenAI response: missing or invalid embedding array`);
  }

  return {
    embedding: embeddingData.embedding,
    model: config.model,
    provider: 'openai',
    dimensions: embeddingData.embedding.length,
    usage: data.usage
  };
}

/**
 * Get embedding from Voyage
 */
async function getVoyageEmbedding(
  text: string,
  config: EmbeddingConfig
): Promise<EmbeddingResult> {
  if (!config.apiKey) {
    throw new Error(
      'Voyage API key required. Set VOYAGE_API_KEY in .env.local'
    );
  }

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      input: text
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Voyage embedding failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
    );
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error(`Invalid Voyage response: missing data array`);
  }

  const embeddingData = data.data[0];
  
  if (!embeddingData.embedding || !Array.isArray(embeddingData.embedding)) {
    throw new Error(`Invalid Voyage response: missing or invalid embedding array`);
  }

  return {
    embedding: embeddingData.embedding,
    model: config.model,
    provider: 'voyage',
    dimensions: embeddingData.embedding.length,
    usage: data.usage
  };
}

/**
 * Get embedding for a single text
 */
export async function getEmbedding(text: string): Promise<EmbeddingResult> {
  const config = getEmbeddingConfig();
  
  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Embedding request timed out after 30 seconds`));
    }, 30000);
  });

  // Get embedding with retry and timeout
  const embeddingPromise = retryWithBackoff(async () => {
    switch (config.provider) {
      case 'ollama':
        return await getOllamaEmbedding(text, config);
      case 'openai':
        return await getOpenAIEmbedding(text, config);
      case 'voyage':
        return await getVoyageEmbedding(text, config);
      default:
        throw new Error(`Unsupported embedding provider: ${config.provider}`);
    }
  });

  return Promise.race([embeddingPromise, timeoutPromise]);
}

/**
 * Get embeddings for multiple texts
 */
export async function getEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  return Promise.all(texts.map(text => getEmbedding(text)));
}