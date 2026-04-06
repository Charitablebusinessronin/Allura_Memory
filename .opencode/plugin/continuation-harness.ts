/**
 * Continuation Harness Plugin for OpenCode
 *
 * Enforces task completion by intercepting idle events and injecting
 * continuation prompts when work is incomplete. Based on oh-my-openagent's
 * todo-continuation-enforcer and atlas hooks.
 *
 * ARCH-002: Continuation harness for guaranteed task completion
 *
 * Key mechanisms:
 * 1. Idle event handler - prevents premature session termination
 * 2. Todo enforcer - checks incomplete todos and injects prompts
 * 3. Verification gate - requires proof before marking complete
 * 4. Atlas tracker - tracks plan files with checkbox completion
 * 5. Stagnation detector - detects when agent is stuck
 */

import type { Plugin, PluginInput } from "@opencode-ai/plugin"

// DB integration — write-through cache backed by PostgreSQL events table
// Attempt 1: reuse existing trace infrastructure (preferred path)
// Fallback: inline pg.Pool if relative imports fail at OpenCode plugin load time
let logTrace: ((t: TraceLogInput) => Promise<unknown>) | null = null
let getPool: (() => import("pg").Pool) | null = null

interface TraceLogInput {
  agent_id: string
  group_id: string
  trace_type: "contribution" | "decision" | "learning" | "error"
  content: string
  confidence: number
  metadata?: Record<string, unknown>
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const traceLogger = require("../../src/lib/postgres/trace-logger")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const connection = require("../../src/lib/postgres/connection")
  logTrace = traceLogger.logTrace
  getPool = connection.getPool
} catch {
  // Fallback: inline minimal pg pool (runs if src/ imports unavailable in plugin env)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pg = require("pg")
    const fallbackPool = new pg.Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DB ?? "memory",
      user: process.env.POSTGRES_USER ?? "ronin4life",
      password: process.env.POSTGRES_PASSWORD,
    })
    getPool = () => fallbackPool
    logTrace = async (t: TraceLogInput) => {
      const pool = fallbackPool
      await pool.query(
        `INSERT INTO events (group_id, event_type, agent_id, status, metadata)
         VALUES ($1, $2, $3, 'completed', $4)`,
        [t.group_id, `trace.${t.trace_type}`, t.agent_id, JSON.stringify({ content: t.content, confidence: t.confidence, ...t.metadata })]
      )
    }
  } catch {
    // DB unavailable — harness degrades to in-memory only
    console.warn("[continuation-harness] No DB client available; operating in-memory only")
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const ENABLED = true
const MIN_IDLE_TIME_MS = 30_000 // 30 seconds minimum before completion
const STAGNATION_THRESHOLD_MS = 120_000 // 2 minutes without progress
const MAX_CONTINUATION_INJECTIONS = 10 // Prevent infinite loops

interface HarnessConfig {
  enabled: boolean
  minIdleTimeMs: number
  stagnationThresholdMs: number
  maxContinuations: number
  completionPromise: string
  verificationRequired: boolean
}

const DEFAULT_CONFIG: HarnessConfig = {
  enabled: true,
  minIdleTimeMs: MIN_IDLE_TIME_MS,
  stagnationThresholdMs: STAGNATION_THRESHOLD_MS,
  maxContinuations: MAX_CONTINUATION_INJECTIONS,
  completionPromise: "DONE",
  verificationRequired: true,
}

// ============================================================================
// STATE TRACKING
// ============================================================================

interface SessionState {
  sessionId: string
  startedAt: Date
  lastProgressAt: Date
  continuationCount: number
  todos: TodoItem[]
  planPath?: string
  isInjectingContinuation: boolean
  verificationPassed: boolean
}

interface TodoItem {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
}

interface PlanProgress {
  total: number
  completed: number
  incomplete: number
}

// Global session state (per session ID) — write-through cache
const sessionStates = new Map<string, SessionState>()

const GROUP_ID = "allura-roninmemory"
const AGENT_ID = "continuation-harness"

// ============================================================================
// DB HELPERS
// ============================================================================

/**
 * Reconstruct session state by replaying events from PostgreSQL.
 * Falls back to a fresh state if the DB is unavailable.
 */
async function reconstructSessionState(sessionId: string): Promise<SessionState> {
  const now = new Date()
  const base: SessionState = {
    sessionId,
    startedAt: now,
    lastProgressAt: now,
    continuationCount: 0,
    todos: [],
    isInjectingContinuation: false,
    verificationPassed: false,
  }

  if (!getPool) return base

  try {
    const pool = getPool()
    const result = await pool.query<{
      event_type: string
      metadata: Record<string, unknown>
      created_at: Date
    }>(
      `SELECT event_type, metadata, created_at FROM events
       WHERE agent_id = $1
         AND group_id = $2
         AND metadata->>'sessionId' = $3
       ORDER BY created_at ASC`,
      [AGENT_ID, GROUP_ID, sessionId]
    )

    for (const row of result.rows) {
      switch (row.event_type) {
        case "continuation.injected":
          base.continuationCount++
          base.lastProgressAt = row.created_at
          break
        case "continuation.todo_update":
          base.todos = (row.metadata.todos as TodoItem[]) ?? []
          base.lastProgressAt = row.created_at
          break
        case "continuation.verification":
          base.verificationPassed = true
          base.lastProgressAt = row.created_at
          break
        case "continuation.plan_path":
          base.planPath = row.metadata.planPath as string
          break
      }
    }

    if (result.rows.length > 0) {
      base.startedAt = result.rows[0].created_at
    }
  } catch (err) {
    console.warn(`[continuation-harness] DB reconstruction failed, using fresh state: ${err}`)
  }

  return base
}

/**
 * Fire-and-forget event logger. Never throws — logging must never crash the harness.
 */
async function logEvent(
  eventType: string,
  sessionId: string,
  extraMetadata: Record<string, unknown> = {}
): Promise<void> {
  if (!logTrace) return
  try {
    await logTrace({
      agent_id: AGENT_ID,
      group_id: GROUP_ID,
      trace_type: "contribution",
      content: eventType,
      confidence: 1.0,
      metadata: { sessionId, ...extraMetadata },
    })
  } catch (err) {
    console.warn(`[continuation-harness] Event log failed (${eventType}): ${err}`)
  }
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get session state from cache, reconstructing from DB on cache miss.
 */
async function getSessionState(sessionId: string): Promise<SessionState> {
  const cached = sessionStates.get(sessionId)
  if (cached) return cached

  const state = await reconstructSessionState(sessionId)
  sessionStates.set(sessionId, state)
  return state
}

/**
 * Check if session has been idle long enough
 */
function hasMinimumIdleTime(state: SessionState): boolean {
  const elapsed = Date.now() - state.lastProgressAt.getTime()
  return elapsed >= DEFAULT_CONFIG.minIdleTimeMs
}

/**
 * Check for incomplete todos
 */
function getIncompleteTodos(todos: TodoItem[]): TodoItem[] {
  return todos.filter(t => t.status === "pending" || t.status === "in_progress")
}

/**
 * Check for stagnation (no progress for too long)
 */
function isStagnant(state: SessionState): boolean {
  const elapsed = Date.now() - state.lastProgressAt.getTime()
  return elapsed >= DEFAULT_CONFIG.stagnationThresholdMs
}

/**
 * Check if maximum continuations reached
 */
function hasReachedMaxContinuations(state: SessionState): boolean {
  return state.continuationCount >= DEFAULT_CONFIG.maxContinuations
}

/**
 * Parse plan file for checkbox progress
 */
function parsePlanProgress(planContent: string): PlanProgress {
  const lines = planContent.split("\n")
  let total = 0
  let completed = 0

  for (const line of lines) {
    const uncheckedMatch = line.match(/^[\s]*-[\s]*\[[\s]*\]/)
    const checkedMatch = line.match(/^[\s]*-[\s]*\[x\]/i)

    if (uncheckedMatch || checkedMatch) {
      total++
      if (checkedMatch) completed++
    }
  }

  return {
    total,
    completed,
    incomplete: total - completed,
  }
}

/**
 * Build continuation prompt for incomplete work
 */
function buildContinuationPrompt(
  state: SessionState,
  incompleteTodos: TodoItem[],
  planProgress?: PlanProgress
): string {
  const parts: string[] = []

  parts.push("## ⚠️ CONTINUATION REQUIRED\n")
  parts.push("The session went idle but work is incomplete.\n")

  if (incompleteTodos.length > 0) {
    parts.push("\n### Incomplete Todos:\n")
    for (const todo of incompleteTodos) {
      const status = todo.status === "in_progress" ? "🔄" : "⏳"
      parts.push(`- ${status} ${todo.content}\n`)
    }
  }

  if (planProgress && planProgress.incomplete > 0) {
    parts.push(`\n### Plan Progress: ${planProgress.completed}/${planProgress.total} tasks\n`)
    parts.push(`**${planProgress.incomplete} tasks remain incomplete.**\n`)
  }

  if (isStagnant(state)) {
    parts.push("\n### 🚨 Stagnation Detected\n")
    parts.push("No progress has been made for over 2 minutes.\n")
    parts.push("Consider:\n")
    parts.push("- Breaking down the current task into smaller steps\n")
    parts.push("- Asking for clarification if blocked\n")
    parts.push("- Trying a different approach\n")
  }

  parts.push("\n### Verification Gate\n")
  parts.push("Before marking complete, answer:\n")
  parts.push("1. **Can I explain what every changed line does?**\n")
  parts.push("2. **Did I see it work with my own eyes?**\n")
  parts.push("3. **Am I confident this doesn't break existing functionality?**\n")
  parts.push("\n**All 3 YES → Mark complete. Any NO → Keep working.**\n")

  if (!state.verificationPassed) {
    parts.push("\n### ⚡ VERIFICATION REQUIRED\n")
    parts.push("You must provide proof of completion:\n")
    parts.push("- Show test output\n")
    parts.push("- Demonstrate the feature working\n")
    parts.push("- Explain the changes made\n")
  }

  return parts.join("")
}

/**
 * Build stagnation hint
 */
function buildStagnationHint(state: SessionState): string {
  return `## 🔄 Progress Check

You've been working for ${Math.round((Date.now() - state.lastProgressAt.getTime()) / 1000)} seconds without visible progress.

**What's blocking you?**

Consider:
1. Breaking the task into smaller pieces
2. Running tests to verify current state
3. Asking for clarification
4. Documenting what you've tried

Update your todos to show progress:
\`\`\`
todowrite({
  todos: [
    { content: "Completed step", status: "completed" },
    { content: "Current step", status: "in_progress" },
    { content: "Next step", status: "pending" }
  ]
})
\`\`\`
`
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle session.idle event
 * This is the core continuation mechanism
 */
async function handleSessionIdle(
  ctx: PluginInput,
  sessionId: string,
  config: HarnessConfig
): Promise<void> {
  const state = await getSessionState(sessionId)

  // Guard: Already injecting
  if (state.isInjectingContinuation) {
    console.log(`[continuation-harness] Already injecting for session ${sessionId}`)
    return
  }

  // Guard: Maximum continuations reached
  if (hasReachedMaxContinuations(state)) {
    console.log(`[continuation-harness] Max continuations reached for session ${sessionId}`)
    return
  }

  // Guard: Minimum idle time not reached
  if (!hasMinimumIdleTime(state)) {
    console.log(`[continuation-harness] Idle time too short for session ${sessionId}`)
    return
  }

  // Check for incomplete todos
  const incompleteTodos = getIncompleteTodos(state.todos)

  // Check for incomplete plan
  let planProgress: PlanProgress | undefined
  if (state.planPath) {
    try {
      const planContent = await ctx.fs.readFile(state.planPath, "utf-8")
      planProgress = parsePlanProgress(planContent)
    } catch (err) {
      console.error(`[continuation-harness] Failed to read plan: ${err}`)
    }
  }

  // Determine if continuation needed
  const needsContinuation =
    incompleteTodos.length > 0 ||
    (planProgress && planProgress.incomplete > 0) ||
    isStagnant(state)

  if (!needsContinuation) {
    console.log(`[continuation-harness] Session ${sessionId} appears complete`)
    return
  }

  // Log stagnation before injecting
  if (isStagnant(state)) {
    void logEvent("continuation.stagnation", sessionId, {
      elapsedMs: Date.now() - state.lastProgressAt.getTime(),
    })
  }

  // Inject continuation
  state.isInjectingContinuation = true
  state.continuationCount++

  try {
    const prompt = buildContinuationPrompt(state, incompleteTodos, planProgress)

    await ctx.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: prompt }],
      },
    })

    void logEvent("continuation.injected", sessionId, {
      continuationCount: state.continuationCount,
      incompleteTodoCount: incompleteTodos.length,
      isStagnant: isStagnant(state),
    })

    console.log(`[continuation-harness] Injected continuation #${state.continuationCount} for session ${sessionId}`)
  } catch (err) {
    console.error(`[continuation-harness] Failed to inject continuation: ${err}`)
  } finally {
    state.isInjectingContinuation = false
  }
}

/**
 * Handle todo.update event
 * Track todo changes for continuation enforcement
 */
async function handleTodoUpdate(
  sessionId: string,
  todos: TodoItem[]
): Promise<void> {
  const state = await getSessionState(sessionId)
  state.todos = todos
  state.lastProgressAt = new Date()

  void logEvent("continuation.todo_update", sessionId, { todos })

  const incomplete = getIncompleteTodos(todos)
  console.log(`[continuation-harness] Session ${sessionId}: ${incomplete.length} incomplete todos`)
}

/**
 * Handle message.part.delta event
 * Track progress for stagnation detection — sync cache update only, no DB write (high-frequency)
 */
async function handleMessageDelta(sessionId: string): Promise<void> {
  const state = await getSessionState(sessionId)
  state.lastProgressAt = new Date()
}

// ============================================================================
// PLUGIN EXPORT
// ============================================================================

export const continuationHarnessPlugin: Plugin = {
  name: "continuation-harness",

  async setup(ctx) {
    if (!ENABLED) {
      console.log("[continuation-harness] Plugin disabled")
      return
    }

    console.log("[continuation-harness] Plugin loaded")

    // Register event handlers
    ctx.on("session.idle", async (event) => {
      const sessionId = event.properties?.sessionId as string
      if (sessionId) {
        await handleSessionIdle(ctx, sessionId, DEFAULT_CONFIG)
      }
    })

    ctx.on("todo.update", async (event: { properties?: Record<string, unknown> }) => {
      const sessionId = event.properties?.sessionId as string
      const todos = event.properties?.todos as TodoItem[]
      if (sessionId && todos) {
        await handleTodoUpdate(sessionId, todos)
      }
    })

    ctx.on("message.part.delta", async (event: { properties?: Record<string, unknown> }) => {
      const sessionId = event.properties?.sessionId as string
      if (sessionId) {
        await handleMessageDelta(sessionId)
      }
    })

    // Tool: Mark verification passed
    ctx.tool({
      name: "verification_complete",
      description: "Mark that verification gate has been passed for this session",
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          proof: { type: "string", description: "Evidence of completion (test output, demo, etc.)" },
        },
        required: ["sessionId", "proof"],
      },
      async execute(args) {
        const state = await getSessionState(args.sessionId)
        state.verificationPassed = true
        state.lastProgressAt = new Date()
        void logEvent("continuation.verification", args.sessionId, { proof: args.proof })

        return {
          success: true,
          message: "Verification recorded. Session may now complete.",
        }
      },
    })

    // Tool: Set plan path for Atlas tracking
    ctx.tool({
      name: "set_plan_path",
      description: "Set the plan file path for checkbox tracking",
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          planPath: { type: "string", description: "Path to plan file with checkboxes" },
        },
        required: ["sessionId", "planPath"],
      },
      async execute(args) {
        const state = await getSessionState(args.sessionId)
        state.planPath = args.planPath
        void logEvent("continuation.plan_path", args.sessionId, { planPath: args.planPath })

        return {
          success: true,
          message: `Plan path set to: ${args.planPath}`,
        }
      },
    })

    // Tool: Get session progress
    ctx.tool({
      name: "get_session_progress",
      description: "Get current session progress state",
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
        },
        required: ["sessionId"],
      },
      async execute(args) {
        const state = await getSessionState(args.sessionId)
        const incompleteTodos = getIncompleteTodos(state.todos)

        let planProgress: PlanProgress | undefined
        if (state.planPath) {
          try {
            const content = await ctx.fs.readFile(state.planPath, "utf-8")
            planProgress = parsePlanProgress(content)
          } catch {
            // Plan not readable
          }
        }

        return {
          sessionId: state.sessionId,
          startedAt: state.startedAt,
          lastProgressAt: state.lastProgressAt,
          continuationCount: state.continuationCount,
          incompleteTodos: incompleteTodos.length,
          planProgress,
          isStagnant: isStagnant(state),
          verificationPassed: state.verificationPassed,
        }
      },
    })
  },
}

export default continuationHarnessPlugin