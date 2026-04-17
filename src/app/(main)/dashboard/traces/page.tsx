import { redirect } from "next/navigation"

/**
 * AD-18: /dashboard/traces merged into /dashboard/audit.
 * This redirect preserves deep links and bookmarks.
 * The audit page is the single event viewer for the append-only PostgreSQL trace table.
 */
export default function TracesPage() {
  redirect("/dashboard/audit")
}
