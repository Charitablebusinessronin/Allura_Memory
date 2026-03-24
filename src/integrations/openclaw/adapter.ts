/**
 * OpenClaw Integration Adapter
 * 
 * Maps OpenClaw tool calls to Ronin Memory kernel operations.
 * Provides Zod-validated input/output for external agent use.
 */

import { searchMemories, getMemoriesByType, searchAgents } from "@/lib/memory/search";
import { storeMemory, promoteMemory, deprecateMemory, archiveMemory } from "@/lib/memory/store";
import { getMemory } from "@/lib/memory/get";
import {
  MemorySearchRequest,
  CreateMemoryRequest,
  GetMemoryRequest,
  MemoryNodeType,
} from "@/lib/memory/types";

/**
 * OpenClaw-compatible tool definitions
 * Each tool wraps the kernel function with Zod validation
 */
export const openclawTools = {
  /**
   * Search memories in the knowledge graph
   */
  memory_search: async (params: unknown) => {
    const request = MemorySearchRequest.parse(params);
    return searchMemories(request);
  },

  /**
   * Store a new memory (creates versioned node)
   */
  memory_store: async (params: unknown) => {
    const request = CreateMemoryRequest.parse(params);
    return storeMemory(request);
  },

  /**
   * Get a specific memory by topic_key
   */
  memory_get: async (params: unknown) => {
    const request = GetMemoryRequest.parse(params);
    return getMemory(request);
  },

  /**
   * Promote a memory from draft to active
   */
  memory_promote: async (params: {
    topic_key: string;
    group_id: string;
    approved_by: string;
    rationale: string;
  }) => {
    return promoteMemory(
      params.topic_key,
      params.group_id,
      params.approved_by,
      params.rationale
    );
  },

  /**
   * Deprecate a memory
   */
  memory_deprecate: async (params: {
    topic_key: string;
    group_id: string;
    reason: string;
  }) => {
    return deprecateMemory(params.topic_key, params.group_id, params.reason);
  },

  /**
   * Archive a memory
   */
  memory_archive: async (params: {
    topic_key: string;
    group_id: string;
  }) => {
    return archiveMemory(params.topic_key, params.group_id);
  },

  /**
   * Get memories by type
   */
  memory_list_by_type: async (params: {
    type: string;
    group_id: string;
    limit?: number;
  }) => {
    return getMemoriesByType(params.type, params.group_id, params.limit || 50);
  },

  /**
   * Search agent definitions
   */
  agent_search: async (params: {
    query: string;
    group_id: string;
  }) => {
    return searchAgents(params.query, params.group_id);
  },
};

/**
 * Tool schema for OpenClaw registration
 */
export const openclawToolSchemas = [
  {
    name: "memory_search",
    description: "Search memories in the knowledge graph with full-text search",
    inputSchema: MemorySearchRequest,
  },
  {
    name: "memory_store",
    description: "Store a new memory (Insight, Entity, Decision, etc.) with versioning",
    inputSchema: CreateMemoryRequest,
  },
  {
    name: "memory_get",
    description: "Retrieve a specific memory by topic_key with optional history",
    inputSchema: GetMemoryRequest,
  },
  {
    name: "memory_promote",
    description: "Promote a memory from draft to active status (requires approval)",
    inputSchema: {
      type: "object",
      properties: {
        topic_key: { type: "string" },
        group_id: { type: "string" },
        approved_by: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["topic_key", "group_id", "approved_by", "rationale"],
    },
  },
  {
    name: "memory_deprecate",
    description: "Deprecate a memory (mark as deprecated)",
    inputSchema: {
      type: "object",
      properties: {
        topic_key: { type: "string" },
        group_id: { type: "string" },
        reason: { type: "string" },
      },
      required: ["topic_key", "group_id", "reason"],
    },
  },
  {
    name: "memory_archive",
    description: "Archive a memory (mark as archived)",
    inputSchema: {
      type: "object",
      properties: {
        topic_key: { type: "string" },
        group_id: { type: "string" },
      },
      required: ["topic_key", "group_id"],
    },
  },
  {
    name: "memory_list_by_type",
    description: "List all memories of a specific type",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: MemoryNodeType.options },
        group_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["type", "group_id"],
    },
  },
  {
    name: "agent_search",
    description: "Search for agent definitions by name or capability",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        group_id: { type: "string" },
      },
      required: ["query", "group_id"],
    },
  },
];

export type OpenClawTools = typeof openclawTools;
export type OpenClawToolName = keyof OpenClawTools;