import { describe, expect, it } from "vitest"

import {
  assembleContext,
  orchestrateTeamRamTask,
  selectSkills,
  type SkillCall,
  type SkillExecutor,
} from "./orchestrator"

describe("team-ram orchestrator", () => {
  it("selects memory, graph, and trace skills for mixed tasks", () => {
    const plan = selectSkills({
      goal: "Investigate architecture decisions and recent trace events",
      groupId: "allura-roninmemory",
      cypher: "MATCH (n {group_id: $groupId}) RETURN n LIMIT 5",
      needs: { traces: true },
    })

    expect(plan.map((entry) => entry.skillName)).toEqual([
      "skill-neo4j-memory",
      "skill-cypher-query",
      "skill-database",
    ])
  })

  it("defaults to memory retrieval when no special routing hints exist", () => {
    const plan = selectSkills({
      goal: "Gather context for this task",
      groupId: "allura-roninmemory",
    })

    expect(plan).toHaveLength(1)
    expect(plan[0]?.skillName).toBe("skill-neo4j-memory")
  })

  it("dispatches calls in parallel through injected executor and assembles context", async () => {
    const calls: SkillCall[] = []
    const executor: SkillExecutor = {
      async execute(call) {
        calls.push(call)
        return { skill: call.skillName, tool: call.toolName }
      },
    }

    const result = await orchestrateTeamRamTask(
      {
        goal: "Search decisions and traces",
        groupId: "allura-roninmemory",
        needs: { memory: true, traces: true },
      },
      executor,
    )

    expect(calls).toHaveLength(2)
    expect(result.context.memories).toHaveLength(1)
    expect(result.context.traces).toHaveLength(1)
    expect(result.context.failures).toHaveLength(0)
  })

  it("retries failed calls up to maxRetriesPerSkill", async () => {
    let attempts = 0
    const executor: SkillExecutor = {
      async execute() {
        attempts += 1
        if (attempts < 2) {
          throw new Error("temporary failure")
        }
        return { ok: true }
      },
    }

    const result = await orchestrateTeamRamTask(
      {
        goal: "Recall memory context",
        groupId: "allura-roninmemory",
        maxRetriesPerSkill: 1,
      },
      executor,
    )

    expect(attempts).toBe(2)
    expect(result.results[0]?.ok).toBe(true)
    expect(result.results[0]?.attempts).toBe(2)
  })

  it("records failures in assembled context", () => {
    const context = assembleContext([
      {
        skillName: "skill-database",
        toolName: "query_traces",
        assignedAgent: "hightower",
        ok: false,
        error: "db unavailable",
        attempts: 2,
      },
    ])

    expect(context.failures).toHaveLength(1)
    expect(context.failures[0]?.skillName).toBe("skill-database")
  })
})
