/**
 * MCP Plugin Loader — Explicit Approval Flow
 *
 * Handles:
 * - mcp-discover <keyword> → list servers matching keyword
 * - mcp-add <server-id> → approve + load a single server
 *
 * Key: No automatic loading. Human/Brooks approves before adding.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  source: string;
  env_vars: string[];
  approved: boolean;
  approved_by?: string | null;
  approved_date?: string | null;
  notes?: string;
}

export interface MCPRegistry {
  registry_version: string;
  governance: string;
  group_id: string;
  mcp_servers: MCPServer[];
  command_routing: Record<string, unknown>;
  constraints: Record<string, unknown>;
}

class MCPPluginLoader {
  private registry: MCPRegistry | null = null;
  private registryPath: string;

  constructor(registryPath?: string) {
    this.registryPath =
      registryPath ||
      path.join(process.cwd(), ".opencode/plugin/mcp-registry.yaml");
  }

  /**
   * Load the MCP registry from YAML
   */
  private loadRegistry(): MCPRegistry {
    if (this.registry) return this.registry;

    if (!fs.existsSync(this.registryPath)) {
      throw new Error(
        `MCP registry not found at ${this.registryPath}. Create with mcp-registry.yaml.`
      );
    }

    const fileContents = fs.readFileSync(this.registryPath, "utf-8");
    this.registry = yaml.parse(fileContents) as MCPRegistry;
    return this.registry;
  }

  /**
   * Discover MCP servers by keyword
   */
  discover(keyword?: string): {
    approved: MCPServer[];
    unapproved: MCPServer[];
  } {
    const registry = this.loadRegistry();

    const results = registry.mcp_servers.filter((server) =>
      keyword
        ? server.name.toLowerCase().includes(keyword.toLowerCase()) ||
          server.description.toLowerCase().includes(keyword.toLowerCase())
        : true
    );

    return {
      approved: results.filter((s) => s.approved),
      unapproved: results.filter((s) => !s.approved),
    };
  }

  /**
   * Request approval to load a server
   * Returns a prompt for Brooks/user to approve
   */
  requestApproval(serverId: string): {
    approved: boolean;
    server: MCPServer | null;
    prompt: string;
  } {
    const registry = this.loadRegistry();
    const server = registry.mcp_servers.find((s) => s.id === serverId);

    if (!server) {
      return {
        approved: false,
        server: null,
        prompt: `Server not found: ${serverId}`,
      };
    }

    if (server.approved) {
      return {
        approved: true,
        server,
        prompt: `✅ Server ${server.name} is already approved. Ready to load.`,
      };
    }

    const prompt = `
📋 MCP Server Approval Request

Server: ${server.name}
ID: ${server.id}
Description: ${server.description}

Source: ${server.source}
Required Environment Variables: ${server.env_vars.length > 0 ? server.env_vars.join(", ") : "None"}

${server.notes ? `⚠️  Notes: ${server.notes}` : ""}

Brooks, approve this server? (yes/no)
→ mcp-add ${server.id} --approve
`;

    return {
      approved: false,
      server,
      prompt,
    };
  }

  /**
   * Approve a server (internal — called by Brooks after approval)
   */
  approveServer(
    serverId: string,
    approvedBy: string = "brooks"
  ): { success: boolean; message: string } {
    const registry = this.loadRegistry();
    const server = registry.mcp_servers.find((s) => s.id === serverId);

    if (!server) {
      return { success: false, message: `Server not found: ${serverId}` };
    }

    if (server.approved) {
      return {
        success: true,
        message: `Server ${server.name} already approved.`,
      };
    }

    // Mark as approved
    server.approved = true;
    server.approved_by = approvedBy;
    server.approved_date = new Date().toISOString().split("T")[0];

    // Write back to registry
    this.writeRegistry(registry);

    return {
      success: true,
      message: `✅ Server ${server.name} approved by ${approvedBy}. Ready to load.`,
    };
  }

  /**
   * Load an approved server (call mcp_add internally)
   */
  loadServer(serverId: string): { success: boolean; message: string } {
    const registry = this.loadRegistry();
    const server = registry.mcp_servers.find((s) => s.id === serverId);

    if (!server) {
      return { success: false, message: `Server not found: ${serverId}` };
    }

    if (!server.approved) {
      return {
        success: false,
        message: `Server ${server.name} is not approved. Request approval first with: mcp-discover ${serverId}`,
      };
    }

    // TODO: Call actual mcp_add tool here
    // For now, return the command that should be executed
    return {
      success: true,
      message: `Ready to load ${server.name}. Call: mcp_add("${server.id}")`,
    };
  }

  /**
   * Write registry back to YAML
   */
  private writeRegistry(registry: MCPRegistry): void {
    const yamlString = yaml.stringify(registry);
    fs.writeFileSync(this.registryPath, yamlString, "utf-8");
  }

  /**
   * List all servers (for CLI inspection)
   */
  listAll(): string {
    const registry = this.loadRegistry();
    let output = "# MCP Registry\n\n";

    output += "## Approved Servers (Ready to Load)\n";
    registry.mcp_servers
      .filter((s) => s.approved)
      .forEach((s) => {
        output += `- **${s.name}** (\`${s.id}\`): ${s.description}\n`;
      });

    output += "\n## Pending Approval\n";
    registry.mcp_servers
      .filter((s) => !s.approved)
      .forEach((s) => {
        output += `- **${s.name}** (\`${s.id}\`): ${s.description}\n`;
        if (s.notes) output += `  ⚠️  ${s.notes}\n`;
      });

    return output;
  }
}

// Export singleton
export const mcpLoader = new MCPPluginLoader();

// CLI entry point (for testing)
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "discover":
      const keyword = args[1];
      const results = mcpLoader.discover(keyword);
      console.log(
        "Approved:",
        results.approved.map((s) => s.id)
      );
      console.log(
        "Pending:",
        results.unapproved.map((s) => s.id)
      );
      break;

    case "list":
      console.log(mcpLoader.listAll());
      break;

    case "request-approval":
      const serverId = args[1];
      const approval = mcpLoader.requestApproval(serverId);
      console.log(approval.prompt);
      break;

    case "approve":
      const approveId = args[1];
      const approveBy = args[2] || "brooks";
      const result = mcpLoader.approveServer(approveId, approveBy);
      console.log(result.message);
      break;

    default:
      console.log("Usage: mcp-plugin-loader [discover|list|request-approval|approve] [args]");
  }
}
