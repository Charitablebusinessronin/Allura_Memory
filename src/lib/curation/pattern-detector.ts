/**
 * Pattern Detection from PostgreSQL Traces
 * Story 1.7: Automated Knowledge Curation
 * 
 * Scans raw traces to identify successful Event -> Outcome patterns
 * that can be promoted to insights.
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";

/**
 * Pattern detected from traces
 */
export interface DetectedPattern {
  /** Pattern identifier */
  id: string;
  /** Group ID (tenant) */
  group_id: string;
  /** Event type that triggered the pattern */
  event_type: string;
  /** Number of occurrences found */
  frequency: number;
  /** Success rate (0.0 - 1.0) */
  success_rate: number;
  /** Common metadata patterns */
  metadata_patterns: Record<string, unknown>;
  /** Common outcome patterns */
  outcome_patterns: Record<string, unknown>;
  /** Agent(s) that produced this pattern */
  agents: string[];
  /** First occurrence */
  first_seen: Date;
  /** Last occurrence */
  last_seen: Date;
  /** Confidence score for promotion to insight */
  confidence: number;
}

/**
 * Pattern detection options
 */
export interface PatternDetectionOptions {
  /** Required: Group ID for tenant isolation */
  group_id: string;
  /** Optional: Minimum frequency to consider */
  min_frequency?: number;
  /** Optional: Minimum success rate */
  min_success_rate?: number;
  /** Optional: Lookback period in days */
  lookback_days?: number;
  /** Optional: Maximum patterns to return */
  limit?: number;
}

/**
 * Event pattern from database
 */
interface EventPattern {
  event_type: string;
  frequency: number;
  success_count: number;
  agents: string[];
  first_seen: Date;
  last_seen: Date;
  metadata_samples: Record<string, unknown>[];
  outcome_samples: Record<string, unknown>[];
}

/**
 * Pattern detection error
 */
export class PatternDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatternDetectionError";
  }
}

/**
 * Default options
 */
const DEFAULT_MIN_FREQUENCY = 3;
const DEFAULT_MIN_SUCCESS_RATE = 0.7;
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_LIMIT = 50;

/**
 * Detect successful patterns from PostgreSQL traces
 * 
 * @param options - Detection options
 * @returns Array of detected patterns
 */
export async function detectPatterns(
  options: PatternDetectionOptions
): Promise<DetectedPattern[]> {
  if (!options.group_id || options.group_id.trim().length === 0) {
    throw new PatternDetectionError("group_id is required and cannot be empty");
  }

  const pool = getPool();
  const minFrequency = options.min_frequency ?? DEFAULT_MIN_FREQUENCY;
  const minSuccessRate = options.min_success_rate ?? DEFAULT_MIN_SUCCESS_RATE;
  const lookbackDays = options.lookback_days ?? DEFAULT_LOOKBACK_DAYS;
  const limit = options.limit ?? DEFAULT_LIMIT;

  // Query for event patterns with success rates
  const query = `
    SELECT
      event_type,
      COUNT(*) as frequency,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count,
      MIN(created_at) as first_seen,
      MAX(created_at) as last_seen,
      ARRAY_AGG(DISTINCT agent_id) FILTER (WHERE agent_id IS NOT NULL) as agents,
      ARRAY_AGG(metadata) FILTER (WHERE metadata IS NOT NULL) as metadata_samples,
      ARRAY_AGG(outcome) FILTER (WHERE outcome IS NOT NULL) as outcome_samples
    FROM events
    WHERE group_id = $1
      AND created_at >= NOW() - INTERVAL '${lookbackDays} days'
    GROUP BY event_type
    HAVING COUNT(*) >= $2
    ORDER BY frequency DESC
    LIMIT $3
  `;

  const result = await pool.query(query, [options.group_id, minFrequency, limit]);

  const patterns: DetectedPattern[] = [];

  for (const row of result.rows) {
    const frequency = parseInt(row.frequency, 10);
    const successCount = parseInt(row.success_count, 10);
    const successRate = frequency > 0 ? successCount / frequency : 0;

    // Skip patterns below minimum success rate
    if (successRate < minSuccessRate) {
      continue;
    }

    // Extract common metadata patterns
    const metadataPatterns = extractCommonPatterns(row.metadata_samples || []);

    // Extract common outcome patterns
    const outcomePatterns = extractCommonPatterns(row.outcome_samples || []);

    // Calculate confidence based on frequency and success rate
    const confidence = calculateConfidence(frequency, successRate);

    patterns.push({
      id: `pattern-${row.event_type}-${Date.now()}`,
      group_id: options.group_id,
      event_type: row.event_type,
      frequency,
      success_rate: Math.round(successRate * 100) / 100,
      metadata_patterns: metadataPatterns,
      outcome_patterns: outcomePatterns,
      agents: row.agents || [],
      first_seen: row.first_seen,
      last_seen: row.last_seen,
      confidence,
    });
  }

  return patterns;
}

/**
 * Extract common patterns from an array of objects
 * Returns key-value pairs that appear frequently
 */
function extractCommonPatterns(
  samples: Record<string, unknown>[]
): Record<string, unknown> {
  if (samples.length === 0) {
    return {};
  }

  const keyCounts: Map<string, Map<unknown, number>> = new Map();

  // Count occurrences of each key-value pair
  for (const sample of samples) {
    for (const [key, value] of Object.entries(sample || {})) {
      if (!keyCounts.has(key)) {
        keyCounts.set(key, new Map());
      }
      const valueMap = keyCounts.get(key)!;
      valueMap.set(value, (valueMap.get(value) || 0) + 1);
    }
  }

  // Find common patterns (appear in >50% of samples)
  const threshold = samples.length * 0.5;
  const commonPatterns: Record<string, unknown> = {};

  for (const [key, valueMap] of keyCounts) {
    for (const [value, count] of valueMap) {
      if (count >= threshold && value !== null && value !== undefined) {
        commonPatterns[key] = value;
        break; // Take the most common value
      }
    }
  }

  return commonPatterns;
}

/**
 * Calculate confidence score for a pattern
 * Based on frequency and success rate
 */
function calculateConfidence(frequency: number, successRate: number): number {
  // Base confidence on success rate
  let confidence = successRate;

  // Boost confidence for higher frequency
  // Using logarithmic scale: more frequency = more confidence, but diminishing returns
  const frequencyBoost = Math.min(0.1, Math.log10(frequency) * 0.02);
  confidence = Math.min(1, confidence + frequencyBoost);

  // Round to 2 decimal places
  return Math.round(confidence * 100) / 100;
}

/**
 * Get pattern details by event type
 * 
 * @param groupId - Group ID
 * @param eventType - Event type to analyze
 * @returns Pattern details or null
 */
export async function getPatternByEventType(
  groupId: string,
  eventType: string
): Promise<DetectedPattern | null> {
  const patterns = await detectPatterns({
    group_id: groupId,
    min_frequency: 1,
    limit: 1000,
  });

  return patterns.find((p) => p.event_type === eventType) || null;
}

/**
 * Get all unique event types for a group
 * Useful for determining what patterns to look for
 * 
 * @param groupId - Group ID
 * @param limit - Maximum number of event types to return
 * @returns Array of event types with counts
 */
export async function getEventTypes(
  groupId: string,
  limit: number = 100
): Promise<Array<{ event_type: string; count: number }>> {
  const pool = getPool();

  const query = `
    SELECT
      event_type,
      COUNT(*) as count
    FROM events
    WHERE group_id = $1
    GROUP BY event_type
    ORDER BY count DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [groupId, limit]);

  return result.rows.map((row) => ({
    event_type: row.event_type,
    count: parseInt(row.count, 10),
  }));
}

/**
 * Get pattern statistics for a group
 * Useful for monitoring curator performance
 * 
 * @param groupId - Group ID
 * @returns Statistics about patterns detected
 */
export async function getPatternStats(groupId: string): Promise<{
  total_patterns: number;
  total_events: number;
  avg_success_rate: number;
  avg_frequency: number;
  top_event_types: string[];
}> {
  const patterns = await detectPatterns({
    group_id: groupId,
    min_frequency: 1,
    limit: 1000,
  });

  const pool = getPool();
  const countResult = await pool.query(
    "SELECT COUNT(*) as total FROM events WHERE group_id = $1",
    [groupId]
  );

  const totalEvents = parseInt(countResult.rows[0].total, 10);
  const totalPatterns = patterns.length;

  const avgSuccessRate = totalPatterns > 0
    ? patterns.reduce((sum, p) => sum + p.success_rate, 0) / totalPatterns
    : 0;

  const avgFrequency = totalPatterns > 0
    ? patterns.reduce((sum, p) => sum + p.frequency, 0) / totalPatterns
    : 0;

  const topEventTypes = patterns
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10)
    .map((p) => p.event_type);

  return {
    total_patterns: totalPatterns,
    total_events: totalEvents,
    avg_success_rate: Math.round(avgSuccessRate * 100) / 100,
    avg_frequency: Math.round(avgFrequency * 100) / 100,
    top_event_types: topEventTypes,
  };
}