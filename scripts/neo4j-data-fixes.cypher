// Neo4j Data Fixes for Allura Brain
// NON-idempotent data mutation queries — run ONCE, not on every container start
// Separate from DDL to prevent accidental re-execution in init scripts

// ============================================================================
// Fix NULL agent_id values
// ============================================================================
// Run this ONCE if you have Agent nodes with NULL agent_id.
// DO NOT include in docker init — this is a one-time data migration.

// Update agents with NULL agent_id using name
// MATCH (a:Agent)
// WHERE a.agent_id IS NULL AND a.name IS NOT NULL
// SET a.agent_id = toLower(replace(a.name, " ", "-"))
// RETURN count(a) as fixed_count;

// ============================================================================
// Data Quality Check (informational, run manually)
// ============================================================================

// Count agents with missing fields
// MATCH (a:Agent)
// WHERE a.agent_id IS NULL OR a.name IS NULL
// RETURN count(a) as incomplete_agents;

// List all agents with complete data
// MATCH (a:Agent)
// WHERE a.agent_id IS NOT NULL AND a.name IS NOT NULL
// RETURN a.agent_id, a.name, a.platform, a.status
// ORDER BY a.name;