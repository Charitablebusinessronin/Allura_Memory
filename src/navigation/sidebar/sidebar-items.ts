import {
  Brain,
  type LucideIcon,
  Search,
  Settings,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  badge?: string;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
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
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
        comingSoon: true,
      },
    ],
  },
];
