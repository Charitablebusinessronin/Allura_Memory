import { readFile, stat } from "fs/promises";
import { watch, type FSWatcher } from "fs";
import { AgentsConfigSchema, type AgentsConfig } from "./schema";
import { createHash } from "crypto";
import { parse } from "yaml";

export class ConfigLoader {
  private configPath: string;
  private watcher: FSWatcher | null = null;
  private changeCallbacks: Array<(config: AgentsConfig) => void> = [];
  private lastHash: string = "";

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  async load(): Promise<AgentsConfig> {
    try {
      await stat(this.configPath);
    } catch {
      throw new Error(`Config file not found: ${this.configPath}`);
    }

    const content = await readFile(this.configPath, "utf-8");
    const parsed = parse(content);
    const validated = AgentsConfigSchema.parse(parsed);

    this.lastHash = this.computeHash(content);

    return validated;
  }

  async watch(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.watcher = watch(this.configPath, async (eventType) => {
        if (eventType === "change") {
          try {
            const content = await readFile(this.configPath, "utf-8");
            const newHash = this.computeHash(content);

            if (newHash !== this.lastHash) {
              this.lastHash = newHash;
              const config = await this.load();
              this.changeCallbacks.forEach((cb) => cb(config));
            }
          } catch (error) {
            console.error("Config reload failed:", error);
          }
        }
      });

      this.watcher.on("ready", () => resolve());
      this.watcher.on("error", reject);
    });
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  onChange(callback: (config: AgentsConfig) => void): void {
    this.changeCallbacks.push(callback);
  }

  async getConfigHash(): Promise<string> {
    const content = await readFile(this.configPath, "utf-8");
    return this.computeHash(content);
  }

  private computeHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }
}
