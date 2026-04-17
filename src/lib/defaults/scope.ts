import { APP_CONFIG } from "@/config/app-config"

export const DEFAULT_GROUP_ID = APP_CONFIG.defaultGroupId
export const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? ""
