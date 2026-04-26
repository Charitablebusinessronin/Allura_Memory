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
      { title: "Memories", url: "/dashboard/memories", icon: Brain },
      { title: "Graph", url: "/dashboard/graph", icon: GitBranch },
      { title: "Insights", url: "/dashboard/insights", icon: Lightbulb },
      { title: "Evidence", url: "/dashboard/evidence", icon: FileText },
      { title: "Agents", url: "/dashboard/agents", icon: Users },
      { title: "Projects", url: "/dashboard/projects", icon: Folder },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ],
  },
]
