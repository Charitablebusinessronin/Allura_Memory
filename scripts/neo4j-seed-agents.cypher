// Phase 1: Seed Agent + Project + Team nodes into Neo4j
// Run via: cypher-shell or Neo4j browser
// Idempotent: uses MERGE to avoid duplicates

// ============================================
// TEAMS
// ============================================
MERGE (ram:Team {id: 'team-ram'})
SET ram.name = 'Team RAM',
    ram.group_id = 'allura-system',
    ram.icon = '🏗️',
    ram.description = 'Engineering harness — architecture, code, infra, performance, quality'

MERGE (durham:Team {id: 'team-durham'})
SET durham.name = 'Team Durham',
    durham.group_id = 'allura-creative',
    durham.icon = '🎨',
    durham.description = 'Creative brand studio — strategy, identity, imagery, copy, taste'

// ============================================
// PROJECTS
// ============================================
MERGE (allura:Project {id: 'proj-allura-memory'})
SET allura.name = 'Allura Memory',
    allura.group_id = 'allura-system',
    allura.status = 'active',
    allura.description = 'Governed AI memory system — dual-layer PostgreSQL + Neo4j'

MERGE (agentOS:Project {id: 'proj-agent-os'})
SET agentOS.name = 'Agent OS',
    agentOS.group_id = 'allura-system',
    agentOS.status = 'active',
    agentOS.description = 'Command center for crew, brain, and rules'

MERGE (creativeStudio:Project {id: 'proj-creative-studio'})
SET creativeStudio.name = 'Creative Studio',
    creativeStudio.group_id = 'allura-creative',
    creativeStudio.status = 'active',
    creativeStudio.description = 'Brand and creative production pipeline'

// ============================================
// TEAM RAM AGENTS
// ============================================
MERGE (jobs:Agent {id: 'agent-jobs'})
SET jobs.name = 'Jobs', jobs.persona = 'Jobs', jobs.team = 'RAM',
    jobs.category = 'Core', jobs.type = 'primary', jobs.scope = 'harness',
    jobs.platform = 'Both', jobs.status = 'active', jobs.group_id = 'allura-system',
    jobs.description = 'Intent Gate & Scope Owner. Converts fuzzy ideas into crisp objectives, constraints, and acceptance criteria.'

MERGE (brooks:Agent {id: 'agent-brooks'})
SET brooks.name = 'Brooks', brooks.persona = 'Brooks', brooks.team = 'RAM',
    brooks.category = 'Core', brooks.type = 'primary', brooks.scope = 'harness',
    brooks.platform = 'Both', brooks.status = 'active', brooks.group_id = 'allura-system',
    brooks.description = 'Chief Architect. Owns contracts, invariants, ADRs. Final word on architecture and routing policy.'

MERGE (woz:Agent {id: 'agent-woz'})
SET woz.name = 'Woz', woz.persona = 'Wozniak', woz.team = 'RAM',
    woz.category = 'Code Subagents', woz.type = 'primary', woz.scope = 'harness',
    woz.platform = 'Both', woz.status = 'active', woz.group_id = 'allura-system',
    woz.description = 'Primary Builder. Working code, clean diffs, passing tests.'

MERGE (scout:Agent {id: 'agent-scout'})
SET scout.name = 'Scout', scout.persona = 'none', scout.team = 'RAM',
    scout.category = 'Core Subagents', scout.type = 'subagent', scout.scope = 'harness',
    scout.platform = 'Both', scout.status = 'active', scout.group_id = 'allura-system',
    scout.description = 'Recon & Discovery. Read-only repo scanning, pattern discovery, config location.'

MERGE (pike:Agent {id: 'agent-pike'})
SET pike.name = 'Pike', pike.persona = 'Pike', pike.team = 'RAM',
    pike.category = 'Core Subagents', pike.type = 'subagent', pike.scope = 'harness',
    pike.platform = 'Both', pike.status = 'active', pike.group_id = 'allura-system',
    pike.description = 'Interface & Simplicity Gate. Reviews interfaces, routing categories, concurrency patterns.'

MERGE (bellard:Agent {id: 'agent-bellard'})
SET bellard.name = 'Bellard', bellard.persona = 'Bellard', bellard.team = 'RAM',
    bellard.category = 'Code Subagents', bellard.type = 'subagent', bellard.scope = 'harness',
    bellard.platform = 'Both', bellard.status = 'active', bellard.group_id = 'allura-system',
    bellard.description = 'Diagnostics & Performance. Benchmarks, profiling, hot paths. Measurement-first optimization.'

MERGE (fowler:Agent {id: 'agent-fowler'})
SET fowler.name = 'Fowler', fowler.persona = 'Fowler', fowler.team = 'RAM',
    fowler.category = 'Core Subagents', fowler.type = 'subagent', fowler.scope = 'harness',
    fowler.platform = 'Both', fowler.status = 'active', fowler.group_id = 'allura-system',
    fowler.description = 'Refactor & Maintainability Gate. Incremental changes, drift detection, design hygiene.'

MERGE (carmack:Agent {id: 'agent-carmack'})
SET carmack.name = 'Carmack', carmack.persona = 'Carmack', carmack.team = 'RAM',
    carmack.category = 'Core', carmack.type = 'specialist', carmack.scope = 'standalone',
    carmack.platform = 'OpenCode', carmack.status = 'active', carmack.group_id = 'allura-system',
    carmack.description = 'Performance & Optimization Specialist. API design, latency reduction, memory profiling.'

MERGE (knuth:Agent {id: 'agent-knuth'})
SET knuth.name = 'Knuth', knuth.persona = 'Knuth', knuth.team = 'RAM',
    knuth.category = 'Core', knuth.type = 'specialist', knuth.scope = 'standalone',
    knuth.platform = 'OpenCode', knuth.status = 'active', knuth.group_id = 'allura-system',
    knuth.description = 'Data Architect & Schema Specialist. PostgreSQL, Neo4j, query optimization, data migration.'

MERGE (devops:Agent {id: 'agent-devops'})
SET devops.name = 'DevOps', devops.persona = 'Hightower', devops.team = 'RAM',
    devops.category = 'Core', devops.type = 'specialist', devops.scope = 'standalone',
    devops.platform = 'OpenCode', devops.status = 'active', devops.group_id = 'allura-system',
    devops.description = 'Infrastructure & Deployment. CI/CD, IaC, deployment automation, observability.'

// ============================================
// GOVERNANCE AGENTS
// ============================================
MERGE (curator:Agent {id: 'agent-curator'})
SET curator.name = 'Curator', curator.persona = 'none', curator.team = 'Governance',
    curator.category = 'Core', curator.type = 'specialist', curator.scope = 'harness',
    curator.platform = 'Both', curator.status = 'active', curator.group_id = 'allura-system',
    curator.description = 'Proposes knowledge promotion. Runs watchdog loop, scores, surfaces to Notion for HITL review.'

MERGE (auditor:Agent {id: 'agent-auditor'})
SET auditor.name = 'Auditor', auditor.persona = 'none', auditor.team = 'Governance',
    auditor.category = 'Core', auditor.type = 'specialist', auditor.scope = 'harness',
    auditor.platform = 'Both', auditor.status = 'active', auditor.group_id = 'allura-system',
    auditor.description = 'HITL approval gate. Final authority on knowledge promotion to Neo4j canonical store.'

MERGE (gilliam:Agent {id: 'agent-gilliam'})
SET gilliam.name = 'Gilliam', gilliam.persona = 'Gilliam', gilliam.team = 'Ship',
    gilliam.category = 'Core', gilliam.type = 'primary', gilliam.scope = 'harness',
    gilliam.platform = 'OpenClaw', gilliam.status = 'active', gilliam.group_id = 'allura-system',
    gilliam.description = 'Shipboard AI & Navigation. Brooksian navigator. Runs OpenClaw, challenges premises, enforces architecture integrity.'

// ============================================
// TEAM DURHAM AGENTS
// ============================================
MERGE (brandStrat:Agent {id: 'agent-brand-strategist'})
SET brandStrat.name = 'Brand Strategist', brandStrat.persona = 'Philip Kotler', brandStrat.team = 'Durham',
    brandStrat.category = 'Core', brandStrat.type = 'primary', brandStrat.scope = 'harness',
    brandStrat.platform = 'Both', brandStrat.status = 'active', brandStrat.group_id = 'allura-creative',
    brandStrat.description = 'Intake & Brief Builder. Client intake, competitive research, creative brief. Head Orchestrator of Durham.'

MERGE (ogilvy:Agent {id: 'agent-ogilvy'})
SET ogilvy.name = 'Ogilvy', ogilvy.persona = 'David Ogilvy', ogilvy.team = 'Durham',
    ogilvy.category = 'Creative Direction', ogilvy.type = 'primary', ogilvy.scope = 'harness',
    ogilvy.platform = 'Both', ogilvy.status = 'active', ogilvy.group_id = 'allura-creative',
    ogilvy.description = 'Brand Strategy & Copy. Positioning, voice, messaging, headlines. Proof-led messaging.'

MERGE (bernbach:Agent {id: 'agent-bernbach'})
SET bernbach.name = 'Bernbach', bernbach.persona = 'Bill Bernbach', bernbach.team = 'Durham',
    bernbach.category = 'Creative Direction', bernbach.type = 'primary', bernbach.scope = 'harness',
    bernbach.platform = 'Both', bernbach.status = 'active', bernbach.group_id = 'allura-creative',
    bernbach.description = 'Creative Director. Concept territories, campaign concepts, creative risk-taking.'

MERGE (paulRand:Agent {id: 'agent-paul-rand'})
SET paulRand.name = 'Paul Rand', paulRand.persona = 'Paul Rand', paulRand.team = 'Durham',
    paulRand.category = 'Production', paulRand.type = 'primary', paulRand.scope = 'harness',
    paulRand.platform = 'Both', paulRand.status = 'active', paulRand.group_id = 'allura-creative',
    paulRand.description = 'Visual Identity. Logo, color, typography, brand guidelines, design systems.'

MERGE (annie:Agent {id: 'agent-annie'})
SET annie.name = 'Annie', annie.persona = 'Annie Leibovitz', annie.team = 'Durham',
    annie.category = 'Production', annie.type = 'subagent', annie.scope = 'harness',
    annie.platform = 'Both', annie.status = 'active', annie.group_id = 'allura-creative',
    annie.description = 'Imagery & Photography. Moodboards, shot lists, visual direction, campaign imagery.'

MERGE (rubin:Agent {id: 'agent-rubin'})
SET rubin.name = 'Rick Rubin', rubin.persona = 'Rick Rubin', rubin.team = 'Durham',
    rubin.category = 'Quality', rubin.type = 'specialist', rubin.scope = 'harness',
    rubin.platform = 'Both', rubin.status = 'active', rubin.group_id = 'allura-creative',
    rubin.description = 'QC Gate & Creative Refinement. Final quality check before output ships.'

// ============================================
// TEAM MEMBERSHIPS
// ============================================
MERGE (jobs)-[:MEMBER_OF]->(ram)
MERGE (brooks)-[:MEMBER_OF]->(ram)
MERGE (woz)-[:MEMBER_OF]->(ram)
MERGE (scout)-[:MEMBER_OF]->(ram)
MERGE (pike)-[:MEMBER_OF]->(ram)
MERGE (bellard)-[:MEMBER_OF]->(ram)
MERGE (fowler)-[:MEMBER_OF]->(ram)
MERGE (carmack)-[:MEMBER_OF]->(ram)
MERGE (knuth)-[:MEMBER_OF]->(ram)
MERGE (devops)-[:MEMBER_OF]->(ram)
MERGE (brandStrat)-[:MEMBER_OF]->(durham)
MERGE (ogilvy)-[:MEMBER_OF]->(durham)
MERGE (bernbach)-[:MEMBER_OF]->(durham)
MERGE (paulRand)-[:MEMBER_OF]->(durham)
MERGE (annie)-[:MEMBER_OF]->(durham)
MERGE (rubin)-[:MEMBER_OF]->(durham)

// ============================================
// PROJECT ASSIGNMENTS
// ============================================
MERGE (brooks)-[:CONTRIBUTES_TO]->(allura)
MERGE (brooks)-[:CONTRIBUTES_TO]->(agentOS)
MERGE (woz)-[:CONTRIBUTES_TO]->(allura)
MERGE (knuth)-[:CONTRIBUTES_TO]->(allura)
MERGE (bellard)-[:CONTRIBUTES_TO]->(allura)
MERGE (devops)-[:CONTRIBUTES_TO]->(allura)
MERGE (scout)-[:CONTRIBUTES_TO]->(allura)
MERGE (pike)-[:CONTRIBUTES_TO]->(allura)
MERGE (fowler)-[:CONTRIBUTES_TO]->(allura)
MERGE (curator)-[:CONTRIBUTES_TO]->(allura)
MERGE (auditor)-[:CONTRIBUTES_TO]->(allura)
MERGE (gilliam)-[:CONTRIBUTES_TO]->(allura)
MERGE (gilliam)-[:CONTRIBUTES_TO]->(agentOS)
MERGE (carmack)-[:CONTRIBUTES_TO]->(allura)
MERGE (brandStrat)-[:CONTRIBUTES_TO]->(creativeStudio)
MERGE (ogilvy)-[:CONTRIBUTES_TO]->(creativeStudio)
MERGE (bernbach)-[:CONTRIBUTES_TO]->(creativeStudio)
MERGE (paulRand)-[:CONTRIBUTES_TO]->(creativeStudio)
MERGE (annie)-[:CONTRIBUTES_TO]->(creativeStudio)
MERGE (rubin)-[:CONTRIBUTES_TO]->(creativeStudio)

// ============================================
// DELEGATION CHAIN (Chain of Command)
// ============================================
MERGE (jobs)-[:DELEGATES_TO]->(brooks)
MERGE (jobs)-[:DELEGATES_TO]->(woz)
MERGE (jobs)-[:DELEGATES_TO]->(scout)
MERGE (brooks)-[:DELEGATES_TO]->(jobs)
MERGE (brooks)-[:DELEGATES_TO]->(woz)
MERGE (brooks)-[:DELEGATES_TO]->(scout)
MERGE (brooks)-[:DELEGATES_TO]->(pike)
MERGE (brooks)-[:DELEGATES_TO]->(fowler)
MERGE (brooks)-[:DELEGATES_TO]->(bellard)
MERGE (woz)-[:ESCALATES_TO]->(brooks)
MERGE (woz)-[:ESCALATES_TO]->(pike)
MERGE (woz)-[:ESCALATES_TO]->(fowler)
MERGE (woz)-[:ESCALATES_TO]->(bellard)
MERGE (scout)-[:ESCALATES_TO]->(jobs)
MERGE (scout)-[:ESCALATES_TO]->(brooks)
MERGE (pike)-[:ESCALATES_TO]->(brooks)
MERGE (fowler)-[:ESCALATES_TO]->(brooks)
MERGE (bellard)-[:ESCALATES_TO]->(brooks)
MERGE (carmack)-[:ESCALATES_TO]->(brooks)
MERGE (knuth)-[:ESCALATES_TO]->(brooks)

// Durham delegation chain
MERGE (brandStrat)-[:DELEGATES_TO]->(ogilvy)
MERGE (brandStrat)-[:DELEGATES_TO]->(bernbach)
MERGE (brandStrat)-[:DELEGATES_TO]->(paulRand)
MERGE (brandStrat)-[:DELEGATES_TO]->(annie)
MERGE (ogilvy)-[:HANDS_OFF_TO]->(bernbach)
MERGE (bernbach)-[:HANDS_OFF_TO]->(paulRand)
MERGE (bernbach)-[:HANDS_OFF_TO]->(annie)
MERGE (paulRand)-[:HANDS_OFF_TO]->(rubin)
MERGE (annie)-[:HANDS_OFF_TO]->(rubin)

// Curator pipeline chain
MERGE (curator)-[:PROPOSES_TO]->(auditor)
MERGE (auditor)-[:APPROVES_PROMOTION]->(curator)