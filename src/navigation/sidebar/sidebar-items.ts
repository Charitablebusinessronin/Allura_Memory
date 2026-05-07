import { BookOpen, Brain, Folder, Lightbulb, Settings, Users } from "lucide-react"

export interface NavSubItem {
  title: string
  url: string
  icon?: any
  comingSoon?: boolean
  newTab?: boolean
  isNew?: boolean
}

export interface NavMainItem {
  title: string
  url: string
  icon?: any
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
    label: "Primary",
    items: [
      { title: "Memories", url: "/dashboard/feed", icon: Brain },
      { title: "Insights", url: "/dashboard/insights", icon: Lightbulb },
      { title: "Projects", url: "/dashboard/projects", icon: Folder },
      { title: "Crew", url: "/dashboard/agents", icon: Users },
    ],
  },
  {
    id: 2,
    label: "Records",
    items: [
      {
        title: "Decisions",
        url: "/dashboard/decisions",
        icon: BookOpen,
        subItems: [
          { title: "Decision Records", url: "/dashboard/decisions" },
          { title: "Insight Builder", url: "/dashboard/builder" },
        ],
      },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
        subItems: [
          { title: "Preferences", url: "/dashboard/settings" },
          { title: "System Health", url: "/dashboard/health" },
        ],
      },
    ],
  },
]
