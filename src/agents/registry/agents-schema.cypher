// Agent Registry Schema for Neo4j
// Version 1.0 - Initial schema for persistent autonomous agents

// ============================================
// Constraints
// ============================================

// Unique constraint on agent id
CREATE CONSTRAINT agent_id_unique IF NOT EXISTS
FOR (a:Agent)
REQUIRE a.id IS UNIQUE;

// group_id is required for tenant isolation
CREATE CONSTRAINT agent_group_id_not_null IF NOT EXISTS
FOR (a:Agent)
REQUIRE a.group_id IS NOT NULL;

// Unique constraint on agent run id
CREATE CONSTRAINT agent_run_id_unique IF NOT EXISTS
FOR (r:AgentRun)
REQUIRE r.run_id IS UNIQUE;

// ============================================
// Indexes
// ============================================

// Index for efficient agent lookups by group_id
CREATE INDEX agent_group_id_idx IF NOT EXISTS
FOR (a:Agent)
ON (a.group_id);

// Index for agent status queries
CREATE INDEX agent_status_idx IF NOT EXISTS
FOR (a:Agent)
ON (a.status);

// Index for agent type queries
CREATE INDEX agent_type_idx IF NOT EXISTS
FOR (a:Agent)
ON (a.type);

// Index for agent runs by timestamp
CREATE INDEX agent_run_timestamp_idx IF NOT EXISTS
FOR (r:AgentRun)
ON (r.started_at);

// Index for active agents
CREATE INDEX agent_enabled_idx IF NOT EXISTS
FOR (a:Agent)
ON (a.enabled);

// ============================================
// Agent Versioning (SUPERSEDES pattern)
// ============================================

// Constraint for version nodes
CREATE CONSTRAINT agent_version_id_unique IF NOT EXISTS
FOR (v:AgentVersion)
REQUIRE v.version_id IS UNIQUE;

// ============================================
// Initial Data (Optional - can be empty)
// ============================================

// Create a schema version node to track this schema
MERGE (s:SchemaVersion {version: "1.0.0-agents"})
ON CREATE SET
  s.applied_at = datetime(),
  s.description = "Initial agent registry schema with Agent, AgentRun, and AgentVersion nodes"
ON MATCH SET
  s.updated_at = datetime();

// ============================================
// Node Definitions (documentation)
// ============================================

/*
(:Agent) - Persistent autonomous agent definition
  Required properties:
    - id: string (unique, format: agent-{name}-{group_id})
    - name: string
    - type: enum ('knowledge-curator', 'memory-promotion', 'adas-search', 'custom-task')
    - status: enum ('Pending', 'Running', 'Stopped', 'Error')
    - group_id: string (tenant isolation)
    - config_hash: string (for detecting changes)
  
  Optional properties:
    - enabled: boolean
    - restart_policy: enum
    - schedule_type: enum
    - schedule_cron: string
    - schedule_interval: integer
    - memory_mb: integer
    - cpu_percent: integer
    - timeout_seconds: integer
    - notion_sync: boolean
    - notion_database_id: string
    - created_at: datetime
    - updated_at: datetime
    - last_run_at: datetime
    - next_run_at: datetime
    - success_rate: float
    - error_count: integer

(:AgentVersion) - Version history following SUPERSEDES pattern
  Required:
    - version_id: string (unique)
    - agent_id: string (references Agent)
    - config_hash: string
    - created_at: datetime

(:AgentRun) - Individual agent execution
  Required:
    - run_id: string (unique)
    - agent_id: string
    - started_at: datetime
  
  Optional:
    - ended_at: datetime
    - duration_ms: integer
    - success: boolean
    - error_message: string
    - exit_code: integer

Relationships:
- (:AgentVersion)-[:SUPERSEDES]->(:AgentVersion)
- (:AgentRun)-[:RUN_OF]->(:Agent)
- (:Agent)-[:CURRENT_VERSION]->(:AgentVersion)
*/
