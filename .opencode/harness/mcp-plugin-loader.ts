/**
 * MCP Plugin Loader — MCP Docker Integration
 *
 * Uses MCP Docker Toolkit for discovery and loading:
 * - mcp_find(keyword) → discover available servers
 * - mcp_add(server_name) → load approved servers
 *
 * Registry tracks approval status only. Discovery via MCP Docker.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

export interface MCPServer {
  name: string;
  description: string;
  env?: string[];
  approved_by?: string;
  approved_date?: string;
  notes?: string;
  command?: string[];
}

export interface MCPRegistry {
  governance: string;
  group_id: string;
  approved: MCPServer[];
  pending: MCPServer[];
  rules: string[];
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
   * Load the approval registry from YAML
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
   * List approved servers (ready to load)
   */
  listApproved(): MCPServer[] {
    const registry = this.loadRegistry();
    return registry.approved;
  }

  /**
   * List pending servers (require Brooks approval)
   */
  listPending(): MCPServer[] {
    const registry = this.loadRegistry();
    return registry.pending;
  }

  /**
   * Discover servers via MCP Docker Toolkit
   * Note: This is a wrapper around mcp_find(keyword)
   * The actual discovery happens via MCP Docker tools
   */
  discover(keyword?: string): {
    approved: MCPServer[];
    pending: MCPServer[];
    prompt: string;
  } {
    const registry = this.loadRegistry();

    const approved = keyword
      ? registry.approved.filter(
          (s) =>
            s.name.toLowerCase().includes(keyword.toLowerCase()) ||
            s.description.toLowerCase().includes(keyword.toLowerCase())
        )
      : registry.approved;

    const pending = keyword
      ? registry.pending.filter(
          (s) =>
            s.name.toLowerCase().includes(keyword.toLowerCase()) ||
            s.description.toLowerCase().includes(keyword.toLowerCase())
        )
      : registry.pending;

    const prompt = `
🔍 MCP Discovery Results

Approved (Ready to Load via mcp_add):
${approved.map((s) => `  ✅ ${s.name}: ${s.description}`).join("\n")}

Pending Approval (Brooks must approve):
${pending.map((s) => `  ⏳ ${s.name}: ${s.description}${s.notes ? ` — ${s.notes}` : ""}`).join("\n")}

To load approved: mcp_add("<server_name>")
To request approval: Ask Brooks to approve in mcp-registry.yaml
`;

    return { approved, pending, prompt };
  }

  /**
   * Request approval for a pending server
   * Returns instructions for Brooks to approve
   */
  requestApproval(serverName: string): {
    found: boolean;
    server: MCPServer | null;
    prompt: string;
  } {
    const registry = this.loadRegistry();
    const server = registry.pending.find((s) => s.name === serverName);

    if (!server) {
      return {
        found: false,
        server: null,
        prompt: `Server "${serverName}" not found in pending list. Check mcp-registry.yaml.`,
      };
    }

    return {
      found: true,
      server,
      prompt: `
📋 MCP Server Approval Request

Server: ${server.name}
Description: ${server.description}
${server.env ? `Required Environment Variables: ${server.env.join(", ")}` : ""}
${server.notes ? `Notes: ${server.notes}` : ""}

Brooks, approve this server?
→ Edit .opencode/plugin/mcp-registry.yaml
→ Move "${server.name}" from pending to approved
→ Add approved_by and approved_date
`,
    };
  }

  /**
   * Load an approved server via MCP Docker
   * Note: Actual loading happens via mcp_add(server_name)
   * This method validates approval status and returns instructions
   */
  loadServer(serverName: string): {
    success: boolean;
    message: string;
    instruction: string;
  } {
    const registry = this.loadRegistry();
    const server = registry.approved.find((s) => s.name === serverName);

    if (!server) {
      const pending = registry.pending.find((s) => s.name === serverName);
      if (pending) {
        return {
          success: false,
          message: `Server "${serverName}" is pending approval. Brooks must approve first.`,
          instruction: `Request approval: Ask Brooks to approve in mcp-registry.yaml`,
        };
      }
      return {
        success: false,
        message: `Server "${serverName}" not found in registry.`,
        instruction: `Use mcp_find("${serverName}") to discover available servers.`,
      };
    }

    return {
      success: true,
      message: `Server "${serverName}" is approved and ready to load.`,
      instruction: `Load with: mcp_add("${serverName}")`,
    };
  }

  /**
   * List all servers (CLI)
   */
  listAll(): string {
    const registry = this.loadRegistry();

    const approvedLines = registry.approved.map(
      (s) => `  ✅ ${s.name}: ${s.description}`
    );
    const pendingLines = registry.pending.map(
      (s) => `  ⏳ ${s.name}: ${s.description}`
    );

    return `
# Approved MCP Servers
${approvedLines.join("\n")}

# Pending Approval
${pendingLines.join("\n")}

# Governance Rules
${registry.rules.map((r) => `  • ${r}`).join("\n")}
`;
  }
}

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
