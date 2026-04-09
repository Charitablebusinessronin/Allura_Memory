# MCP Builder Skill

Build Model Context Protocol (MCP) servers for Allura agents.

## Usage
```typescript
// Create MCP server
const server = new MCPServer({
  name: "allura-memory",
  version: "1.0.0"
});

// Register tools
server.registerTool("memory_retrieve", async (args) => {
  // Implementation
});
```

## Best Practices
- Use stdio transport for local servers
- Implement proper error handling
- Log all operations to PostgreSQL
- Validate group_id on every request
