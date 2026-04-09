/**
 * @allura/opencode-plugin
 * Allura Memory Engine Plugin for OpenCode
 *
 * Provides persistent AI memory with curator-gated promotion.
 * Tools: memory_retrieve, memory_write, memory_propose_insight
 *
 * One-click install:
 *   npm install @allura/opencode-plugin
 */

export default {
  name: '@allura/opencode-plugin',
  version: '1.0.0',
  description: 'Persistent AI memory engine with curator-gated promotion',

  /**
   * Called when OpenCode loads the plugin
   */
  async onLoad(opencode) {
    this.opencode = opencode;

    const mcpUrl = process.env.ALLURA_MCP_URL || 'http://localhost:3100/mcp';
    const apiKey = process.env.ALLURA_API_KEY || '';

    try {
      // Register the Allura MCP server
      await opencode.mcp.register({
        name: 'allura',
        transport: 'http',
        url: mcpUrl,
        headers: apiKey ? {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        },
        enabled: true
      });

      console.log('✓ Allura memory engine loaded');
      console.log(`  MCP Server: ${mcpUrl}`);
      console.log('  Tools: memory_retrieve, memory_write, memory_propose_insight');

    } catch (error) {
      console.error('✗ Failed to load Allura plugin:', error.message);
      console.error('  Make sure Allura MCP server is running at:', mcpUrl);
      throw error;
    }
  },

  /**
   * Called when OpenCode unloads the plugin
   */
  async onUnload() {
    try {
      if (this.opencode && this.opencode.mcp) {
        await this.opencode.mcp.unregister('allura');
        console.log('✓ Allura memory engine unloaded');
      }
    } catch (error) {
      console.error('Error unloading Allura plugin:', error.message);
    }
  },

  /**
   * Optional: Provide plugin metadata
   */
  getMetadata() {
    return {
      name: '@allura/opencode-plugin',
      version: '1.0.0',
      author: 'ronin704',
      description: 'Persistent AI memory with curator-gated knowledge promotion',
      tools: [
        {
          name: 'memory_retrieve',
          description: 'Search for memories by query (episodic + semantic)',
          schema: {
            query: 'string',
            limit: 'number (optional)'
          }
        },
        {
          name: 'memory_write',
          description: 'Log an event or observation to memory',
          schema: {
            event: 'string',
            metadata: 'object (optional)'
          }
        },
        {
          name: 'memory_propose_insight',
          description: 'Propose an insight for curator approval',
          schema: {
            title: 'string',
            statement: 'string',
            confidence: 'number (optional, 0-1)'
          }
        }
      ]
    };
  }
};
