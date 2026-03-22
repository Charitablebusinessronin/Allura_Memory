import { ApprovalSyncService } from './approval-sync.service'
import { CuratorService } from './curator.service'
import { INSIGHTS_DATABASE_ID } from './config'
import { McpClientImpl } from '../integrations/mcp.client'
import { Neo4jClientImpl } from '../integrations/neo4j.client'
import { NotionClientImpl } from '../integrations/notion.client'
import { PostgresClientImpl } from '../integrations/postgres.client'

export function createCuratorRuntime() {
  const mcpClient = new McpClientImpl()
  const neo4jClient = new Neo4jClientImpl()
  const notionClient = new NotionClientImpl(mcpClient, INSIGHTS_DATABASE_ID)
  const postgresClient = new PostgresClientImpl()

  return {
    mcpClient,
    neo4jClient,
    notionClient,
    postgresClient,
    curatorService: new CuratorService(neo4jClient, notionClient, postgresClient),
    approvalSyncService: new ApprovalSyncService(notionClient, neo4jClient),
  }
}
