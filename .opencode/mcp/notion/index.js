#!/usr/bin/env node
/**
 * Notion MCP Server for Allura Memory
 * Handles OAuth authentication and provides Notion API access
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Token storage
const TOKEN_PATH = path.join(os.homedir(), '.config', 'allura-memory', 'notion-token.json');

function getNotionToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      return data.access_token;
    }
  } catch (error) {
    console.error('Error reading token:', error);
  }
  return process.env.NOTION_TOKEN || null;
}

// Notion API client
async function notionApi(endpoint, options = {}) {
  const token = getNotionToken();
  if (!token) {
    throw new Error('Notion token not found. Run ./scripts/notion-oauth.sh first.');
  }
  
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

// MCP Server
const server = new Server(
  {
    name: 'notion-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_notion',
        description: 'Search Notion pages and databases',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_page',
        description: 'Get a Notion page by ID',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: {
              type: 'string',
              description: 'Notion page ID'
            }
          },
          required: ['page_id']
        }
      },
      {
        name: 'get_database',
        description: 'Get a Notion database by ID',
        inputSchema: {
          type: 'object',
          properties: {
            database_id: {
              type: 'string',
              description: 'Notion database ID'
            }
          },
          required: ['database_id']
        }
      },
      {
        name: 'query_database',
        description: 'Query a Notion database',
        inputSchema: {
          type: 'object',
          properties: {
            database_id: {
              type: 'string',
              description: 'Notion database ID'
            },
            filter: {
              type: 'object',
              description: 'Query filter'
            }
          },
          required: ['database_id']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'search_notion': {
        const results = await notionApi('/search', {
          method: 'POST',
          body: JSON.stringify({ query: args.query })
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }
      
      case 'get_page': {
        const page = await notionApi(`/pages/${args.page_id}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page, null, 2)
            }
          ]
        };
      }
      
      case 'get_database': {
        const database = await notionApi(`/databases/${args.database_id}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(database, null, 2)
            }
          ]
        };
      }
      
      case 'query_database': {
        const results = await notionApi(`/databases/${args.database_id}/query`, {
          method: 'POST',
          body: JSON.stringify({ filter: args.filter })
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Notion MCP Server running on stdio');