/**
 * Resolve human-readable display names for users and groups.
 * Falls back to friendly generic labels on error or missing data.
 */

type EntityType = 'user' | 'group'

const FALLBACKS: Record<EntityType, string> = {
  user: 'your memories',
  group: 'team memories',
}

/**
 * Fetch a human-readable display name for a user or group ID.
 * Returns a graceful fallback on error.
 */
export async function resolveDisplayName(
  type: EntityType,
  id: string
): Promise<string> {
  if (!id || id.trim() === '') {
    return FALLBACKS[type]
  }

  try {
    const endpoint = `/api/${type}s/${encodeURIComponent(id)}/display-name`
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Use cache for performance - display names rarely change
      cache: 'force-cache',
      next: { revalidate: 300 }, // 5 min cache
    })

    if (res.ok) {
      const data = await res.json()
      if (data.displayName && typeof data.displayName === 'string') {
        return data.displayName
      }
    }
  } catch (error) {
    console.warn(`Failed to resolve ${type} display name for ${id}:`, error)
  }

  // Return friendly fallback on any error
  return FALLBACKS[type]
}

/**
 * Build a human-readable scope label for the memory viewer.
 * Replaces raw IDs with display names.
 */
export async function buildScopeLabel(
  groupId: string,
  userId: string,
  allUsers: boolean
): Promise<string> {
  if (allUsers) {
    const groupName = await resolveDisplayName('group', groupId)
    return `Showing memories from everyone in ${groupName}`
  }

  if (userId && userId.trim() !== '') {
    const userName = await resolveDisplayName('user', userId)
    return `Showing memories for ${userName}`
  }

  const groupName = await resolveDisplayName('group', groupId)
  return `Showing memories in ${groupName}`
}
