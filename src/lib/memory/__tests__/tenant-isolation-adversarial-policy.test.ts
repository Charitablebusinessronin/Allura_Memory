import { describe, expect, it } from "vitest"

type TenantId = (typeof TENANTS)[number]
type Operation = (typeof OPERATIONS)[number]

const TENANTS = [
  "allura-alpha",
  "allura-beta",
  "allura-gamma",
  "allura-delta",
  "allura-epsilon",
  "allura-system",
] as const

const OPERATIONS = [
  "memory_get",
  "memory_list",
  "memory_search",
  "memory_update",
  "memory_delete",
  "memory_promote",
  "memory_export",
] as const

const MEMORY_BY_TENANT: Record<TenantId, { id: string; group_id: TenantId; content: string }> = Object.fromEntries(
  TENANTS.map((tenant) => [
    tenant,
    {
      id: `${tenant}-memory-001`,
      group_id: tenant,
      content: `private memory for ${tenant}`,
    },
  ])
) as Record<TenantId, { id: string; group_id: TenantId; content: string }>

class MemoryNotFoundError extends Error {
  constructor(id: string, groupId: string) {
    super(`Memory not found: ${id} in ${groupId}`)
    this.name = "MemoryNotFoundError"
  }
}

function findMemory(id: string, groupId: TenantId) {
  const memory = Object.values(MEMORY_BY_TENANT).find((candidate) => candidate.id === id)
  if (!memory || memory.group_id !== groupId) {
    throw new MemoryNotFoundError(id, groupId)
  }
  return memory
}

const canonicalTenantScopedOperations = {
  memory_get(groupId: TenantId, id = MEMORY_BY_TENANT[groupId].id) {
    return findMemory(id, groupId)
  },
  memory_list(groupId: TenantId) {
    return Object.values(MEMORY_BY_TENANT).filter((memory) => memory.group_id === groupId)
  },
  memory_search(groupId: TenantId, query = "private memory") {
    return Object.values(MEMORY_BY_TENANT).filter(
      (memory) => memory.group_id === groupId && memory.content.includes(query)
    )
  },
  memory_update(groupId: TenantId, id = MEMORY_BY_TENANT[groupId].id) {
    const previous = findMemory(id, groupId)
    return {
      id: `${previous.id}-v2`,
      previous_id: previous.id,
      group_id: groupId,
    }
  },
  memory_delete(groupId: TenantId, id = MEMORY_BY_TENANT[groupId].id) {
    const memory = findMemory(id, groupId)
    return {
      id: memory.id,
      deleted: true,
      group_id: groupId,
    }
  },
  memory_promote(groupId: TenantId, id = MEMORY_BY_TENANT[groupId].id) {
    const memory = findMemory(id, groupId)
    return {
      id: memory.id,
      proposal_id: `${memory.id}-proposal`,
      status: "queued",
      group_id: groupId,
    }
  },
  memory_export(groupId: TenantId) {
    return {
      group_id: groupId,
      memories: Object.values(MEMORY_BY_TENANT).filter((memory) => memory.group_id === groupId),
    }
  },
}

function orderedCrossTenantPairs() {
  return TENANTS.flatMap((attacker) =>
    TENANTS.filter((victim) => victim !== attacker).map((victim) => ({ attacker, victim }))
  )
}

function assertSelfAccess(operation: Operation, tenant: TenantId) {
  const result = canonicalTenantScopedOperations[operation](tenant as never) as any

  if (Array.isArray(result)) {
    expect(result).toHaveLength(1)
    expect(result[0].group_id).toBe(tenant)
    return
  }

  if ("memories" in result) {
    expect(result.memories).toHaveLength(1)
    expect(result.memories[0].group_id).toBe(tenant)
    return
  }

  expect(result.group_id).toBe(tenant)
}

function assertCrossTenantBlocked(operation: Operation, attacker: TenantId, victim: TenantId) {
  const victimMemoryId = MEMORY_BY_TENANT[victim].id

  switch (operation) {
    case "memory_get":
    case "memory_update":
    case "memory_delete":
    case "memory_promote":
      expect(() => canonicalTenantScopedOperations[operation](attacker as never, victimMemoryId as never)).toThrow(
        MemoryNotFoundError
      )
      return
    case "memory_list": {
      const results = canonicalTenantScopedOperations.memory_list(attacker)
      expect(results.every((memory) => memory.group_id === attacker)).toBe(true)
      expect(results.some((memory) => memory.group_id === victim || memory.id === victimMemoryId)).toBe(false)
      return
    }
    case "memory_search": {
      const results = canonicalTenantScopedOperations.memory_search(attacker, "private memory")
      expect(results.every((memory) => memory.group_id === attacker)).toBe(true)
      expect(results.some((memory) => memory.group_id === victim || memory.id === victimMemoryId)).toBe(false)
      return
    }
    case "memory_export": {
      const result = canonicalTenantScopedOperations.memory_export(attacker)
      expect(result.memories.every((memory) => memory.group_id === attacker)).toBe(true)
      expect(result.memories.some((memory) => memory.group_id === victim || memory.id === victimMemoryId)).toBe(false)
      return
    }
  }
}

describe("Tenant isolation adversarial policy matrix", () => {
  for (const tenant of TENANTS) {
    for (const operation of OPERATIONS) {
      it(`${operation} allows self access for ${tenant}`, () => {
        assertSelfAccess(operation, tenant)
      })
    }
  }

  for (const { attacker, victim } of orderedCrossTenantPairs()) {
    for (const operation of OPERATIONS) {
      it(`${operation} blocks ${attacker} from accessing ${victim}`, () => {
        assertCrossTenantBlocked(operation, attacker, victim)
      })
    }
  }

  it("covers the required adversarial matrix size", () => {
    expect(TENANTS).toHaveLength(6)
    expect(OPERATIONS).toHaveLength(7)
    expect(orderedCrossTenantPairs()).toHaveLength(30)
    expect(TENANTS.length * OPERATIONS.length + orderedCrossTenantPairs().length * OPERATIONS.length).toBe(252)
  })
})
