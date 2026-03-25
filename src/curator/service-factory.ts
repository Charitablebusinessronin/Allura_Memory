import { ApprovalSyncService } from './approval-sync.service'
import { CuratorService } from './curator.service'
import { Neo4jClientImpl } from '../integrations/neo4j.client'
import { PostgresClientImpl } from '../integrations/postgres.client'
import { DirectNotionClient } from './direct-notion-client'

export function createCuratorRuntime() {
  const neo4jClient = new Neo4jClientImpl()
  const notionClient = new DirectNotionClient()
  const postgresClient = new PostgresClientImpl()

  return {
    neo4jClient,
    notionClient,
    postgresClient,
    curatorService: new CuratorService(neo4jClient, notionClient, postgresClient),
    approvalSyncService: new ApprovalSyncService(notionClient, neo4jClient),
  }
}
