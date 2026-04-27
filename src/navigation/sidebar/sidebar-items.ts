import { Brain, FileText, Folder, GitBranch, Home, Lightbulb, Settings, type LucideIcon, Users } from "lucide-react"

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
    label: "Allura Brain",
    items: [
      { title: "Overview", url: "/dashboard", icon: Home },
      { title: "Memory Feed", url: "/dashboard/feed", icon: Brain },
      { title: "Graph View", url: "/dashboard/graph", icon: GitBranch },
      { title: "Insight Review", url: "/dashboard/review", icon: Lightbulb },
      { title: "Evidence Detail", url: "/dashboard/evidence", icon: FileText },
      { title: "Agents", url: "/dashboard/agents", icon: Users },
      { title: "Projects", url: "/dashboard/projects", icon: Folder },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ],
  },
]
