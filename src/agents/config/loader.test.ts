import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigLoader } from "./loader";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("Config Loader", () => {
  let tempDir: string;
  let configFile: string;
  let loader: ConfigLoader;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "agent-config-test-"));
    configFile = join(tempDir, "agents.yaml");
    loader = new ConfigLoader(configFile);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("should load valid config file", async () => {
      const config = `
version: "1.0"
group_id: test-group
agents:
  - name: test-agent
    type: knowledge-curator
    schedule:
      cron: "0 * * * *"
    config:
      min_confidence: 0.7
`;
      writeFileSync(configFile, config);

      const result = await loader.load();

      expect(result.version).toBe("1.0");
      expect(result.group_id).toBe("test-group");
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe("test-agent");
      expect(result.agents[0].type).toBe("knowledge-curator");
    });

    it("should throw if config file does not exist", async () => {
      const nonExistentFile = join(tempDir, "non-existent.yaml");
      const testLoader = new ConfigLoader(nonExistentFile);

      await expect(testLoader.load()).rejects.toThrow("Config file not found");
    });

    it("should throw on invalid YAML", async () => {
      writeFileSync(configFile, "invalid: yaml: content: [");

      await expect(loader.load()).rejects.toThrow();
    });

    it("should throw on validation error", async () => {
      const config = `
version: "1.0"
group_id: test-group
agents:
  - name: invalid name with spaces
    type: knowledge-curator
    schedule:
      cron: "0 * * * *"
`;
      writeFileSync(configFile, config);

      await expect(loader.load()).rejects.toThrow();
    });

    it("should use default values for missing optional fields", async () => {
      const config = `
version: "1.0"
group_id: test-group
agents:
  - name: minimal-agent
    type: memory-promotion
    schedule:
      interval_seconds: 300
`;
      writeFileSync(configFile, config);

      const result = await loader.load();

      expect(result.agents[0].enabled).toBe(true);
      expect(result.agents[0].restart_policy).toBe("unless-stopped");
      expect(result.agents[0].resources).toBeDefined();
      expect(result.agents[0].resources.memory_mb).toBe(256);
    });
  });

  describe("watch", () => {
    it.skip("should detect file changes (timing-dependent)", async () => {
      const config = `
version: "1.0"
group_id: test-group
agents:
  - name: test-agent
    type: knowledge-curator
    schedule:
      cron: "0 * * * *"
`;
      writeFileSync(configFile, config);

      const changes: string[] = [];
      loader.onChange((config: { agents: Array<{ name: string }> }) => {
        changes.push(config.agents[0].name);
      });

      await loader.watch();

      // Wait for watcher to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Modify file
      const newConfig = `
version: "1.0"
group_id: test-group
agents:
  - name: modified-agent
    type: knowledge-curator
    schedule:
      cron: "0 * * * *"
`;
      writeFileSync(configFile, newConfig);

      // Wait for change to be detected
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(changes).toContain("modified-agent");

      await loader.stopWatching();
    });

    it("should handle watch errors gracefully", async () => {
      const nonExistentDir = join(tempDir, "non-existent-dir");
      const badFile = join(nonExistentDir, "agents.yaml");
      const badLoader = new ConfigLoader(badFile);

      await expect(badLoader.watch()).rejects.toThrow();
    });
  });

  describe("getConfigHash", () => {
    it("should return consistent hash for same content", async () => {
      const config = `
version: "1.0"
group_id: test-group
agents:
  - name: test-agent
    type: knowledge-curator
    schedule:
      cron: "0 * * * *"
`;
      writeFileSync(configFile, config);

      const hash1 = await loader.getConfigHash();
      const hash2 = await loader.getConfigHash();

      expect(hash1).toBe(hash2);
    });

    it("should return different hash for different content", async () => {
      const config1 = `
version: "1.0"
group_id: test-group
agents:
  - name: test-agent
    type: knowledge-curator
    schedule:
      cron: "0 * * * *"
`;
      writeFileSync(configFile, config1);
      const hash1 = await loader.getConfigHash();

      const config2 = `
version: "1.0"
group_id: test-group
agents:
  - name: test-agent
    type: knowledge-curator
    schedule:
      cron: "0 0 * * *"
`;
      writeFileSync(configFile, config2);
      const hash2 = await loader.getConfigHash();

      expect(hash1).not.toBe(hash2);
    });
  });
});
