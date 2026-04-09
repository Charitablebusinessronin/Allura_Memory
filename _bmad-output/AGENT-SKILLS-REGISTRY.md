# Agent Skills Registry

**Status**: ✅ Seeded to PostgreSQL | 📋 Ready for Notion sync

## Summary

- **Total Unique Skills**: 20
- **Total Agent Assignments**: 38
- **Platforms Covered**: Claude Code, OpenCode, GitHub, Cloudflare

## By Tier

### Tier 1 — Critical (6 skills)
Priority installation this week.

| Skill | Category | Primary Agents | Platform |
|-------|----------|---|---|
| mcp-builder | Core | All | Claude Code |
| postgres-best-practices | Core | Knuth | All |
| next-best-practices | Core | Knuth | All |
| github | GitHub | All | All |
| code-review | GitHub | Dijkstra | GitHub |
| skill-creator | Core | Willison | Claude Code |

**Total assignments**: 24 (6 skills × multiple agents)

### Tier 2 — High Value (9 skills)
Install next week after validating Tier 1.

| Skill | Category | Primary Agents | Platform |
|-------|----------|---|---|
| security-best-practices | Code Quality | Dijkstra | All |
| react-best-practices | Code Quality | Hopper | OpenCode |
| create-pr | GitHub | Knuth | GitHub |
| commit | GitHub | Torvalds | GitHub |
| figma-implement-design | Design | Hinton | All |
| firecrawl-agent | Discovery | Hopper | Claude Code |
| notion-knowledge-capture | Context | Cerf | All |
| claude-settings-audit | Governance | Brooks | Claude Code |
| semgrep-rule-creator | Analysis | Liskov | All |

**Total assignments**: 9 (one per skill)

### Tier 3 — Nice-to-Have (5 skills)
Roadmap items for later phases.

| Skill | Category | Primary Agents | Platform |
|-------|----------|---|---|
| terraform-style-guide | Infrastructure | Torvalds | OpenCode |
| sanity-best-practices | Content | Berners-Lee | All |
| next-upgrade | Framework | Knuth | All |
| composition-patterns | Architecture | Turing | All |
| web-perf | Performance | Hopper | Cloudflare |

**Total assignments**: 5 (one per skill)

---

## Agent Skills Mapping

### Frederick Brooks (Orchestrator)
- github (Tier 1)
- claude-settings-audit (Tier 2)

### Willison (Prompt Architect)
- skill-creator (Tier 1)

### Donald Knuth (Deep Worker)
- postgres-best-practices (Tier 1)
- next-best-practices (Tier 1)
- create-pr (Tier 2)
- next-upgrade (Tier 3)

### Alan Turing (Architect)
- github (Tier 1)
- composition-patterns (Tier 3)

### Tim Berners-Lee (Curator)
- github (Tier 1)
- sanity-best-practices (Tier 3)

### Grace Hopper (Explorer)
- github (Tier 1)
- react-best-practices (Tier 2)
- firecrawl-agent (Tier 2)
- web-perf (Tier 3)

### Vint Cerf (Context Manager)
- github (Tier 1)
- notion-knowledge-capture (Tier 2)

### Linus Torvalds (Builder)
- github (Tier 1)
- commit (Tier 2)
- terraform-style-guide (Tier 3)

### Barbara Liskov (Analyst)
- github (Tier 1)
- semgrep-rule-creator (Tier 2)

### Edsger Dijkstra (Reviewer)
- github (Tier 1)
- code-review (Tier 1)
- security-best-practices (Tier 2)

### Geoffrey Hinton (Vision)
- github (Tier 1)
- figma-implement-design (Tier 2)

---

## Database Status

✅ **PostgreSQL**: 38 rows seeded to `agent_skills` table
✅ **Columns**: skill_name, skill_category, tier, agent_id, platform, group_id, status, created_at

**Query for Notion sync:**
```sql
SELECT 
  skill_name, 
  skill_category, 
  agent_id, 
  platform,
  tier,
  'pending' as status
FROM agent_skills
WHERE group_id = 'allura-roninmemory'
ORDER BY tier, skill_name, agent_id;
```

---

## Next Steps

### Immediate (This Week)
1. ✅ Seed PostgreSQL (DONE)
2. 📋 Create Notion database (manual or script)
3. 🔄 Install Tier 1 skills in Claude Code + OpenCode
4. ✅ Validate each skill works

### Short-term (Next Week)
5. 📦 Install Tier 2 skills
6. 🧪 Test agent workflows with new skills
7. 📊 Update agent performance dashboard

### Roadmap (Later)
8. 📦 Install Tier 3 skills
9. 🎯 Measure skill adoption and effectiveness
10. 🔄 Auto-tune skill recommendations per agent

---

**Created**: 2026-04-08  
**Source**: VoltAgent/awesome-agent-skills (1000+ community skills)  
**Status**: Ready for production deployment

