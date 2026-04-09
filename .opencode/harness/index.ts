/**
 * Allura Harness Orchestrator
 *
 * Central router for:
 * - MCP plugin loading (explicit approval)
 * - Skill discovery + execution
 * - Agent delegation (surgical team)
 * - Event logging (Postgres)
 *
 * Principle: "Allura governs. Runtimes execute. Curators promote."
 */

import { mcpLoader, type MCPServer } from "./mcp-plugin-loader";
import { skillLoader, type SkillMapping } from "./skill-loader";
import {
  logMCPDiscovered,
  logMCPApproved,
  logMCPLoaded,
  logSkillProposed,
  logSkillLoaded,
  logHarnessError,
} from "./event-logger";

export interface HarnessConfig {
  group_id: string;
  agent_id: string; // Current agent (default: "brooks")
  postgres_url?: string;
  neo4j_url?: string;
  enable_logging?: boolean; // Default: true
}

export interface HarnessEvent {
  event_type: string;
  group_id: string;
  agent_id: string;
  status: "pending" | "completed" | "failed";
  metadata: Record<string, unknown>;
  timestamp: string;
}

class AlluraHarness {
  private config: HarnessConfig;

  constructor(config: HarnessConfig) {
    this.config = {
      agent_id: "brooks",
      enable_logging: true,
      ...config,
    };
  }

  /**
   * Log an event if logging is enabled
   */
  private async logEvent(
    logFn: () => Promise<number>
  ): Promise<number | null> {
    if (!this.config.enable_logging) {
      return null;
    }

    try {
      return await logFn();
    } catch (err) {
      // Log errors but don't crash
      console.warn(
        "[Harness] Event logging failed:",
        err instanceof Error ? err.message : String(err)
      );
      return null;
    }
  }

  /**
   * MCP Discovery Flow
   * 1. User asks to discover MCP servers
   * 2. List approved + unapproved
   * 3. Prompt Brooks to approve + load
   */
  async discoverMCP(keyword?: string): Promise<{
    approved: MCPServer[];
    pending: MCPServer[];
    prompt: string;
  }> {
    const results = mcpLoader.discover(keyword);

    // Log discovery event
    await this.logEvent(() =>
      logMCPDiscovered(keyword, results.approved.length, results.pending.length)
    );

    const prompt = `
🔍 MCP Discovery Results

Approved (Ready to Load):
${results.approved.map((s) => `  ✅ ${s.name}: ${s.description}`).join("\n")}

Pending Approval:
${results.pending.map((s) => `  ⏳ ${s.name}: ${s.description}${s.notes ? ` — ${s.notes}` : ""}`).join("\n")}

To load approved: mcp_add("<server_name>")
To request approval: Ask Brooks to approve in mcp-registry.yaml
`;

    return { ...results, prompt };
  }

  /**
   * MCP Approval Flow
   * Brooks reviews and approves a server
   */
  async approveMCP(serverId: string): Promise<{
    success: boolean;
    message: string;
    nextStep: string;
  }> {
    const approval = mcpLoader.requestApproval(serverId);

    if (approval.approved) {
      // Log approval event
      await this.logEvent(() => logMCPApproved(serverId, "brooks"));

      return {
        success: true,
        message: approval.prompt,
        nextStep: `Load with: mcp-load ${serverId}`,
      };
    }

    return {
      success: false,
      message: approval.prompt,
      nextStep: "Waiting for Brooks approval...",
    };
  }

  /**
   * MCP Load Flow
   * Once approved, load the server and expose tools
   */
  async loadMCP(serverId: string): Promise<{
    success: boolean;
    message: string;
    tools: string[];
  }> {
    const result = mcpLoader.loadServer(serverId);

    if (!result.success) {
      // Log error
      await this.logEvent(() =>
        logHarnessError(`loadMCP(${serverId})`, result.message)
      );
      return { success: false, message: result.message, tools: [] };
    }

    // Log load event
    await this.logEvent(() => logMCPLoaded(serverId));

    // TODO: Call actual mcp_add tool
    const tools = [
      `mcp__MCP_DOCKER__${serverId}_tool1`,
      `mcp__MCP_DOCKER__${serverId}_tool2`,
    ];

    return {
      success: true,
      message: result.message,
      tools,
    };
  }

  /**
   * Skill Proposal Flow
   * User asks to execute a skill
   * Brooks decides which agent should execute it
   */
  async proposeSkill(skillName: string): Promise<{
    found: boolean;
    skill?: SkillMapping[string];
    proposal: string;
  }> {
    const result = skillLoader.proposeSkill(skillName);

    if (result.found && result.skill) {
      // Log proposal event
      await this.logEvent(() =>
        logSkillProposed(skillName, result.skill?.executor)
      );
    }

    return result;
  }

  /**
   * Skill Load Flow
   * Brooks decides executor → route to agent
   */
  async loadSkill(
    skillName: string,
    executor: string = "brooks"
  ): Promise<{
    success: boolean;
    instruction: string;
    event: HarnessEvent;
  }> {
    const result = skillLoader.loadSkill(skillName, executor);

    const event: HarnessEvent = {
      event_type: "SKILL_LOADED",
      group_id: this.config.group_id,
      agent_id: this.config.agent_id,
      status: result.success ? "completed" : "failed",
      metadata: {
        skill: skillName,
        executor,
        instruction: result.instruction,
      },
      timestamp: new Date().toISOString(),
    };

    // Log skill loaded event
    if (result.success) {
      await this.logEvent(() => logSkillLoaded(skillName, executor));
    } else {
      await this.logEvent(() =>
        logHarnessError(`loadSkill(${skillName})`, result.instruction)
      );
    }

    return {
      ...result,
      event,
    };
  }

  /**
   * List all MCP servers (CLI)
   */
  listMCP(): string {
    return mcpLoader.listAll();
  }

  /**
   * List all skills (CLI)
   */
  listSkills(): string {
    return skillLoader.listSkills();
  }

  /**
   * Status Report
   * Show what's loaded, what's pending
   */
  async status(): Promise<string> {
    const mcp = mcpLoader.discover();
    const skills = skillLoader.listSkills();

    return `
═══════════════════════════════════════
Allura Harness Status
═══════════════════════════════════════

MCP Servers
───────────
Approved: ${mcp.approved.length}
Pending:  ${mcp.pending.length}

Skills
──────
Available: 8+

Config
──────
Group ID:  ${this.config.group_id}
Agent ID:  ${this.config.agent_id}

═══════════════════════════════════════
    `;
  }

  /**
   * Log an event to Postgres (append-only)
   */
  private async logEvent(event: HarnessEvent): Promise<void> {
    if (!this.config.postgres_url) {
      console.warn("No Postgres URL configured. Skipping event log.");
      return;
    }

    // TODO: Implement actual Postgres write
    console.log("[LOG]", event);
  }
}

// Export singleton
export const harness = new AlluraHarness({
  group_id: "allura-system",
  agent_id: "brooks",
  postgres_url: process.env.DATABASE_URL,
  neo4j_url: process.env.NEO4J_URI,
});

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    switch (command) {
      case "status":
        console.log(await harness.status());
        break;

      case "mcp-discover":
        const keyword = args[1];
        const discovered = await harness.discoverMCP(keyword);
        console.log(discovered.prompt);
        break;

      case "mcp-approve":
        const serverId = args[1];
        const approval = await harness.approveMCP(serverId);
        console.log(approval.message);
        break;

      case "mcp-load":
        const loadServerId = args[1];
        const loaded = await harness.loadMCP(loadServerId);
        console.log(loaded.message);
        if (loaded.tools.length > 0) {
          console.log("Tools:", loaded.tools);
        }
        break;

      case "skill-propose":
        const skillName = args[1];
        const proposed = await harness.proposeSkill(skillName);
        console.log(proposed.proposal);
        break;

      case "skill-load":
        const skillToLoad = args[1];
        const executor = args[args.indexOf("--executor") + 1] || "brooks";
        const skillLoaded = await harness.loadSkill(skillToLoad, executor);
        console.log(skillLoaded.instruction);
        break;

      case "list-mcp":
        console.log(harness.listMCP());
        break;

      case "list-skills":
        console.log(harness.listSkills());
        break;

      default:
        console.log(`
Allura Harness — Plugin + Skill Orchestrator

Commands:
  status                    Show harness status
  mcp-discover [keyword]    Discover MCP servers
  mcp-approve <server-id>   Request approval to load server
  mcp-load <server-id>      Load an approved server
  skill-propose <name>      Propose a skill to Brooks
  skill-load <name>         Load skill (requires executor)
  list-mcp                  List all MCP servers
  list-skills               List all skills
        `);
    }
  })();
}
