# Draft: ADAS Docker Agents - Persistent Autonomous Agent System

## Goal (confirmed)
Create a system for persistent autonomous ADAS agents that:
1. Run as Docker containers (independently of OpenCode)
2. Are tracked in Notion (lifecycle, status, health)
3. Run on cron schedules (continuous or scheduled)
4. Can be monitored and managed

## Context from Codebase

### ADAS Sandbox (existing)
- Uses `dockerode` to run agent candidates in isolated containers
- Image: `adas-sandbox:latest`
- Security: network disabled, read-only FS, resource limits
- Falls back to mock if Docker unavailable

### Curator Notion Integration (existing)
- Creates Notion pages with approval workflow
- Fields: Status, Review Status, AI Accessible
- Human-in-the-loop for approval

### OpenCode Agents (separate)
- Defined in `.opencode/oh-my-opencode.json`
- 10 agents: hephaestus, oracle, momus, sisyphus, prometheus, metis, atlas, explore, librarian, multimodal-looker, sisyphus-junior
- Different system - NOT what this is about

## Research Findings

### From ADAS Sandbox (`src/lib/adas/sandbox.ts`)
- `SandboxExecutor` class manages Docker containers
- `SANDBOX_IMAGE = "adas-sandbox:latest"`
- `createSandboxContainer()` with security restrictions
- `execute()` for running agent code
- `KmaxCounter` for bounded autonomy

### From Curator (`src/curator/`)
- CLI entry point: `npx tsx src/curator/index.ts run`
- Notion integration for approval workflow
- Promotion pipeline: PostgreSQL → Neo4j → Notion

## Confirmed Requirements

### Agent Types
- **Knowledge Curator** - Run curator pipeline on schedule to promote insights
- **ADAS Search Loop** - Run evolutionary agent design optimization continuously
- **Memory Promotion** - Promote PostgreSQL traces to Neo4j insights
- **Custom Tasks** - Define arbitrary tasks that run periodically

### Scheduling
- **Docker restart policies** - Containers auto-restart with health checks
- Simple and reliable approach
- Uses Docker's built-in restart policies

### Notion Tracking
- **Status + Health**: name, type, status (running/stopped/error), last run, next run, error count
- **Performance Metrics**: success rate, avg duration, cost metrics, resource usage
- **ADAS Evolution Data**: generation number, fitness score, mutation history
- **Approval Workflow**: Require human approval before new agents start (like curator)

### Creation
- **Config file** - YAML/JSON config that defines agents
- File changes trigger agent updates
- Source-controlled configuration

### Monitoring
- **Heartbeat + Health Checks**: Container health check + heartbeat logging to PostgreSQL
- **Automatic Restart Policies**: Auto-restart on crash, exponential backoff for repeated failures

### ADAS Integration
- **Separate from ADAS** - This system is separate; ADAS only provides the sandbox Dockerfile
- Independent persistent agent system