// src/lib/opencode-registry/notion-client.ts
import type {
  CanonicalAgent,
  CanonicalSkill,
  CanonicalCommand,
  CanonicalWorkflow,
  SyncRun,
} from "./types";

/**
 * Custom errors for Notion client operations
 */
export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotionApiError extends Error {
  constructor(
    public operation: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "NotionApiError";
  }
}

export interface NotionDbConfig {
  agentsDbId: string;
  skillsDbId: string;
  commandsDbId: string;
  workflowsDbId: string;
  syncRegistryDbId: string;
}

export interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
  url: string;
}

/**
 * MCP tool function interface
 */
export interface McpToolExecutor {
  (toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

/**
 * Configuration for Notion client
 */
export interface NotionClientConfig {
  databases: NotionDbConfig;
  mcpExecutor: McpToolExecutor;
}

/**
 * Default MCP executor that works in agent context
 * Uses global MCP_DOCKER_tools if available
 */
export function createDefaultMcpExecutor(): McpToolExecutor {
  return async (toolName: string, args: Record<string, unknown>): Promise<unknown> => {
    // In agent context, MCP tools are available as global functions
    const globalScope = globalThis as any;
    
    // Try direct global function first
    const globalFuncName = `MCP_DOCKER_${toolName}`;
    if (typeof globalScope[globalFuncName] === 'function') {
      return await globalScope[globalFuncName](args);
    }
    
    // Fallback to mcp-exec
    if (typeof globalScope.MCP_DOCKER_mcp_exec === 'function') {
      return await globalScope.MCP_DOCKER_mcp_exec({ name: toolName, arguments: args });
    }
    
    throw new Error(`MCP tool ${toolName} not available. Ensure MCP_DOCKER tools are loaded in the runtime context.`);
  };
}

export class NotionRegistryClient {
  private mcpExecutor: McpToolExecutor;
  
  constructor(private config: NotionClientConfig) {
    this.mcpExecutor = config.mcpExecutor || createDefaultMcpExecutor();
  }

  // ==================== Query Methods ====================

  /**
   * Query all agents from Notion database
   */
  async queryAgents(): Promise<CanonicalAgent[]> {
    const pages = await this.queryDatabase(this.config.databases.agentsDbId);
    return Promise.all(pages.map(page => this.notionPageToAgent(page)));
  }

  /**
   * Query all skills from Notion database
   */
  async querySkills(): Promise<CanonicalSkill[]> {
    const pages = await this.queryDatabase(this.config.databases.skillsDbId);
    return Promise.all(pages.map(page => this.notionPageToSkill(page)));
  }

  /**
   * Query all commands from Notion database
   */
  async queryCommands(): Promise<CanonicalCommand[]> {
    const pages = await this.queryDatabase(this.config.databases.commandsDbId);
    return pages.map(page => this.notionPageToCommand(page));
  }

  /**
   * Query all workflows from Notion database
   */
  async queryWorkflows(): Promise<CanonicalWorkflow[]> {
    const pages = await this.queryDatabase(this.config.databases.workflowsDbId);
    return pages.map(page => this.notionPageToWorkflow(page));
  }

  // ==================== Create Methods ====================

  /**
   * Create a new agent in Notion
   */
  async createAgent(agent: CanonicalAgent): Promise<string> {
    this.validateAgent(agent);
    const properties = await this.canonicalAgentToNotionProperties(agent);
    const pageId = await this.createPage(this.config.databases.agentsDbId, properties);
    return pageId;
  }

  /**
   * Create a new skill in Notion
   */
  async createSkill(skill: CanonicalSkill): Promise<string> {
    this.validateSkill(skill);
    const properties = await this.canonicalSkillToNotionProperties(skill);
    const pageId = await this.createPage(this.config.databases.skillsDbId, properties);
    return pageId;
  }

  /**
   * Create a new command in Notion
   */
  async createCommand(cmd: CanonicalCommand): Promise<string> {
    this.validateCommand(cmd);
    const properties = await this.canonicalCommandToNotionProperties(cmd);
    const pageId = await this.createPage(this.config.databases.commandsDbId, properties);
    return pageId;
  }

  /**
   * Create a new workflow in Notion
   */
  async createWorkflow(wf: CanonicalWorkflow): Promise<string> {
    this.validateWorkflow(wf);
    const properties = await this.canonicalWorkflowToNotionProperties(wf);
    const pageId = await this.createPage(this.config.databases.workflowsDbId, properties);
    return pageId;
  }

  /**
   * Create a sync run record in Notion
   */
  async createSyncRun(run: SyncRun): Promise<string> {
    const properties = this.syncRunToNotionProperties(run);
    const pageId = await this.createPage(this.config.databases.syncRegistryDbId, properties);
    return pageId;
  }

  // ==================== Update Methods ====================

  /**
   * Update an existing agent in Notion
   */
  async updateAgent(pageId: string, agent: Partial<CanonicalAgent>): Promise<void> {
    const properties = await this.canonicalAgentToNotionProperties(agent as CanonicalAgent, true);
    await this.updatePage(pageId, properties);
  }

  /**
   * Update an existing skill in Notion
   */
  async updateSkill(pageId: string, skill: Partial<CanonicalSkill>): Promise<void> {
    const properties = await this.canonicalSkillToNotionProperties(skill as CanonicalSkill, true);
    await this.updatePage(pageId, properties);
  }

  /**
   * Update an existing command in Notion
   */
  async updateCommand(pageId: string, cmd: Partial<CanonicalCommand>): Promise<void> {
    const properties = await this.canonicalCommandToNotionProperties(cmd as CanonicalCommand, true);
    await this.updatePage(pageId, properties);
  }

  /**
   * Update an existing workflow in Notion
   */
  async updateWorkflow(pageId: string, wf: Partial<CanonicalWorkflow>): Promise<void> {
    const properties = await this.canonicalWorkflowToNotionProperties(wf as CanonicalWorkflow, true);
    await this.updatePage(pageId, properties);
  }

  // ==================== Private Helpers ====================

  /**
   * Query a Notion database and return all pages
   */
  private async queryDatabase(databaseId: string): Promise<NotionPage[]> {
    try {
      const response = await this.mcpExecutor("notion-query-database-view", {
        view_url: `https://www.notion.so/${databaseId}`,
      });
      
      // Parse response and extract pages
      // The MCP tool returns results in a specific format
      const pages: NotionPage[] = [];
      
      if (response && typeof response === "object") {
        // Handle various response formats from Notion MCP
        const results = (response as any).results || (response as any).pages || [];
        
        for (const page of results) {
          pages.push({
            id: page.id,
            properties: page.properties || {},
            url: page.url || `https://www.notion.so/${page.id}`,
          });
        }
      }
      
      return pages;
    } catch (error) {
      throw new NotionApiError(
        "query-database",
        (error as any)?.statusCode || 500,
        `Failed to query database ${databaseId}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create a page in Notion
   */
  private async createPage(databaseId: string, properties: Record<string, unknown>): Promise<string> {
    try {
      const response = await this.mcpExecutor("notion-create-pages", {
        parent: { database_id: databaseId },
        pages: [{ properties }],
      });
      
      // Extract page ID from response
      const pageId = (response as any)?.id || (response as any)?.pageId || "";
      
      if (!pageId) {
        throw new Error("No page ID returned from creation");
      }
      
      return pageId;
    } catch (error) {
      throw new NotionApiError(
        "create-page",
        (error as any)?.statusCode || 500,
        `Failed to create page in database ${databaseId}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Update a page in Notion
   */
  private async updatePage(pageId: string, properties: Record<string, unknown>): Promise<void> {
    try {
      await this.mcpExecutor("notion-update-page", {
        page_id: pageId,
        command: "update_properties",
        properties,
      });
    } catch (error) {
      throw new NotionApiError(
        "update-page",
        (error as any)?.statusCode || 500,
        `Failed to update page ${pageId}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Resolve string IDs to Notion page IDs for relations
   */
  private async resolveRelations(
    relationIds: string[],
    entityType: "agent" | "skill" | "command" | "workflow"
  ): Promise<Array<{ id: string }>> {
    if (!relationIds || relationIds.length === 0) {
      return [];
    }

    // Build lookup maps from cached queries
    const lookupMap = await this.buildEntityMap(entityType);
    
    const resolved = relationIds
      .map(id => lookupMap.get(id))
      .filter((pageId): pageId is string => Boolean(pageId))
      .map(pageId => ({ id: pageId }));
    
    // Log warning for missing relations (but don't fail)
    const missing = relationIds.filter(id => !lookupMap.get(id));
    if (missing.length > 0) {
      console.warn(`[NotionClient] Missing ${entityType} relations:`, missing);
    }
    
    return resolved;
  }

  /**
   * Build a map from entity ID to Notion page ID
   */
  private async buildEntityMap(entityType: "agent" | "skill" | "command" | "workflow"): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    
    // For MVP, we assume entities are already cached from query methods
    // The map will be built from the Notion page results
    // TODO: Implement proper caching layer for production use
    
    return map;
  }

  // ==================== Validation ====================

  private validateAgent(agent: CanonicalAgent): void {
    const errors: string[] = [];
    
    if (!agent.displayName?.trim()) {
      errors.push("displayName is required and cannot be empty");
    }
    if (!agent.id?.trim()) {
      errors.push("id is required and cannot be empty");
    }
    if (!agent.type) {
      errors.push("type is required");
    }
    if (!agent.status) {
      errors.push("status is required");
    }
    if (!agent.sourcePath?.trim()) {
      errors.push("sourcePath is required and cannot be empty");
    }
    
    if (errors.length > 0) {
      throw new ValidationError(errors[0], `Agent validation failed: ${errors.join("; ")}`);
    }
  }

  private validateSkill(skill: CanonicalSkill): void {
    const errors: string[] = [];
    
    if (!skill.id?.trim()) {
      errors.push("id is required and cannot be empty");
    }
    if (!skill.status) {
      errors.push("status is required");
    }
    if (!skill.sourcePath?.trim()) {
      errors.push("sourcePath is required and cannot be empty");
    }
    
    if (errors.length > 0) {
      throw new ValidationError(errors[0], `Skill validation failed: ${errors.join("; ")}`);
    }
  }

  private validateCommand(cmd: CanonicalCommand): void {
    const errors: string[] = [];
    
    if (!cmd.id?.trim()) {
      errors.push("id is required and cannot be empty");
    }
    if (!cmd.status) {
      errors.push("status is required");
    }
    if (!cmd.sourcePath?.trim()) {
      errors.push("sourcePath is required and cannot be empty");
    }
    
    if (errors.length > 0) {
      throw new ValidationError(errors[0], `Command validation failed: ${errors.join("; ")}`);
    }
  }

  private validateWorkflow(wf: CanonicalWorkflow): void {
    const errors: string[] = [];
    
    if (!wf.code?.trim()) {
      errors.push("code is required and cannot be empty");
    }
    if (!wf.status) {
      errors.push("status is required");
    }
    if (!wf.sourcePath?.trim()) {
      errors.push("sourcePath is required and cannot be empty");
    }
    
    if (errors.length > 0) {
      throw new ValidationError(errors[0], `Workflow validation failed: ${errors.join("; ")}`);
    }
  }

  // ==================== Notion Page → Canonical Type ====================

  private async notionPageToAgent(page: NotionPage): Promise<CanonicalAgent> {
    const props = page.properties;
    
    return {
      id: this.extractTitle(props.Name || props.name || props.title),
      displayName: this.extractRichText(props.DisplayName || props["Display Name"] || props.displayName),
      persona: this.extractRichTextOptional(props.Persona || props.persona),
      type: this.extractSelect(props.Type || props.type) as any,
      category: this.extractSelectOptional(props.Category || props.category) as any,
      status: this.extractSelect(props.Status || props.status) as any,
      sourcePath: this.extractRichText(props.SourcePath || props["Source Path"] || props.sourcePath),
      skills: this.extractRelationIds(props.Skills || props.skills),
      commands: this.extractRelationIds(props.Commands || props.commands),
      workflows: this.extractRelationIds(props.Workflows || props.workflows),
      configFile: this.extractRichTextOptional(props.ConfigFile || props["Config File"] || props.configFile),
      groupId: this.extractRichTextOptional(props.GroupID || props["Group ID"] || props.groupId),
      lastSynced: this.extractDateOptional(props.LastSynced || props["Last Synced"] || props.lastSynced),
    };
  }

  private notionPageToSkill(page: NotionPage): CanonicalSkill {
    const props = page.properties;
    
    return {
      id: this.extractTitle(props.Name || props.name || props.title),
      displayName: this.extractRichTextOptional(props.DisplayName || props["Display Name"] || props.displayName),
      category: this.extractSelectOptional(props.Category || props.category) as any,
      description: this.extractRichTextOptional(props.Description || props.description),
      sourcePath: this.extractRichText(props.SourcePath || props["Source Path"] || props.sourcePath),
      requiredTools: this.extractMultiSelectOptional(props.RequiredTools || props["Required Tools"] || props.requiredTools) as any,
      status: this.extractSelect(props.Status || props.status) as any,
      agents: this.extractRelationIds(props.Agents || props.agents),
      usageCount: this.extractNumberOptional(props.UsageCount || props["Usage Count"] || props.usageCount),
      lastUsed: this.extractDateOptional(props.LastUsed || props["Last Used"] || props.lastUsed),
    };
  }

  private notionPageToCommand(page: NotionPage): CanonicalCommand {
    const props = page.properties;
    
    return {
      id: this.extractTitle(props.Name || props.name || props.title),
      intent: this.extractRichTextOptional(props.Intent || props.intent),
      category: this.extractSelectOptional(props.Category || props.category) as any,
      sourcePath: this.extractRichText(props.SourcePath || props["Source Path"] || props.sourcePath),
      inputSchema: this.extractRichTextOptional(props.InputSchema || props["Input Schema"] || props.inputSchema),
      outputSchema: this.extractRichTextOptional(props.OutputSchema || props["Output Schema"] || props.outputSchema),
      requiresHitl: this.extractCheckboxOptional(props.RequiresHITL || props["Requires HITL"] || props.requiresHitl),
      status: this.extractSelect(props.Status || props.status) as any,
      skills: this.extractRelationIds(props.Skills || props.skills),
      agents: this.extractRelationIds(props.Agents || props.agents),
    };
  }

  private notionPageToWorkflow(page: NotionPage): CanonicalWorkflow {
    const props = page.properties;
    
    return {
      code: this.extractTitle(props.Code || props.code || props.Name || props.name || props.title),
      name: this.extractRichTextOptional(props.Name || props.name || props.DisplayName || props.displayName),
      module: this.extractSelectOptional(props.Module || props.module) as any,
      phase: this.extractSelectOptional(props.Phase || props.phase) as any,
      description: this.extractRichTextOptional(props.Description || props.description),
      agent: this.extractRelationIdSingle(props.Agent || props.agent),
      required: this.extractCheckboxOptional(props.Required || props.required),
      sequence: this.extractNumberOptional(props.Sequence || props.sequence),
      sourcePath: this.extractRichText(props.SourcePath || props["Source Path"] || props.sourcePath),
      status: this.extractSelect(props.Status || props.status) as any,
    };
  }

  private syncRunToNotionProperties(run: SyncRun): Record<string, unknown> {
    return {
      "Run ID": { title: [{ text: { content: run.runId } }] },
      "Run Date": { date: { start: run.runDate.toISOString() } },
      "Status": { select: { name: run.status } },
      "Agents Synced": { number: run.agentsSynced },
      "Skills Synced": { number: run.skillsSynced },
      "Commands Synced": { number: run.commandsSynced },
      "Workflows Synced": { number: run.workflowsSynced },
      "Drift Report": run.driftReport ? { rich_text: [{ text: { content: run.driftReport } }] } : undefined,
      "Broken Links": { number: run.brokenLinks },
      "Missing Local": { number: run.missingLocal },
      "Missing Notion": { number: run.missingNotion },
    };
  }

  // ==================== Canonical Type → Notion Properties ====================

  private async canonicalAgentToNotionProperties(
    agent: CanonicalAgent,
    partial = false
  ): Promise<Record<string, unknown>> {
    const properties: Record<string, unknown> = {};
    
    if (!partial || agent.id !== undefined) {
      properties.Name = { title: [{ text: { content: agent.id } }] };
    }
    if (!partial || agent.displayName !== undefined) {
      properties["Display Name"] = { rich_text: [{ text: { content: agent.displayName } }] };
    }
    if (agent.persona !== undefined) {
      properties.Persona = { rich_text: [{ text: { content: agent.persona } }] };
    }
    if (!partial || agent.type !== undefined) {
      properties.Type = { select: { name: agent.type } };
    }
    if (agent.category !== undefined) {
      properties.Category = { select: { name: agent.category } };
    }
    if (!partial || agent.status !== undefined) {
      properties.Status = { select: { name: agent.status } };
    }
    if (!partial || agent.sourcePath !== undefined) {
      properties["Source Path"] = { rich_text: [{ text: { content: agent.sourcePath } }] };
    }
    if (agent.skills !== undefined) {
      properties.Skills = { relation: await this.resolveRelations(agent.skills, "skill") };
    }
    if (agent.commands !== undefined) {
      properties.Commands = { relation: await this.resolveRelations(agent.commands, "command") };
    }
    if (agent.workflows !== undefined) {
      properties.Workflows = { relation: await this.resolveRelations(agent.workflows, "workflow") };
    }
    if (agent.configFile !== undefined) {
      properties["Config File"] = { rich_text: [{ text: { content: agent.configFile } }] };
    }
    if (agent.groupId !== undefined) {
      properties["Group ID"] = { rich_text: [{ text: { content: agent.groupId } }] };
    }
    if (agent.lastSynced !== undefined) {
      properties["Last Synced"] = { date: { start: agent.lastSynced.toISOString() } };
    }
    
    return properties;
  }

  private async canonicalSkillToNotionProperties(
    skill: CanonicalSkill,
    partial = false
  ): Promise<Record<string, unknown>> {
    const properties: Record<string, unknown> = {};
    
    if (!partial || skill.id !== undefined) {
      properties.Name = { title: [{ text: { content: skill.id } }] };
    }
    if (skill.displayName !== undefined) {
      properties["Display Name"] = { rich_text: [{ text: { content: skill.displayName } }] };
    }
    if (skill.category !== undefined) {
      properties.Category = { select: { name: skill.category } };
    }
    if (skill.description !== undefined) {
      properties.Description = { rich_text: [{ text: { content: skill.description } }] };
    }
    if (!partial || skill.sourcePath !== undefined) {
      properties["Source Path"] = { rich_text: [{ text: { content: skill.sourcePath } }] };
    }
    if (skill.requiredTools !== undefined) {
      properties["Required Tools"] = { multi_select: skill.requiredTools.map(t => ({ name: t })) };
    }
    if (!partial || skill.status !== undefined) {
      properties.Status = { select: { name: skill.status } };
    }
    if (skill.agents !== undefined) {
      properties.Agents = { relation: await this.resolveRelations(skill.agents, "agent") };
    }
    if (skill.usageCount !== undefined) {
      properties["Usage Count"] = { number: skill.usageCount };
    }
    if (skill.lastUsed !== undefined) {
      properties["Last Used"] = { date: { start: skill.lastUsed.toISOString() } };
    }
    
    return properties;
  }

  private async canonicalCommandToNotionProperties(
    cmd: CanonicalCommand,
    partial = false
  ): Promise<Record<string, unknown>> {
    const properties: Record<string, unknown> = {};
    
    if (!partial || cmd.id !== undefined) {
      properties.Name = { title: [{ text: { content: cmd.id } }] };
    }
    if (cmd.intent !== undefined) {
      properties.Intent = { rich_text: [{ text: { content: cmd.intent } }] };
    }
    if (cmd.category !== undefined) {
      properties.Category = { select: { name: cmd.category } };
    }
    if (!partial || cmd.sourcePath !== undefined) {
      properties["Source Path"] = { rich_text: [{ text: { content: cmd.sourcePath } }] };
    }
    if (cmd.inputSchema !== undefined) {
      properties["Input Schema"] = { rich_text: [{ text: { content: cmd.inputSchema } }] };
    }
    if (cmd.outputSchema !== undefined) {
      properties["Output Schema"] = { rich_text: [{ text: { content: cmd.outputSchema } }] };
    }
    if (cmd.requiresHitl !== undefined) {
      properties["Requires HITL"] = { checkbox: cmd.requiresHitl };
    }
    if (!partial || cmd.status !== undefined) {
      properties.Status = { select: { name: cmd.status } };
    }
    if (cmd.skills !== undefined) {
      properties.Skills = { relation: await this.resolveRelations(cmd.skills, "skill") };
    }
    if (cmd.agents !== undefined) {
      properties.Agents = { relation: await this.resolveRelations(cmd.agents, "agent") };
    }
    
    return properties;
  }

  private async canonicalWorkflowToNotionProperties(
    wf: CanonicalWorkflow,
    partial = false
  ): Promise<Record<string, unknown>> {
    const properties: Record<string, unknown> = {};
    
    if (!partial || wf.code !== undefined) {
      properties.Code = { title: [{ text: { content: wf.code } }] };
    }
    if (wf.name !== undefined) {
      properties.Name = { rich_text: [{ text: { content: wf.name } }] };
    }
    if (wf.module !== undefined) {
      properties.Module = { select: { name: wf.module } };
    }
    if (wf.phase !== undefined) {
      properties.Phase = { select: { name: wf.phase } };
    }
    if (wf.description !== undefined) {
      properties.Description = { rich_text: [{ text: { content: wf.description } }] };
    }
    if (wf.agent !== undefined) {
      const resolved = await this.resolveRelations([wf.agent], "agent");
      properties.Agent = { relation: resolved };
    }
    if (wf.required !== undefined) {
      properties.Required = { checkbox: wf.required };
    }
    if (wf.sequence !== undefined) {
      properties.Sequence = { number: wf.sequence };
    }
    if (!partial || wf.sourcePath !== undefined) {
      properties["Source Path"] = { rich_text: [{ text: { content: wf.sourcePath } }] };
    }
    if (!partial || wf.status !== undefined) {
      properties.Status = { select: { name: wf.status } };
    }
    
    return properties;
  }

  // ==================== Property Extractors ====================

  private extractTitle(prop: any): string {
    if (!prop) return "";
    if (prop.title && Array.isArray(prop.title) && prop.title[0]?.text?.content) {
      return prop.title[0].text.content;
    }
    return "";
  }

  private extractRichText(prop: any): string {
    if (!prop) return "";
    if (prop.rich_text && Array.isArray(prop.rich_text) && prop.rich_text[0]?.text?.content) {
      return prop.rich_text[0].text.content;
    }
    return "";
  }

  private extractRichTextOptional(prop: any): string | undefined {
    const value = this.extractRichText(prop);
    return value || undefined;
  }

  private extractSelect(prop: any): string {
    if (!prop) return "";
    if (prop.select?.name) {
      return prop.select.name;
    }
    return "";
  }

  private extractSelectOptional(prop: any): string | undefined {
    const value = this.extractSelect(prop);
    return value || undefined;
  }

  private extractMultiSelectOptional(prop: any): string[] | undefined {
    if (!prop || !prop.multi_select || !Array.isArray(prop.multi_select)) {
      return undefined;
    }
    const values = prop.multi_select.map((item: any) => item.name).filter(Boolean);
    return values.length > 0 ? values : undefined;
  }

  private extractNumberOptional(prop: any): number | undefined {
    if (!prop || prop.number === null || prop.number === undefined) {
      return undefined;
    }
    return prop.number;
  }

  private extractDateOptional(prop: any): Date | undefined {
    if (!prop || !prop.date?.start) {
      return undefined;
    }
    return new Date(prop.date.start);
  }

  private extractCheckboxOptional(prop: any): boolean | undefined {
    if (!prop || prop.checkbox === null || prop.checkbox === undefined) {
      return undefined;
    }
    return prop.checkbox;
  }

  private extractRelationIds(prop: any): string[] {
    if (!prop || !prop.relation || !Array.isArray(prop.relation)) {
      return [];
    }
    // Note: We can only extract page IDs here, not the actual entity IDs
    // This would require an additional lookup to map page IDs back to entity IDs
    return prop.relation.map((item: any) => item.id);
  }

  private extractRelationIdSingle(prop: any): string | undefined {
    const ids = this.extractRelationIds(prop);
    return ids.length > 0 ? ids[0] : undefined;
  }
}