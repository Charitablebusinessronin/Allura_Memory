import { resetHaltedGroup } from "./canonical-tools/budget-circuit";

export function cleanupMemoryState(groupId?: string): { group_id: string | null; cleared_sessions: number } {
  return {
    group_id: groupId ?? null,
    cleared_sessions: resetHaltedGroup(groupId),
  };
}
