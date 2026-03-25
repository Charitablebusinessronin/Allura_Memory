import { describe, it, expect } from "vitest";
import {
  AgentConfigSchema,
  ScheduleSchema,
  ResourcesSchema,
  NotionConfigSchema,
  AgentType,
  RestartPolicy,
  type AgentConfig,
  type Schedule,
  type Resources,
} from "./schema";
import { z } from "zod";

describe("Agent Configuration Schema", () => {
  describe("ScheduleSchema", () => {
    it("should validate cron schedule", () => {
      const result = ScheduleSchema.parse({
        cron: "0 * * * *",
      });
      expect(result.cron).toBe("0 * * * *");
      expect(result.interval_seconds).toBeUndefined();
      expect(result.continuous).toBeUndefined();
    });

    it("should validate interval schedule", () => {
      const result = ScheduleSchema.parse({
        interval_seconds: 300,
      });
      expect(result.interval_seconds).toBe(300);
      expect(result.cron).toBeUndefined();
    });

    it("should validate continuous schedule", () => {
      const result = ScheduleSchema.parse({
        continuous: true,
      });
      expect(result.continuous).toBe(true);
    });

    it("should reject empty schedule", () => {
      expect(() => ScheduleSchema.parse({})).toThrow();
    });

    it("should reject multiple schedule types", () => {
      expect(() =>
        ScheduleSchema.parse({
          cron: "0 * * * *",
          interval_seconds: 300,
        })
      ).toThrow();
    });

    it("should reject invalid cron syntax", () => {
      expect(() =>
        ScheduleSchema.parse({
          cron: "invalid",
        })
      ).toThrow();
    });
  });

  describe("ResourcesSchema", () => {
    it("should validate minimal resources", () => {
      const result = ResourcesSchema.parse({});
      expect(result.memory_mb).toBe(256);
      expect(result.cpu_percent).toBe(50);
      expect(result.timeout_seconds).toBe(300);
    });

    it("should validate custom resources", () => {
      const result = ResourcesSchema.parse({
        memory_mb: 512,
        cpu_percent: 80,
        timeout_seconds: 600,
      });
      expect(result.memory_mb).toBe(512);
      expect(result.cpu_percent).toBe(80);
      expect(result.timeout_seconds).toBe(600);
    });

    it("should reject negative memory", () => {
      expect(() =>
        ResourcesSchema.parse({
          memory_mb: -100,
        })
      ).toThrow();
    });

    it("should reject memory above limit", () => {
      expect(() =>
        ResourcesSchema.parse({
          memory_mb: 10000,
        })
      ).toThrow();
    });

    it("should reject cpu_percent above 100", () => {
      expect(() =>
        ResourcesSchema.parse({
          cpu_percent: 150,
        })
      ).toThrow();
    });
  });

  describe("AgentConfigSchema", () => {
    const validConfig: AgentConfig = {
      name: "test-agent",
      type: AgentType.KNOWLEDGE_CURATOR,
      enabled: true,
      schedule: { cron: "0 * * * *" },
      resources: { memory_mb: 512 },
      restart_policy: RestartPolicy.UNLESS_STOPPED,
      notion: { sync: true },
      config: { min_confidence: 0.7 },
    };

    it("should validate complete agent config", () => {
      const result = AgentConfigSchema.parse(validConfig);
      expect(result.name).toBe("test-agent");
      expect(result.type).toBe(AgentType.KNOWLEDGE_CURATOR);
      expect(result.enabled).toBe(true);
      expect(result.restart_policy).toBe(RestartPolicy.UNLESS_STOPPED);
    });

    it("should validate all agent types", () => {
      const types: Array<AgentType> = [
        AgentType.KNOWLEDGE_CURATOR,
        AgentType.MEMORY_PROMOTION,
        AgentType.ADAS_SEARCH,
        AgentType.CUSTOM_TASK,
      ];

      for (const type of types) {
        const config = { ...validConfig, type };
        const result = AgentConfigSchema.parse(config);
        expect(result.type).toBe(type);
      }
    });

    it("should validate all restart policies", () => {
      const policies = [
        RestartPolicy.UNLESS_STOPPED,
        RestartPolicy.ON_FAILURE,
        RestartPolicy.ALWAYS,
        RestartPolicy.NEVER,
      ];

      for (const policy of policies) {
        const config = { ...validConfig, restart_policy: policy };
        const result = AgentConfigSchema.parse(config);
        expect(result.restart_policy).toBe(policy);
      }
    });

    it("should reject invalid agent type", () => {
      expect(() =>
        AgentConfigSchema.parse({
          ...validConfig,
          type: "invalid-type",
        })
      ).toThrow();
    });

    it("should reject invalid restart policy", () => {
      expect(() =>
        AgentConfigSchema.parse({
          ...validConfig,
          restart_policy: "invalid-policy",
        })
      ).toThrow();
    });

    it("should reject empty name", () => {
      expect(() =>
        AgentConfigSchema.parse({
          ...validConfig,
          name: "",
        })
      ).toThrow();
    });

    it("should reject name with spaces", () => {
      expect(() =>
        AgentConfigSchema.parse({
          ...validConfig,
          name: "test agent",
        })
      ).toThrow();
    });

    it("should accept name with hyphens and underscores", () => {
      const result = AgentConfigSchema.parse({
        ...validConfig,
        name: "test-agent_123",
      });
      expect(result.name).toBe("test-agent_123");
    });

    it("should make enabled optional (defaults to true)", () => {
      const { enabled, ...configWithoutEnabled } = validConfig;
      const result = AgentConfigSchema.parse(configWithoutEnabled);
      expect(result.enabled).toBe(true);
    });

    it("should make resources optional (uses defaults)", () => {
      const { resources, ...configWithoutResources } = validConfig;
      const result = AgentConfigSchema.parse(configWithoutResources);
      expect(result.resources).toBeDefined();
      expect(result.resources.memory_mb).toBe(256);
    });

    it("should make notion optional (defaults to sync: false)", () => {
      const { notion, ...configWithoutNotion } = validConfig;
      const result = AgentConfigSchema.parse(configWithoutNotion);
      expect(result.notion).toEqual({ sync: false });
    });

    it("should make config optional", () => {
      const { config, ...configWithoutConfig } = validConfig;
      const result = AgentConfigSchema.parse(configWithoutConfig);
      expect(result.config).toBeDefined();
    });

    it("should reject reserved names", () => {
      expect(() =>
        AgentConfigSchema.parse({
          ...validConfig,
          name: "orchestrator",
        })
      ).toThrow();
    });
  });

  describe("AgentType enum", () => {
    it("should have correct values", () => {
      expect(AgentType.KNOWLEDGE_CURATOR).toBe("knowledge-curator");
      expect(AgentType.MEMORY_PROMOTION).toBe("memory-promotion");
      expect(AgentType.ADAS_SEARCH).toBe("adas-search");
      expect(AgentType.CUSTOM_TASK).toBe("custom-task");
    });
  });

  describe("RestartPolicy enum", () => {
    it("should have correct values", () => {
      expect(RestartPolicy.UNLESS_STOPPED).toBe("unless-stopped");
      expect(RestartPolicy.ON_FAILURE).toBe("on-failure");
      expect(RestartPolicy.ALWAYS).toBe("always");
      expect(RestartPolicy.NEVER).toBe("never");
    });
  });
});
