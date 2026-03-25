/**
 * Curator Config and Constants
 * 
 * Defines the allowed tags, display mappings, and configuration.
 */

import { NotionDisplayTagMap, CuratorConfig, DEFAULT_CURATOR_CONFIG } from "./types";

// Notion Insights Database ID (from env with fallback for backwards compatibility)
export const INSIGHTS_DATABASE_ID = process.env.NOTION_INSIGHTS_DB_ID || "9fac87b0-6429-4144-80a4-c34d05bb5d02";

// Confidence threshold for promotion
export const CONFIDENCE_THRESHOLD = 0.7;

// Minimum summary length for promotion
export const MIN_SUMMARY_LENGTH = 40;

// Default pending status
export const DEFAULT_PENDING_STATUS = "Pending Review" as const;

/**
 * CANONICAL TAG GOVERNANCE
 * 
 * CRITICAL ARCHITECTURE RULE:
 * - canonical_tag = system slug (used in Neo4j, PostgreSQL, group_id)
 * - display_tag = human label (used in Notion multi-select)
 * 
 * NEVER use spaces or display labels as group_id.
 * ALWAYS derive display from canonical, not the other way around.
 */
export const ALLOWED_CANONICAL_TAGS = [
  "faith-meats",
  "difference-driven",
  "patriot-awning",
  "global-coding-skills",
] as const;

export type CanonicalTag = typeof ALLOWED_CANONICAL_TAGS[number];

/**
 * Display tag mapping for Notion
 * Maps canonical slugs to human-readable display labels
 */
export const DISPLAY_TAG_MAP: NotionDisplayTagMap = {
  "faith-meats": "Faith meats",
  "difference-driven": "Difference driven",
  "patriot-awning": "Patriot awning",
  "global-coding-skills": "Global coding skills",
};

/**
 * Project name mapping
 * Maps canonical slugs to project names
 */
export const PROJECT_NAME_MAP: Record<string, string> = {
  "faith-meats": "Faith Meats",
  "difference-driven": "Difference Driven",
  "patriot-awning": "Patriot Awning",
  "global-coding-skills": "Global Coding Skills",
};

/**
 * Insight lifecycle statuses
 */
export const INSIGHT_STATUSES = [
  "Proposed",           // New insight, not yet reviewed
  "Pending Review",     // Promoted to Notion, awaiting human review
  "Approved",           // Human approved, AI Accessible = true
  "Rejected",           // Human rejected, do not use
  "Superseded"          // Replaced by newer insight
] as const;

/**
 * Curator schedule options
 */
export const CURATOR_SCHEDULES = {
  hourly: "0 * * * *",      // Every hour
  daily: "0 0 * * *",       // Every day at midnight
  every6hours: "0 */6 * * *" // Every 6 hours
} as const;