// =============================================================
// ALLURA BRAIN LOOP — Neo4j Node & Relationship Schema
// Version: 1.0.0 | Date: 2026-04-06
// Run this in your Neo4j instance to initialize the graph schema.
// All Docker-only. Execute via MCP_DOCKER Neo4j tools.
// =============================================================

// -------------------------------------------------------------
// CONSTRAINTS — enforce uniqueness and indexing
// -------------------------------------------------------------

CREATE CONSTRAINT person_name IF NOT EXISTS
FOR (p:Person) REQUIRE p.name IS UNIQUE;

CREATE CONSTRAINT project_name IF NOT EXISTS
FOR (p:Project) REQUIRE p.name IS UNIQUE;

CREATE CONSTRAINT tool_name IF NOT EXISTS
FOR (t:Tool) REQUIRE t.name IS UNIQUE;

// -------------------------------------------------------------
// INDEXES — for fast lookups on common query patterns
// -------------------------------------------------------------

CREATE INDEX task_status IF NOT EXISTS
FOR (t:Task) ON (t.status);

CREATE INDEX task_created IF NOT EXISTS
FOR (t:Task) ON (t.created_at);

CREATE INDEX project_status IF NOT EXISTS
FOR (p:Project) ON (p.status);

CREATE INDEX decision_date IF NOT EXISTS
FOR (d:Decision) ON (d.made_on);

CREATE INDEX lesson_context IF NOT EXISTS
FOR (l:Lesson) ON (l.context);

CREATE INDEX context_domain IF NOT EXISTS
FOR (c:Context) ON (c.domain);

// -------------------------------------------------------------
// NODE TYPE DEFINITIONS
// (These are illustrative CREATE statements — adapt as needed)
// -------------------------------------------------------------

// (:Person) — people you work with, clients, collaborators
// Properties: name (string, unique), role (string), relationship (string)
// Example:
// CREATE (:Person {name: 'Alice', role: 'client', relationship: 'nonprofit partner'})

// (:Project) — active or completed work efforts
// Properties: name (string, unique), status (string: 'active'|'complete'|'paused'),
//             stack (string), priority (int: 1=highest)
// Example:
// CREATE (:Project {name: 'AlluraMemory', status: 'active', stack: 'Next.js/Neo4j/Postgres', priority: 1})

// (:Decision) — architectural or strategic decisions made during a run
// Properties: made_on (date), choice (string), reasoning (string), outcome (string: 'pending'|'validated'|'reversed')
// Example:
// CREATE (:Decision {made_on: date(), choice: 'Use Neo4j for graph memory', reasoning: 'Relationship traversal speed', outcome: 'validated'})

// (:Task) — a discrete unit of agent work
// Properties: goal (string), status (string: 'open'|'completed'|'blocked'|'max_steps_reached'),
//             steps_taken (int), result (string), created_at (datetime)
// Example:
// CREATE (:Task {goal: 'Update MemoryOrchestrator with PRE/RUN/POST', status: 'completed', steps_taken: 3, result: 'File pushed to new-main', created_at: datetime()})

// (:Lesson) — something the system learned from a run (success or failure)
// Properties: learned (string), context (string — task goal), applies_to (string — project name)
// Example:
// CREATE (:Lesson {learned: 'Always verify Neo4j connection before dispatching agents', context: 'memory init run', applies_to: 'AlluraMemory'})

// (:Tool) — MCP tools and their fitness for the stack
// Properties: name (string, unique), purpose (string), fits_your_stack (bool)
// Example:
// CREATE (:Tool {name: 'mcp-neo4j', purpose: 'Graph memory read/write', fits_your_stack: true})

// (:Context) — domain-level context snapshots (daily briefs, project summaries)
// Properties: domain (string), notes (string), related_projects (list<string>)
// Example:
// CREATE (:Context {domain: 'daily-brief', notes: 'Focus on loop enforcement today', related_projects: ['AlluraMemory']})

// -------------------------------------------------------------
// RELATIONSHIP DEFINITIONS
// -------------------------------------------------------------

// (:Task)-[:INFORMED_BY]->(:Decision)
//   A task was shaped by a prior decision

// (:Task)-[:BELONGS_TO]->(:Project)
//   A task is part of a project

// (:Project)-[:USES]->(:Tool)
//   A project depends on a tool

// (:Lesson)-[:APPLIES_TO]->(:Project)
//   A lesson is relevant to a project

// (:Person)-[:WORKS_ON]->(:Project)
//   A person is involved in a project

// (:Decision)-[:PART_OF]->(:Project)
//   A decision was made within a project context

// (:Context)-[:REFERENCES]->(:Project)
//   A context snapshot references a project

// -------------------------------------------------------------
// SEED: ALLURA MEMORY PROJECT NODE
// Run once to establish the root project node
// -------------------------------------------------------------

MERGE (p:Project {name: 'AlluraMemory'})
ON CREATE SET
  p.status = 'active',
  p.stack = 'Next.js / Neo4j / Postgres / OpenCode / Docker',
  p.priority = 1;

// Seed core tools
MERGE (t1:Tool {name: 'mcp-neo4j'}) ON CREATE SET t1.purpose = 'Graph memory read/write', t1.fits_your_stack = true;
MERGE (t2:Tool {name: 'mcp-postgres'}) ON CREATE SET t2.purpose = 'Run state and task log', t2.fits_your_stack = true;
MERGE (t3:Tool {name: 'exa'}) ON CREATE SET t3.purpose = 'Web research and retrieval', t3.fits_your_stack = true;
MERGE (t4:Tool {name: 'context7'}) ON CREATE SET t4.purpose = 'Library documentation lookup', t4.fits_your_stack = true;
MERGE (t5:Tool {name: 'playwright'}) ON CREATE SET t5.purpose = 'Browser automation', t5.fits_your_stack = true;
MERGE (t6:Tool {name: 'hyperbrowser'}) ON CREATE SET t6.purpose = 'Browser agent tasks', t6.fits_your_stack = true;
MERGE (t7:Tool {name: 'youtube-transcript'}) ON CREATE SET t7.purpose = 'Video content extraction', t7.fits_your_stack = true;
MERGE (t8:Tool {name: 'nextjs-devtools'}) ON CREATE SET t8.purpose = 'Next.js schema and component work', t8.fits_your_stack = true;

// Link tools to AlluraMemory project
MATCH (p:Project {name: 'AlluraMemory'})
MATCH (t:Tool)
WHERE t.fits_your_stack = true
MERGE (p)-[:USES]->(t);

// =============================================================
// QUERY TEMPLATES — copy into agent PRE reads
// =============================================================

// [1] Open tasks for a project
// MATCH (t:Task {status: 'open'})-[:BELONGS_TO]->(p:Project {name: $projectName}) RETURN t ORDER BY t.created_at DESC LIMIT 10

// [2] Active projects by priority
// MATCH (p:Project {status: 'active'}) RETURN p ORDER BY p.priority ASC

// [3] Lessons that apply to a project
// MATCH (l:Lesson)-[:APPLIES_TO]->(p:Project {name: $projectName}) RETURN l

// [4] Pending decisions
// MATCH (d:Decision {outcome: 'pending'}) RETURN d ORDER BY d.made_on DESC

// [5] Full context for a project
// MATCH (p:Project {name: $projectName})
// OPTIONAL MATCH (p)<-[:BELONGS_TO]-(t:Task)
// OPTIONAL MATCH (p)-[:USES]->(tool:Tool)
// OPTIONAL MATCH (l:Lesson)-[:APPLIES_TO]->(p)
// RETURN p, collect(t) as tasks, collect(tool) as tools, collect(l) as lessons
