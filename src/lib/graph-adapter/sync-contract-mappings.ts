/**
 * Sync Contract Mappings — FR-3
 *
 * Mapping tables from user_id → Agent node name and group_id → Project node name.
 * Used by the sync contract to resolve relationship targets when wiring
 * AUTHORED_BY and CONTRIBUTES_TO on promoted memories.
 *
 * Reference: BRIEF-FR3-SYNC-CONTRACT.md
 */

// ── group_id → Project Node Mapping ────────────────────────────────────────

const GROUP_TO_PROJECT: Record<string, string> = {
  "allura-system": "Allura Memory",
  "allura-team-durham": "Creative Studio",
  "allura-default": "Allura Memory",
}

// ── user_id → Agent Node Mapping ────────────────────────────────────────────

const USER_TO_AGENT: Record<string, string> = {
  gilliam: "Gilliam",
  woz: "Woz",
  "woz-builder": "Woz",
  fowler: "Fowler",
  "fowler-refactor": "Fowler",
  bellard: "Bellard",
  "bellard-diagnostics": "Bellard",
  knuth: "Knuth",
  "knuth-data": "Knuth",
  hightower: "Hightower",
  "hightower-devops": "Hightower",
  brooks: "Brooks",
  "brooks-architect": "Brooks",
  pike: "Pike",
  "pike-interface": "Pike",
  carmack: "Carmack",
  "carmack-performance": "Carmack",
  jobs: "Jobs",
  "jobs-intent": "Jobs",
  scout: "Scout",
  "scout-recon": "Scout",
  mizko: "Mizko",
  "mizko-ui": "Mizko",
}

/**
 * Resolve a group_id to a Project node name.
 * Falls back to group_id itself if no mapping exists.
 */
export function resolveProjectName(groupId: string): string {
  return GROUP_TO_PROJECT[groupId] ?? groupId
}

/**
 * Resolve a user_id to an Agent node name.
 * Falls back to user_id itself if no mapping exists.
 */
export function resolveAgentName(userId: string): string {
  return USER_TO_AGENT[userId] ?? userId
}

/**
 * Check whether a group_id has a known project mapping.
 */
export function isKnownGroup(groupId: string): boolean {
  return groupId in GROUP_TO_PROJECT
}

/**
 * Check whether a user_id has a known agent mapping.
 */
export function isKnownUser(userId: string): boolean {
  return userId in USER_TO_AGENT
}