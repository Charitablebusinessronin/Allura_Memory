import { Activity, BookOpen, Brain, FileText, Folder, GitBranch, Home, Lightbulb, Map, Settings, type LucideIcon, Users, Wand2 } from "lucide-react"

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
      { title: "Memory Explorer", url: "/dashboard/memory-explorer", icon: Map, isNew: true },
      { title: "Memory Feed", url: "/dashboard/feed", icon: Brain },
      { title: "Graph", url: "/dashboard/graph", icon: GitBranch },
      { title: "Insights", url: "/dashboard/insights", icon: Lightbulb },
      { title: "Evidence", url: "/dashboard/evidence", icon: FileText },
      { title: "Agents", url: "/dashboard/agents", icon: Users },
      { title: "Projects", url: "/dashboard/projects", icon: Folder },
      { title: "Decision Records", url: "/dashboard/decisions", icon: BookOpen },
      { title: "Insight Builder", url: "/dashboard/builder", icon: Wand2 },
      { title: "System Health", url: "/dashboard/health", icon: Activity },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ],
  },
]
