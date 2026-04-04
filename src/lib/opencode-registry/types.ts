// src/lib/opencode-registry/types.ts

export type AgentType = 'OpenAgent' | 'Specialist' | 'Worker' | 'BMad Persona' | 'WDS Persona';
export type AgentCategory = 'core' | 'subagents/core' | 'subagents/code' | 'subagents/development' | 'bmm' | 'tea' | 'wds';
export type EntityStatus = 'active' | 'idle' | 'deprecated' | 'experimental';
export type SkillCategory = 'context' | 'research' | 'writing' | 'testing' | 'review' | 'governance' | 'deployment' | 'bmad' | 'wds' | 'tea';
export type CommandCategory = 'memory' | 'knowledge' | 'tenant' | 'audit' | 'agent' | 'sync';
export type WorkflowModule = 'bmm' | 'tea' | 'wds' | 'bmb' | 'core';
export type WorkflowPhase = '1-analysis' | '2-planning' | '3-solutioning' | '4-implementation' | '0-wds-pitch' | '1-wds-strategy' | '2-wds-design' | '3-wds-build';
export type SyncStatus = 'success' | 'partial' | 'failed' | 'dry-run';
export type RequiredTool = 'read' | 'write' | 'edit' | 'bash' | 'grep' | 'task';

export interface CanonicalAgent {
  id: string;
  displayName: string;
  persona?: string;
  type: AgentType;
  category?: AgentCategory;
  status: EntityStatus;
  sourcePath: string;
  skills: string[];
  commands: string[];
  workflows: string[];
  configFile?: string;
  groupId?: string;
  lastSynced?: Date;
}

export interface CanonicalSkill {
  id: string;
  displayName?: string;
  category?: SkillCategory;
  description?: string;
  sourcePath: string;
  requiredTools?: RequiredTool[];
  status: EntityStatus;
  agents: string[];
  usageCount?: number;
  lastUsed?: Date;
}

export interface CanonicalCommand {
  id: string;
  intent?: string;
  category?: CommandCategory;
  sourcePath: string;
  inputSchema?: string;
  outputSchema?: string;
  requiresHitl?: boolean;
  status: EntityStatus;
  skills: string[];
  agents: string[];
}

export interface CanonicalWorkflow {
  code: string;
  name?: string;
  module?: WorkflowModule;
  phase?: WorkflowPhase;
  description?: string;
  agent?: string;
  required?: boolean;
  sequence?: number;
  sourcePath: string;
  status: EntityStatus;
}

export interface SyncRun {
  runId: string;
  runDate: Date;
  status: SyncStatus;
  agentsSynced: number;
  skillsSynced: number;
  commandsSynced: number;
  workflowsSynced: number;
  driftReport?: string;
  brokenLinks: number;
  missingLocal: number;
  missingNotion: number;
}

export interface DriftReport {
  missingInNotion: string[];
  missingInLocal: string[];
  fieldMismatches: Array<{id: string, field: string, local: any, notion: any}>;
  brokenLinks: Array<{from: string, to: string, relation: string}>;
}
