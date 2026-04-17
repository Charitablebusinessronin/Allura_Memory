/**
 * AddMemoryDialog — modal for manually adding a memory.
 * Extracted from page.tsx for line count reduction.
 */

import { Input } from "@/components/ui/input"
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

interface AddMemoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
  onContentChange: (value: string) => void
  onSubmit: () => void
}

export function AddMemoryDialog({ open, onOpenChange, content, onContentChange, onSubmit }: AddMemoryDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>What should your AI remember?</AlertDialogTitle>
          <AlertDialogDescription>
            Write it in plain language and your AI will start using this immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="px-1 py-2">
          <Input
            autoFocus
            placeholder="e.g. Prefer Bun for scripts, not npm"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onContentChange("")}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onSubmit} disabled={!content.trim()}>
            Save memory
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
