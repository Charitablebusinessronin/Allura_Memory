import { describe, expect, it } from 'vitest'

import { createCuratorRuntime } from './service-factory'

describe('createCuratorRuntime', () => {
  it('creates shared curator and approval-sync services', () => {
    const runtime = createCuratorRuntime()

    expect(runtime.curatorService).toBeDefined()
    expect(runtime.approvalSyncService).toBeDefined()
    expect(runtime.neo4jClient).toBeDefined()
    expect(runtime.notionClient).toBeDefined()
    expect(runtime.postgresClient).toBeDefined()
  })
})
