import { z } from "zod";

export const AgentType = {
  KNOWLEDGE_CURATOR: "knowledge-curator",
  MEMORY_PROMOTION: "memory-promotion",
  ADAS_SEARCH: "adas-search",
  CUSTOM_TASK: "custom-task",
} as const;

export const RestartPolicy = {
  UNLESS_STOPPED: "unless-stopped",
  ON_FAILURE: "on-failure",
  ALWAYS: "always",
  NEVER: "never",
} as const;

const RESERVED_NAMES = ["orchestrator", "registry", "system", "default"];

const CRON_PATTERN =
  /^((\*|\?|\d+([-\/]\d+)?)(,\d+([-\/]\d+)?)*\s+){4}(\*|\?|\d+([-\/]\d+)?)(,\d+([-\/]\d+)?)*$/;

export const ScheduleSchema = z
  .object({
    cron: z.string().regex(CRON_PATTERN, "Invalid cron expression").optional(),
    interval_seconds: z.number().int().min(1).max(86400).optional(),
    continuous: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const defined = [data.cron, data.interval_seconds, data.continuous].filter(
        (v) => v !== undefined
      ).length;
      return defined === 1;
    },
    { message: "Schedule must have exactly one type" }
  );

const AgentNameSchema = z
  .string()
  .min(1, "Agent name is required")
  .max(63, "Agent name must be 63 characters or less")
  .regex(/^[a-z0-9_-]+$/, "Invalid characters in name")
  .refine((name) => !RESERVED_NAMES.includes(name), {
    message: "Reserved name",
  });

export const ResourcesSchema = z.object({
  memory_mb: z.number().int().min(64).max(8192).default(256),
  cpu_percent: z.number().min(1).max(100).default(50),
  timeout_seconds: z.number().int().min(10).max(3600).default(300),
});

export const NotionConfigSchema = z.object({
  sync: z.boolean().default(false),
  database_id: z.string().optional(),
});

const DefaultResources = {
  memory_mb: 256,
  cpu_percent: 50,
  timeout_seconds: 300,
};

const DefaultNotionConfig = {
  sync: false,
  database_id: undefined,
};

const DefaultConfig = {};

export const AgentConfigSchema = z.object({
  name: AgentNameSchema,
  type: z.enum(["knowledge-curator", "memory-promotion", "adas-search", "custom-task"]),
  enabled: z.boolean().default(true),
  schedule: ScheduleSchema,
  resources: z.object({
    memory_mb: z.number().int().min(64).max(8192).default(256),
    cpu_percent: z.number().min(1).max(100).default(50),
    timeout_seconds: z.number().int().min(10).max(3600).default(300),
  }).default(() => DefaultResources),
  restart_policy: z.enum(["unless-stopped", "on-failure", "always", "never"]).default("unless-stopped"),
  notion: z.object({
    sync: z.boolean().default(false),
    database_id: z.string().optional(),
  }).default(() => DefaultNotionConfig),
  config: z.record(z.string(), z.unknown()).default(() => DefaultConfig),
});

export const AgentsConfigSchema = z.object({
  version: z.literal("1.0").default("1.0"),
  group_id: z.string().min(1).max(255).default("default"),
  agents: z.array(AgentConfigSchema).min(1, "At least one agent is required"),
});

export type AgentType = typeof AgentType[keyof typeof AgentType];
export type RestartPolicy = typeof RestartPolicy[keyof typeof RestartPolicy];
export type Schedule = z.infer<typeof ScheduleSchema>;
export type Resources = z.infer<typeof ResourcesSchema>;
export type NotionConfig = z.infer<typeof NotionConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;
