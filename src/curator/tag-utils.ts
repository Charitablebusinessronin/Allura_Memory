/**
 * Tag Utilities
 * 
 * Provides tag normalization and validation functions.
 * 
 * ARCHITECTURE RULE:
 * - canonical_tag = system slug (Neo4j, PostgreSQL, group_id)
 * - display_tag = human label (Notion multi-select)
 * 
 * NEVER use spaces or display labels as group_id.
 */

import { ALLOWED_CANONICAL_TAGS, DISPLAY_TAG_MAP, PROJECT_NAME_MAP, CanonicalTag } from "./config";

const allowedTagSet = new Set<string>(ALLOWED_CANONICAL_TAGS);

/**
 * Normalize a tag to canonical form
 * Converts spaces and underscores to hyphens, lowercases everything
 */
export function normalizeCanonicalTag(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-")
    .trim();
}

/**
 * Validate that a tag is in the allowed list
 * Throws if invalid
 */
export function validateCanonicalTag(tag: string): CanonicalTag {
  const normalized = normalizeCanonicalTag(tag);

  if (!allowedTagSet.has(normalized)) {
    throw new Error(
      `Invalid canonical tag: "${tag}" (normalized: "${normalized}"). ` +
      `Allowed tags: ${ALLOWED_CANONICAL_TAGS.join(", ")}`
    );
  }

  return normalized as CanonicalTag;
}

/**
 * Check if a tag is valid (doesn't throw)
 */
export function isValidCanonicalTag(tag: string): boolean {
  try {
    validateCanonicalTag(tag);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get display tag from canonical tag
 * Returns null if not found
 */
export function getDisplayTag(canonicalTag: string): string | null {
  const normalized = normalizeCanonicalTag(canonicalTag);
  return DISPLAY_TAG_MAP[normalized] || null;
}

/**
 * Get project name from canonical tag
 * Returns null if not found
 */
export function getProjectName(canonicalTag: string): string | null {
  const normalized = normalizeCanonicalTag(canonicalTag);
  return PROJECT_NAME_MAP[normalized] || null;
}

/**
 * Get canonical tag from any input format
 * Accepts: canonical, display, or project name
 * Returns null if not found
 */
export function getCanonicalTag(input: string): string | null {
  const normalized = normalizeCanonicalTag(input);
  
  // Check if it's already canonical
  if (allowedTagSet.has(normalized)) {
    return normalized;
  }
  
  // Check if it's a display tag
  for (const [canonical, display] of Object.entries(DISPLAY_TAG_MAP)) {
    if (display.toLowerCase() === input.toLowerCase()) {
      return canonical;
    }
  }
  
  // Check if it's a project name
  for (const [canonical, project] of Object.entries(PROJECT_NAME_MAP)) {
    if (project.toLowerCase() === input.toLowerCase()) {
      return canonical;
    }
  }
  
  return null;
}

/**
 * Convert canonical tags to Notion display format
 */
export function canonicalToDisplay(canonicalTags: string[]): string[] {
  return canonicalTags
    .map(t => getDisplayTag(t))
    .filter((t): t is string => t !== null);
}

/**
 * Normalize an array of tags, filtering out invalid ones (with warning)
 */
export function normalizeTags(tags: string[]): string[] {
  const valid: string[] = [];
  
  for (const tag of tags) {
    try {
      valid.push(validateCanonicalTag(tag));
    } catch (e) {
      console.warn(`[TAG WARNING] Invalid tag "${tag}" will be ignored. Allowed: ${ALLOWED_CANONICAL_TAGS.join(", ")}`);
    }
  }
  
  return valid;
}