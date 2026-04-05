/**
 * User Configuration File
 * 
 * Like opencode-mem's ~/.config/opencode/opencode-mem.jsonc
 * But for Allura: ~/.config/allura/memory.jsonc
 * 
 * This file is OPTIONAL - all settings can come from .env.local
 * This file OVERRIDES .env.local settings
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface UserMemoryConfig {
  // Multi-tenant
  defaultGroupId?: string;
  
  // Embedding Provider
  embeddingProvider?: 'ollama' | 'openai' | 'voyage';
  embeddingModel?: string;
  embeddingBaseUrl?: string;
  
  // LLM Provider (for auto-capture)
  opencodeProvider?: 'ollama' | 'openai' | 'anthropic';
  opencodeModel?: string;
  opencodeBaseUrl?: string;
  
  // Auto-capture
  autoCaptureEnabled?: boolean;
  autoCaptureLanguage?: string;
  
  // User profile
  userProfileAnalysisInterval?: number;
  profileLearningEnabled?: boolean;
  
  // Similarity
  similarityThreshold?: number;
  
  // Web UI
  webServerEnabled?: boolean;
  webServerPort?: number;
  
  // Governance
  autoPromoteEnabled?: boolean;
  curatorAgentEnabled?: boolean;
  
  // Retention
  traceRetentionDays?: number;
  insightRetentionDays?: number;
}

const USER_CONFIG_PATH = join(homedir(), '.config', 'allura', 'memory.jsonc');

/**
 * Read user configuration file
 * Returns null if file doesn't exist
 */
export function readUserConfig(): UserMemoryConfig | null {
  if (!existsSync(USER_CONFIG_PATH)) {
    return null;
  }
  
  try {
    const content = readFileSync(USER_CONFIG_PATH, 'utf-8');
    // Remove JSONC comments
    const json = content
      .replace(/\/\/.*$/gm, '')  // Single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');  // Multi-line comments
    
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to parse user config:', error);
    return null;
  }
}

/**
 * Write user configuration file
 */
export function writeUserConfig(config: UserMemoryConfig): void {
  const configDir = join(homedir(), '.config', 'allura');
  
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  const jsonc = `{
  // =============================================================================
  // Allura Memory User Configuration
  // This file overrides .env.local settings
  // =============================================================================

  // Multi-tenant default group
  "defaultGroupId": "${config.defaultGroupId || 'allura-default'}",

  // Embedding Provider (ollama, openai, voyage)
  "embeddingProvider": "${config.embeddingProvider || 'ollama'}",
  "embeddingModel": "${config.embeddingModel || 'nomic-embed-text'}",
  "embeddingBaseUrl": "${config.embeddingBaseUrl || 'http://localhost:11434'}",

  // LLM Provider for auto-capture (ollama, openai, anthropic)
  "opencodeProvider": "${config.opencodeProvider || 'ollama'}",
  "opencodeModel": "${config.opencodeModel || 'qwen3:8b'}",
  "opencodeBaseUrl": "${config.opencodeBaseUrl || 'http://localhost:11434'}",

  // Auto-capture from prompts
  "autoCaptureEnabled": ${config.autoCaptureEnabled ?? true},
  "autoCaptureLanguage": "${config.autoCaptureLanguage || 'auto'}",

  // User profile learning
  "userProfileAnalysisInterval": ${config.userProfileAnalysisInterval || 10},
  "profileLearningEnabled": ${config.profileLearningEnabled ?? true},

  // Similarity threshold for deduplication
  "similarityThreshold": ${config.similarityThreshold || 0.75},

  // Web UI
  "webServerEnabled": ${config.webServerEnabled ?? true},
  "webServerPort": ${config.webServerPort || 4748},

  // Governance
  "autoPromoteEnabled": ${config.autoPromoteEnabled ?? false},
  "curatorAgentEnabled": ${config.curatorAgentEnabled ?? true},

  // Retention (days)
  "traceRetentionDays": ${config.traceRetentionDays || 365},
  "insightRetentionDays": ${config.insightRetentionDays || 0}
}`;

  writeFileSync(USER_CONFIG_PATH, jsonc);
  console.log(`✓ Created user config at ${USER_CONFIG_PATH}`);
}

/**
 * Create default user config if it doesn't exist
 */
export function ensureUserConfig(): void {
  if (existsSync(USER_CONFIG_PATH)) {
    return;
  }
  
  const defaultConfig: UserMemoryConfig = {
    defaultGroupId: 'allura-default',
    embeddingProvider: 'ollama',
    embeddingModel: 'nomic-embed-text',
    embeddingBaseUrl: 'http://localhost:11434',
    opencodeProvider: 'ollama',
    opencodeModel: 'qwen3:8b',
    opencodeBaseUrl: 'http://localhost:11434',
    autoCaptureEnabled: true,
    autoCaptureLanguage: 'auto',
    userProfileAnalysisInterval: 10,
    profileLearningEnabled: true,
    similarityThreshold: 0.75,
    webServerEnabled: true,
    webServerPort: 4748,
    autoPromoteEnabled: false,
    curatorAgentEnabled: true,
    traceRetentionDays: 365,
    insightRetentionDays: 0
  };
  
  writeUserConfig(defaultConfig);
}