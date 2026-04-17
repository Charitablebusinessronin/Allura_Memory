/**
 * SettingsSheet — mobile settings sidebar for group/user filters.
 * Extracted from page.tsx for line count reduction.
 */

import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  onGroupIdChange: (value: string) => void
  userId: string
  onUserIdChange: (value: string) => void
  allUsers: boolean
}

export function SettingsSheet({
  open,
  onOpenChange,
  groupId,
  onGroupIdChange,
  userId,
  onUserIdChange,
  allUsers,
}: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>View settings</SheetTitle>
          <SheetDescription>Adjust which memories you are looking at without changing stored data.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="sheet-group-id" className="text-sm font-medium">
              Workspace scope
            </label>
            <Input
              id="sheet-group-id"
              placeholder="allura-your-team"
              value={groupId}
              onChange={(e) => onGroupIdChange(e.target.value)}
              className="text-sm"
            />
            <p className="text-muted-foreground text-xs">Technical key: group_id</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="sheet-user-id" className="text-sm font-medium">
              Person filter
            </label>
            <Input
              id="sheet-user-id"
              placeholder="Optional user ID"
              value={userId}
              onChange={(e) => onUserIdChange(e.target.value)}
              disabled={allUsers}
              className="text-sm"
            />
            <p className="text-muted-foreground text-xs">Leave blank or switch to all people to widen the view.</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
