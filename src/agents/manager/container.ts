import Docker from "dockerode";
import type { Container, ContainerCreateOptions, ContainerInfo } from "dockerode";
import type { AgentConfig } from "../config/schema";

/**
 * Docker daemon socket path
 */
const DEFAULT_DOCKER_SOCKET = "/var/run/docker.sock";

/**
 * Agent runner image name
 * Uses the existing ADAS sandbox image for consistency
 */
export const AGENT_RUNNER_IMAGE = "adas-sandbox:latest";

/**
 * Container state in Docker
 */
export type ContainerState =
  | "created"
  | "running"
  | "paused"
  | "restarting"
  | "exited"
  | "dead";

/**
 * Agent container information
 */
export interface AgentContainer {
  id: string;
  name: string;
  agentId: string;
  groupId: string;
  status: ContainerState;
  image: string;
  createdAt: Date;
}

/**
 * Detailed container information
 */
export interface AgentContainerInfo extends AgentContainer {
  restartPolicy: string;
  restartCount: number;
  memoryLimit: number;
  cpuPercent: number;
  lastStartedAt?: Date;
  exitCode?: number;
  error?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  status: string;
  lastError?: string;
  restartCount: number;
}

/**
 * Manager for Docker agent containers
 * Handles container lifecycle: create, start, stop, remove, health checks
 */
export class AgentContainerManager {
  private docker: Docker | null = null;
  private dockerAvailable: boolean = true;

  constructor(dockerSocket?: string) {
    try {
      const socketPath = dockerSocket ?? DEFAULT_DOCKER_SOCKET;
      this.docker = new Docker({ socketPath });
      this.dockerAvailable = true;
    } catch {
      this.docker = null;
      this.dockerAvailable = false;
    }
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    if (!this.dockerAvailable || !this.docker) {
      return false;
    }

    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate container name from agent config
   */
  private generateContainerName(name: string, groupId: string): string {
    return `agent-${name}-${groupId}`;
  }

  /**
   * Generate agent ID from name and group
   */
  private generateAgentId(name: string, groupId: string): string {
    return `agent-${name}-${groupId}`;
  }

  private getRestartPolicy(config: AgentConfig): { Name: "no" | "on-failure" | "always" | "unless-stopped"; MaximumRetryCount?: number } {
    switch (config.restart_policy) {
      case "never":
        return { Name: "no" };
      case "on-failure":
        return { Name: "on-failure", MaximumRetryCount: 5 };
      case "always":
        return { Name: "always" };
      case "unless-stopped":
      default:
        return { Name: "unless-stopped" };
    }
  }

  /**
   * Create a new agent container
   * Container is created but not started
   */
  async createContainer(config: AgentConfig, groupId: string): Promise<AgentContainer> {
    if (!this.docker) {
      throw new Error("Docker not available");
    }

    const containerName = this.generateContainerName(config.name, groupId);
    const agentId = this.generateAgentId(config.name, groupId);

    // Check if container already exists
    const existing = await this.findContainer(agentId);
    if (existing) {
      throw new Error(`Container already exists for agent: ${config.name} in group ${groupId}`);
    }

    const createOptions: ContainerCreateOptions = {
      name: containerName,
      Image: AGENT_RUNNER_IMAGE,
      Env: [
        `AGENT_NAME=${config.name}`,
        `AGENT_TYPE=${config.type}`,
        `AGENT_GROUP_ID=${groupId}`,
        `AGENT_ID=${agentId}`,
        `AGENT_CONFIG=${JSON.stringify(config.config)}`,
        `SCHEDULE_TYPE=${this.getScheduleType(config)}`,
        `SCHEDULE_VALUE=${this.getScheduleValue(config)}`,
      ],
      Labels: {
        "allura.agent": "true",
        "allura.agent.name": config.name,
        "allura.agent.group_id": groupId,
        "allura.agent.id": agentId,
        "allura.agent.type": config.type,
      },
      HostConfig: {
        RestartPolicy: this.getRestartPolicy(config),
        Memory: config.resources.memory_mb * 1024 * 1024,
        CpuPercent: config.resources.cpu_percent,
        NetworkMode: "bridge",
        ReadonlyRootfs: true,
      },
    };

    const container = await this.docker.createContainer(createOptions);

    return {
      id: container.id,
      name: config.name,
      agentId,
      groupId,
      status: "created",
      image: AGENT_RUNNER_IMAGE,
      createdAt: new Date(),
    };
  }

  /**
   * Start a container
   */
  async startContainer(containerId: string): Promise<void> {
    if (!this.docker) {
      throw new Error("Docker not available");
    }

    const container = this.docker.getContainer(containerId);

    try {
      await container.start();
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        throw new Error(`Container not found: ${containerId}`);
      }
      throw error;
    }
  }

  /**
   * Stop a container
   */
  async stopContainer(containerId: string, timeout = 30): Promise<void> {
    if (!this.docker) {
      throw new Error("Docker not available");
    }

    const container = this.docker.getContainer(containerId);

    try {
      await container.stop({ t: timeout });
    } catch (error) {
      if (error instanceof Error && error.message.includes("304")) {
        // Container already stopped
        return;
      }
      throw error;
    }
  }

  /**
   * Remove a container
   * Force removes even if running
   */
  async removeContainer(containerId: string): Promise<void> {
    if (!this.docker) {
      throw new Error("Docker not available");
    }

    const container = this.docker.getContainer(containerId);

    try {
      await container.remove({ force: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        // Container already removed
        return;
      }
      throw error;
    }
  }

  /**
   * Get detailed container info
   */
  async getContainerInfo(containerId: string): Promise<AgentContainerInfo | null> {
    if (!this.docker) {
      throw new Error("Docker not available");
    }

    const container = this.docker.getContainer(containerId);

    try {
      const info = await container.inspect();

      return {
        id: info.Id,
        name: info.Config.Labels?.["allura.agent.name"] || info.Name.slice(1),
        agentId: info.Config.Labels?.["allura.agent.id"] || "",
        groupId: info.Config.Labels?.["allura.agent.group_id"] || "",
        status: info.State.Status as ContainerState,
        image: info.Config.Image,
        createdAt: new Date(info.Created),
        restartPolicy: info.HostConfig.RestartPolicy?.Name || "no",
        restartCount: info.RestartCount || 0,
        memoryLimit: info.HostConfig.Memory || 0,
        cpuPercent: info.HostConfig.CpuPercent || 0,
        lastStartedAt: info.State.StartedAt ? new Date(info.State.StartedAt) : undefined,
        exitCode: info.State.ExitCode || undefined,
        error: info.State.Error || undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find container by agent ID
   */
  private async findContainer(agentId: string): Promise<ContainerInfo | null> {
    if (!this.docker) {
      return null;
    }

    const containers = await this.docker.listContainers({ all: true });
    return (
      containers.find((c) =>
        c.Labels?.["allura.agent.id"] === agentId
      ) || null
    );
  }

  /**
   * List all agent containers for a group
   */
  async listContainers(groupId?: string): Promise<AgentContainer[]> {
    if (!this.docker) {
      return [];
    }

    const containers = await this.docker.listContainers({ all: true });

    return containers
      .filter((c) => {
        if (!c.Labels?.["allura.agent"]) {
          return false;
        }
        if (groupId) {
          return c.Labels["allura.agent.group_id"] === groupId ||
                 c.Labels["allura.agent.group_id"]?.startsWith(groupId);
        }
        return true;
      })
      .map((c) => ({
        id: c.Id,
        name: c.Labels?.["allura.agent.name"] || c.Names[0]?.slice(1),
        agentId: c.Labels?.["allura.agent.id"] || "",
        groupId: c.Labels?.["allura.agent.group_id"] || "",
        status: this.mapDockerState(c.State),
        image: c.Image,
        createdAt: new Date(c.Created * 1000),
      }));
  }

  /**
   * Map Docker state string to ContainerState
   */
  private mapDockerState(state: string): ContainerState {
    const validStates: ContainerState[] = ["created", "running", "paused", "restarting", "exited", "dead"];
    return validStates.find((s) => s === state) || "created";
  }

  /**
   * Get schedule type from config
   */
  private getScheduleType(config: AgentConfig): string {
    if (config.schedule.cron) {
      return "cron";
    }
    if (config.schedule.interval_seconds) {
      return "interval";
    }
    return "continuous";
  }

  /**
   * Get schedule value from config
   */
  private getScheduleValue(config: AgentConfig): string {
    if (config.schedule.cron) {
      return config.schedule.cron;
    }
    if (config.schedule.interval_seconds) {
      return String(config.schedule.interval_seconds);
    }
    return "0";
  }

  /**
   * Perform health check on a container
   */
  async healthCheck(containerId: string): Promise<HealthCheckResult> {
    const info = await this.getContainerInfo(containerId);

    if (!info) {
      return {
        healthy: false,
        status: "not_found",
        lastError: "Container not found",
        restartCount: 0,
      };
    }

    // Check if container is running
    const isRunning = info.status === "running";

    // Check restart count - if it's high, the container might be unhealthy
    const maxRestarts = 5;
    const isRestartingTooMuch = info.restartCount > maxRestarts;

    return {
      healthy: isRunning && !isRestartingTooMuch,
      status: info.status,
      lastError: info.error,
      restartCount: info.restartCount,
    };
  }

  /**
   * Restart a container
   */
  async restartContainer(containerId: string, timeout = 30): Promise<void> {
    if (!this.docker) {
      throw new Error("Docker not available");
    }

    const container = this.docker.getContainer(containerId);
    await container.restart({ t: timeout });
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    containerId: string,
    options?: { tail?: number; since?: Date }
  ): Promise<{ stdout: string; stderr: string }> {
    if (!this.docker) {
      throw new Error("Docker not available");
    }

    const container = this.docker.getContainer(containerId);

    const stdoutStream = await container.logs({ stdout: true, stderr: false, tail: options?.tail || 100 });
    const stderrStream = await container.logs({ stdout: false, stderr: true, tail: options?.tail || 100 });

    return {
      stdout: stdoutStream.toString("utf-8").trim(),
      stderr: stderrStream.toString("utf-8").trim(),
    };
  }
}
