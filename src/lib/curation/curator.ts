/**
 * Curator Agent Orchestration
 * Story 1.7: Automated Knowledge Curation
 * 
 * Main orchestrator for the Curator agent that:
 * 1. Scans PostgreSQL traces for patterns
 * 2. Generates draft insights
 * 3. Flags for human approval
 */

import { detectPatterns, getPatternStats, type DetectedPattern, PatternDetectionError } from "./pattern-detector";
import { generateDraftInsights, createDraftInsights, summarizeDraft, calculateDraftQuality, type DraftInsight } from "./insight-generator";
import type { InsightRecord } from "../neo4j/queries/insert-insight";

/**
 * Curator run options
 */
export interface CuratorOptions {
  /** Required: Group ID for tenant isolation */
  group_id: string;
  /** Optional: Minimum frequency for pattern detection */
  min_frequency?: number;
  /** Optional: Minimum success rate for patterns */
  min_success_rate?: number;
  /** Optional: Minimum confidence for draft creation */
  min_confidence?: number;
  /** Optional: Maximum drafts to create */
  max_drafts?: number;
  /** Optional: Lookback period in days */
  lookback_days?: number;
  /** Optional: Dry run (don't actually create insights) */
  dry_run?: boolean;
}

/**
 * Curator run result
 */
export interface CuratorResult {
  /** Group ID processed */
  group_id: string;
  /** Patterns detected */
  patterns_detected: number;
  /** Drafts generated */
  drafts_generated: number;
  /** Drafts created (stored in Neo4j) */
  drafts_created: number;
  /** Created insights (if not dry run) */
  insights: InsightRecord[];
  /** Summary of each draft */
  summaries: string[];
  /** Average quality of drafts */
  avg_quality: number;
  /** Run timestamp */
  timestamp: Date;
  /** Errors encountered */
  errors: string[];
  /** Whether this was a dry run */
  dry_run: boolean;
}

/**
 * Curator statistics
 */
export interface CuratorStats {
  group_id: string;
  total_patterns: number;
  total_events: number;
  avg_success_rate: number;
  avg_frequency: number;
  top_event_types: string[];
}

/**
 * Curator error
 */
export class CuratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CuratorError";
  }
}

/**
 * Run the Curator agent for a group
 * Scans traces, detects patterns, and creates draft insights
 * 
 * @param options - Curator options
 * @returns Curator result
 */
export async function runCurator(options: CuratorOptions): Promise<CuratorResult> {
  if (!options.group_id || options.group_id.trim().length === 0) {
    throw new CuratorError("group_id is required and cannot be empty");
  }

  const errors: string[] = [];
  const startTime = new Date();

  try {
    // Step 1: Detect patterns from traces
    const patterns = await detectPatterns({
      group_id: options.group_id,
      min_frequency: options.min_frequency,
      min_success_rate: options.min_success_rate,
      lookback_days: options.lookback_days,
      limit: options.max_drafts ? options.max_drafts * 2 : 100, // Detect more than we'll create
    });

    // Step 2: Generate draft insights from patterns
    const drafts = generateDraftInsights(patterns, {
      min_confidence: options.min_confidence,
      max_drafts: options.max_drafts,
    });

    // Step 3: Calculate summaries and quality
    const summaries = drafts.map(summarizeDraft);
    const avgQuality = drafts.length > 0
      ? drafts.reduce((sum, d) => sum + calculateDraftQuality(d), 0) / drafts.length
      : 0;

    // Step 4: Create insights (if not dry run)
    let createdInsights: InsightRecord[] = [];
    if (!options.dry_run && drafts.length > 0) {
      createdInsights = await createDraftInsights(drafts);
    }

    return {
      group_id: options.group_id,
      patterns_detected: patterns.length,
      drafts_generated: drafts.length,
      drafts_created: createdInsights.length,
      insights: createdInsights,
      summaries,
      avg_quality: Math.round(avgQuality * 100) / 100,
      timestamp: startTime,
      errors,
      dry_run: options.dry_run ?? false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    return {
      group_id: options.group_id,
      patterns_detected: 0,
      drafts_generated: 0,
      drafts_created: 0,
      insights: [],
      summaries: [],
      avg_quality: 0,
      timestamp: startTime,
      errors,
      dry_run: options.dry_run ?? false,
    };
  }
}

/**
 * Run Curator for multiple groups
 * Useful for batch processing
 * 
 * @param groupIds - Array of group IDs
 * @param options - Common curator options (group_id will be overridden)
 * @returns Array of curator results
 */
export async function runCuratorBatch(
  groupIds: string[],
  options: Omit<CuratorOptions, "group_id"> = {}
): Promise<CuratorResult[]> {
  const results: CuratorResult[] = [];

  for (const groupId of groupIds) {
    const result = await runCurator({
      ...options,
      group_id: groupId,
    });
    results.push(result);
  }

  return results;
}

/**
 * Get curator statistics for a group
 * 
 * @param groupId - Group ID
 * @returns Curator statistics
 */
export async function getCuratorStatistics(groupId: string): Promise<CuratorStats> {
  return getPatternStats(groupId);
}

/**
 * Preview what drafts would be created without actually creating them
 * Useful for testing and review
 * 
 * @param options - Curator options (dry_run is always true)
 * @returns Curator result with drafts but no created insights
 */
export async function previewDrafts(options: CuratorOptions): Promise<CuratorResult> {
  return runCurator({
    ...options,
    dry_run: true,
  });
}

/**
 * Validate curator options
 * 
 * @param options - Options to validate
 * @throws CuratorError if options are invalid
 */
export function validateCuratorOptions(options: CuratorOptions): void {
  if (!options.group_id || options.group_id.trim().length === 0) {
    throw new CuratorError("group_id is required and cannot be empty");
  }

  if (options.min_frequency !== undefined && options.min_frequency < 1) {
    throw new CuratorError("min_frequency must be at least 1");
  }

  if (options.min_success_rate !== undefined && (options.min_success_rate < 0 || options.min_success_rate > 1)) {
    throw new CuratorError("min_success_rate must be between 0 and 1");
  }

  if (options.min_confidence !== undefined && (options.min_confidence < 0 || options.min_confidence > 1)) {
    throw new CuratorError("min_confidence must be between 0 and 1");
  }

  if (options.max_drafts !== undefined && options.max_drafts < 1) {
    throw new CuratorError("max_drafts must be at least 1");
  }

  if (options.lookback_days !== undefined && options.lookback_days < 1) {
    throw new CuratorError("lookback_days must be at least 1");
  }
}

/**
 * Format curator result for logging
 * 
 * @param result - Curator result
 * @returns Formatted string
 */
export function formatCuratorResult(result: CuratorResult): string {
  const lines: string[] = [
    `Curator Result for ${result.group_id}:`,
    `  Patterns detected: ${result.patterns_detected}`,
    `  Drafts generated: ${result.drafts_generated}`,
    `  Drafts created: ${result.drafts_created}`,
    `  Average quality: ${result.avg_quality.toFixed(2)}`,
    `  Dry run: ${result.dry_run}`,
    `  Timestamp: ${result.timestamp.toISOString()}`,
  ];

  if (result.summaries.length > 0) {
    lines.push(`  Summaries:`);
    for (const summary of result.summaries) {
      lines.push(`    - ${summary}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push(`  Errors:`);
    for (const error of result.errors) {
      lines.push(`    - ${error}`);
    }
  }

  return lines.join("\n");
}