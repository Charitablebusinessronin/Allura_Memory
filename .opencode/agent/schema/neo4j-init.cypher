// ═══════════════════════════════════════════════════════════════════
// Allura Memory — Neo4j Schema Bootstrap
// Run once against your live Neo4j instance to establish constraints,
// indexes, and seed the 7 system agent nodes.
// Compatible with your existing SUPERSEDES versioning model.
// ═══════════════════════════════════════════════════════════════════

// ── Constraints (idempotent) ─────────────────────────────────────
CREATE CONSTRAINT person_name IF NOT EXISTS
  FOR (p:Person) REQUIRE p.name IS UNIQUE;

CREATE CONSTRAINT project_name IF NOT EXISTS
  FOR (p:Project) REQUIRE p.name IS UNIQUE;

CREATE CONSTRAINT task_id IF NOT EXISTS
  FOR (t:Task) REQUIRE t.task_id IS UNIQUE;

CREATE CONSTRAINT decision_id IF NOT EXISTS
  FOR (d:Decision) REQUIRE d.decision_id IS UNIQUE;

CREATE CONSTRAINT lesson_id IF NOT EXISTS
  FOR (l:Lesson) REQUIRE l.lesson_id IS UNIQUE;

CREATE CONSTRAINT tool_name IF NOT EXISTS
  FOR (t:Tool) REQUIRE t.name IS UNIQUE;

CREATE CONSTRAINT context_id IF NOT EXISTS
  FOR (c:Context) REQUIRE c.context_id IS UNIQUE;

// ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX project_status IF NOT EXISTS
  FOR (p:Project) ON (p.status);

CREATE INDEX project_priority IF NOT EXISTS
  FOR (p:Project) ON (p.priority);

CREATE INDEX project_group IF NOT EXISTS
  FOR (p:Project) ON (p.group_id);

CREATE INDEX task_status IF NOT EXISTS
  FOR (t:Task) ON (t.status);

CREATE INDEX task_session IF NOT EXISTS
  FOR (t:Task) ON (t.session_id);

CREATE INDEX task_agent IF NOT EXISTS
  FOR (t:Task) ON (t.agent);

CREATE INDEX decision_date IF NOT EXISTS
  FOR (d:Decision) ON (d.made_on);

CREATE INDEX decision_outcome IF NOT EXISTS
  FOR (d:Decision) ON (d.outcome);

CREATE INDEX lesson_applies IF NOT EXISTS
  FOR (l:Lesson) ON (l.applies_to);

CREATE INDEX lesson_severity IF NOT EXISTS
  FOR (l:Lesson) ON (l.severity);

CREATE INDEX tool_stack IF NOT EXISTS
  FOR (t:Tool) ON (t.fits_your_stack);

// ── Node property schema (reference) ────────────────────────────
// (:Person   {name, role, model, group_id, relationship?})
// (:Project  {name, status, stack, priority, group_id, workspace})
// (:Decision {decision_id, made_on, choice, reasoning, outcome, agent})
// (:Task     {task_id, goal, status, steps_taken, result, group_id, agent, session_id})
// (:Lesson   {lesson_id, learned, context, applies_to, severity})
// (:Tool     {name, purpose, fits_your_stack, mcp_server?})
// (:Context  {context_id, domain, notes, related_projects})

// ── Relationship types (reference) ──────────────────────────────
// (:Task)-[:INFORMED_BY]->(:Decision)
// (:Project)-[:USES]->(:Tool)
// (:Lesson)-[:APPLIES_TO]->(:Project)
// (:Person)-[:CONTRIBUTED {on, result}]->(:Task)
// (:Person)-[:LEARNED {on}]->(:Lesson)
// (:Person)-[:DECIDED {on}]->(:Decision)
// (:Person)-[:COLLABORATED_WITH]->(:Person)
// (:Decision)-[:SUPERSEDES]->(:Decision)   ← your existing versioning
// (:Task)-[:PART_OF]->(:Project)
// (:Context)-[:APPLIES_TO]->(:Project)

// ── Seed 7 system agent nodes (idempotent MERGEs) ────────────────
MERGE (a:Person {name: 'MemoryOrchestrator'})
  SET a.role = 'BMad workflow coordination — supervisor',
      a.model = 'glm-5-cloud',
      a.group_id = 'allura-system',
      a.layer = 'L3-Agent';

MERGE (a:Person {name: 'MemoryArchitect'})
  SET a.role = 'System design lead',
      a.model = 'glm-5-cloud',
      a.group_id = 'allura-system',
      a.layer = 'L3-Agent';

MERGE (a:Person {name: 'MemoryBuilder'})
  SET a.role = 'Infrastructure implementation',
      a.model = 'kimi-k2.5-cloud',
      a.group_id = 'allura-system',
      a.layer = 'L3-Agent';

MERGE (a:Person {name: 'MemoryGuardian'})
  SET a.role = 'Quality gates and validation',
      a.model = 'glm-5-cloud',
      a.group_id = 'allura-system',
      a.layer = 'L3-Agent';

MERGE (a:Person {name: 'MemoryScout'})
  SET a.role = 'Context discovery',
      a.model = 'ministral-3:8b-cloud',
      a.group_id = 'allura-system',
      a.layer = 'L3-Agent';

MERGE (a:Person {name: 'MemoryAnalyst'})
  SET a.role = 'Memory system metrics',
      a.model = 'glm-5-cloud',
      a.group_id = 'allura-system',
      a.layer = 'L3-Agent';

MERGE (a:Person {name: 'MemoryChronicler'})
  SET a.role = 'Documentation and specifications',
      a.model = 'glm-5-cloud',
      a.group_id = 'allura-system',
      a.layer = 'L3-Agent';

// ── Seed known MCP tool nodes (idempotent MERGEs) ────────────────
MERGE (t:Tool {name: 'PostgreSQL'})
  SET t.purpose = 'Hot trace storage — run state, incomplete tasks, session logs',
      t.fits_your_stack = true,
      t.mcp_server = 'postgres-mcp';

MERGE (t:Tool {name: 'Neo4j'})
  SET t.purpose = 'Curated cold memory — nodes, relationships, SUPERSEDES versioning',
      t.fits_your_stack = true,
      t.mcp_server = 'neo4j-mcp';

MERGE (t:Tool {name: 'Exa'})
  SET t.purpose = 'Semantic web search and research',
      t.fits_your_stack = true,
      t.mcp_server = 'exa-mcp';

MERGE (t:Tool {name: 'Context7'})
  SET t.purpose = 'Library documentation lookup',
      t.fits_your_stack = true,
      t.mcp_server = 'context7-mcp';

MERGE (t:Tool {name: 'Playwright'})
  SET t.purpose = 'Browser automation and testing',
      t.fits_your_stack = true,
      t.mcp_server = 'playwright-mcp';

MERGE (t:Tool {name: 'Hyperbrowser'})
  SET t.purpose = 'Headless browser tasks and scraping',
      t.fits_your_stack = true,
      t.mcp_server = 'hyperbrowser-mcp';

MERGE (t:Tool {name: 'YouTubeTranscript'})
  SET t.purpose = 'Extract transcripts from YouTube videos for research',
      t.fits_your_stack = true,
      t.mcp_server = 'youtube-transcript-mcp';

MERGE (t:Tool {name: 'NextJsDevTools'})
  SET t.purpose = 'Next.js development tooling and schema inspection',
      t.fits_your_stack = true,
      t.mcp_server = 'nextjs-devtools-mcp';

// ── Wire agent→tool primary assignments ─────────────────────────
// MemoryOrchestrator owns PostgreSQL + Neo4j
MATCH (a:Person {name: 'MemoryOrchestrator'}), (t:Tool {name: 'PostgreSQL'})
  MERGE (a)-[:USES {primary: true}]->(t);
MATCH (a:Person {name: 'MemoryOrchestrator'}), (t:Tool {name: 'Neo4j'})
  MERGE (a)-[:USES {primary: true}]->(t);

// MemoryAnalyst owns Exa + YouTubeTranscript + Context7
MATCH (a:Person {name: 'MemoryAnalyst'}), (t:Tool {name: 'Exa'})
  MERGE (a)-[:USES {primary: true}]->(t);
MATCH (a:Person {name: 'MemoryAnalyst'}), (t:Tool {name: 'YouTubeTranscript'})
  MERGE (a)-[:USES {primary: true}]->(t);
MATCH (a:Person {name: 'MemoryAnalyst'}), (t:Tool {name: 'Context7'})
  MERGE (a)-[:USES {primary: true}]->(t);

// MemoryBuilder owns PostgreSQL (writes) + Neo4j (writes)
MATCH (a:Person {name: 'MemoryBuilder'}), (t:Tool {name: 'PostgreSQL'})
  MERGE (a)-[:USES {primary: true, mode: 'write'}]->(t);
MATCH (a:Person {name: 'MemoryBuilder'}), (t:Tool {name: 'Neo4j'})
  MERGE (a)-[:USES {primary: true, mode: 'write'}]->(t);

// MemoryArchitect owns NextJsDevTools + Context7 + PostgreSQL (schema)
MATCH (a:Person {name: 'MemoryArchitect'}), (t:Tool {name: 'NextJsDevTools'})
  MERGE (a)-[:USES {primary: true}]->(t);
MATCH (a:Person {name: 'MemoryArchitect'}), (t:Tool {name: 'Context7'})
  MERGE (a)-[:USES {primary: true}]->(t);
MATCH (a:Person {name: 'MemoryArchitect'}), (t:Tool {name: 'PostgreSQL'})
  MERGE (a)-[:USES {primary: true, mode: 'schema'}]->(t);

// Browser tools available to all sub-agents
MATCH (a:Person), (t:Tool {name: 'Playwright'})
  WHERE a.group_id = 'allura-system'
  MERGE (a)-[:USES {primary: false}]->(t);
MATCH (a:Person), (t:Tool {name: 'Hyperbrowser'})
  WHERE a.group_id = 'allura-system'
  MERGE (a)-[:USES {primary: false}]->(t);

// ── Verification query (run after bootstrap) ─────────────────────
// MATCH (a:Person) WHERE a.group_id = 'allura-system'
// RETURN a.name, a.role, a.model ORDER BY a.name;
//
// Expected: 7 rows — Analyst, Architect, Builder, Chronicler,
//           Guardian, Orchestrator, Scout
