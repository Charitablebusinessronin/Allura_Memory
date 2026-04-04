// src/lib/opencode-registry/notion-client.ts
import type {
  CanonicalAgent,
  CanonicalSkill,
  CanonicalCommand,
  CanonicalWorkflow,
  SyncRun,
} from "./types";

export interface NotionDbConfig {
  agentsDbId: string;
  skillsDbId: string;
  commandsDbId: string;
  workflowsDbId: string;
  syncRegistryDbId: string;
}

export class NotionRegistryClient {
  constructor(private config: NotionDbConfig) {}

  // Query methods — return raw Notion page objects
  async queryAgents(): Promise<any[]> {
    return [];
  }

  async querySkills(): Promise<any[]> {
    return [];
  }

  async queryCommands(): Promise<any[]> {
    return [];
  }

  async queryWorkflows(): Promise<any[]> {
    return [];
  }

  // Create methods — return page ID
  async createAgent(_agent: CanonicalAgent): Promise<string> {
    return "";
  }

  async createSkill(_skill: CanonicalSkill): Promise<string> {
    return "";
  }

  async createCommand(_cmd: CanonicalCommand): Promise<string> {
    return "";
  }

  async createWorkflow(_wf: CanonicalWorkflow): Promise<string> {
    return "";
  }

  async createSyncRun(_run: SyncRun): Promise<string> {
    return "";
  }

  // Update methods
  async updateAgent(_pageId: string, _agent: Partial<CanonicalAgent>): Promise<void> {}

  async updateSkill(_pageId: string, _skill: Partial<CanonicalSkill>): Promise<void> {}

  async updateCommand(_pageId: string, _cmd: Partial<CanonicalCommand>): Promise<void> {}

  async updateWorkflow(_pageId: string, _wf: Partial<CanonicalWorkflow>): Promise<void> {}
}
