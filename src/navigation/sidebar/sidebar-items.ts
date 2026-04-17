import {
  Brain,
  ClipboardList,
  Database,
  type LucideIcon,
  Search,
  ListChecks,
  Lightbulb,
  ScrollText,
} from "lucide-react"

export interface NavSubItem {
  title: string
  url: string
  icon?: LucideIcon
  comingSoon?: boolean
  newTab?: boolean
  isNew?: boolean
}

export interface NavMainItem {
  title: string
  url: string
  icon?: LucideIcon
  subItems?: NavSubItem[]
  comingSoon?: boolean
  newTab?: boolean
  isNew?: boolean
  badge?: string
}

export interface NavGroup {
  id: number
  label?: string
  items: NavMainItem[]
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Memory",
    items: [
      {
        title: "Memories",
        url: "/memory",
        icon: Brain,
      },
      {
        title: "Search",
        url: "/memory?view=search",
        icon: Search,
      },
    ],
  },
  {
    id: 2,
    label: "Admin",
    items: [
      {
        title: "Curator",
        url: "/dashboard/curator",
        icon: ClipboardList,
      },
      {
        title: "Memories (Admin)",
        url: "/dashboard/memories",
        icon: Database,
      },
      {
        title: "Traces",
        url: "/dashboard/traces",
        icon: ListChecks,
      },
      {
        title: "Audit Log",
        url: "/dashboard/audit",
        icon: ScrollText,
      },
      {
        title: "Insights",
        url: "/dashboard/insights",
        icon: Lightbulb,
      },
    ],
  },
]
