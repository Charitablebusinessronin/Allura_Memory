/**
 * DeleteConfirmDialog — confirmation dialog before forgetting a memory.
 * Extracted from page.tsx for line count reduction.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Memory } from "@/hooks/use-memory-list"

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memory: Memory | null
  onConfirm: (memory: Memory) => void
}

export function DeleteConfirmDialog({ open, onOpenChange, memory, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the memory from your AI&apos;s knowledge. You can undo this within 30 days.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (memory) onConfirm(memory)
              onOpenChange(false)
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Forget
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
