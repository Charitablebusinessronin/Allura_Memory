# Awesome Agent Skills Catalog - For OpenCode/Claude Code

> Curated collection of 1000+ agent skills from official dev teams and community
> Source: https://github.com/VoltAgent/awesome-agent-skills

---

## Quick Reference

This catalog maps the VoltAgent awesome-skills repo to **roninmemory** workflows.

**When to use:** Load these skills via OpenCode when working on specific domains.

---

## By Category

### 🗄️ Databases & Storage

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **neon-postgres** | Neon Team | Serverless Postgres best practices | Using Neon for roninmemory |
| **claimable-postgres** | Neon Team | Database provisioning | Multi-tenant setup |
| **supabase-postgres-best-practices** | Supabase | PostgreSQL patterns | Supabase integration |
| **tinybird-best-practices** | Tinybird | Analytics databases | Event analytics |
| **clickhouse** | ClickHouse | OLAP queries | Big data analytics |
| **couchbase** | Community | Document DB | NoSQL needs |

**Roninmemory Use:** 
- ✅ Use `neon-postgres` for Neon integration
- ✅ Use `supabase-postgres` for Supabase + Postgres

---

### 🔍 Search & Discovery

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **tavily-search** | Community | Web search | Research tasks |
| **brave-search** | Community | Web search | Alternative search |
| **context7** | Community | Code documentation | Library lookup |
| **ref** | Community | Documentation search | Private docs |
| **paper-search** | Community | Academic papers | Research |

**Roninmemory Use:**
- ✅ Use `tavily-search` for web research
- ✅ Use `context7` for library docs

---

### 🔒 Security & Audit

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **ask-questions-if-underspecified** | Trail of Bits | Clarify requirements | Before coding |
| **audit-context-building** | Trail of Bits | Security auditing | Security reviews |
| **building-secure-contracts** | Trail of Bits | Smart contracts | Web3 dev |
| **differential-review** | Trail of Bits | Security diff review | Code review |
| **semgrep** | Community | Code security scan | CI/CD |
| **sonarqube** | Community | Code quality | Static analysis |

**Roninmemory Use:**
- ✅ Use `ask-questions-if-underspecified` at start
- ✅ Use `audit-context-building` for security work
- ✅ Use `differential-review` for PR reviews

---

### ☁️ Cloud & Infrastructure

#### AWS (30+ skills)
| Skill | Purpose |
|-------|---------|
| **aws-core** | Starting point |
| **aws-cdk** | Infrastructure as Code |
| **aws-terraform** | IaC patterns |
| **cloudwatch** | Monitoring |
| **cloudtrail** | Audit logging |
| **iam** | Identity management |

#### Cloudflare (10+ skills)
| Skill | Purpose |
|-------|---------|
| **wrangler** | Workers deployment |
| **durable-objects** | Stateful coordination |
| **agents-sdk** | AI agents on Cloudflare |
| **building-mcp-server** | MCP on Cloudflare |
| **web-perf** | Performance audit |

#### Vercel (6+ skills)
| Skill | Purpose |
|-------|---------|
| **next-best-practices** | Next.js patterns |
| **next-upgrade** | Version upgrades |
| **vercel-deploy** | Deployment |
| **react-best-practices** | React patterns |

**Roninmemory Use:**
- ✅ Use `next-best-practices` for Next.js
- ✅ Use `cloudflare-wrangler` for Workers
- ✅ Use `aws-core` for AWS

---

### 🧪 Testing & Quality

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **playwright-testing** | Anthropic | E2E browser testing | UI testing |
| **vitest-testing** | Community | Unit testing | Test setup |
| **testing-best-practices** | Community | Testing patterns | TDD workflow |
| **hoverfly** | Community | API mocking | Integration tests |

**Roninmemory Use:**
- ✅ Use `playwright-testing` for E2E
- ✅ Use `hoverfly` for API mocking

---

### 📝 Documentation

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **design-md** | Google Labs | DESIGN.md files | Planning |
| **docx** | Anthropic | Word documents | Reports |
| **xlsx** | Anthropic | Excel spreadsheets | Data analysis |
| **pdf** | Anthropic | PDF handling | Document processing |
| **notion** | Notion Team | Notion workspace | Knowledge base |
| **obsidian** | Community | Obsidian vault | Personal notes |

**Roninmemory Use:**
- ✅ Use `design-md` for architecture docs
- ✅ Use `notion` for knowledge base
- ✅ Use `xlsx` for data exports

---

### 🤖 AI/ML

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **gemini-api-dev** | Google | Gemini API dev | Google AI |
| **hugging-face-cli** | Hugging Face | HF Hub operations | ML models |
| **replicate** | Replicate | Model deployment | AI inference |
| **chroma** | Community | Vector database | Embeddings |

**Roninmemory Use:**
- ✅ Use `hugging-face-cli` for ML workflows
- ✅ Use `chroma` for vector search

---

### 💳 Payments

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **stripe-best-practices** | Stripe | Payment integration | E-commerce |
| **upgrade-stripe** | Stripe | SDK upgrades | Maintenance |

**Roninmemory Use:**
- ✅ Use for Faith Meats payment processing

---

### 📱 Mobile

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **react-native-best-practices** | CallStack | RN optimization | Mobile apps |
| **upgrading-react-native** | CallStack | RN upgrades | Maintenance |
| **expo-deployment** | Expo | Expo deployment | Mobile deployment |
| **expo-ui-swift-ui** | Expo | iOS UI components | Native iOS |

---

### 🏗️ Infrastructure as Code

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **terraform-code-generation** | HashiCorp | Generate TF code | IaC |
| **terraform-module-generation** | HashiCorp | TF modules | Reusable IaC |
| **pulumi** | Community | Pulumi IaC | Alternative to TF |

---

### 🎨 UI/UX

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **frontend-design** | Anthropic | UI/UX design | Design work |
| **canvas-design** | Anthropic | Visual design | Artifacts |
| **web-design-guidelines** | Vercel | Web design standards | Design systems |
| **composition-patterns** | Vercel | Component patterns | React design |

---

### 🔄 DevOps & CI/CD

| Skill | Source | Purpose | When to Use |
|-------|--------|---------|-------------|
| **expo-cicd-workflows** | Expo | CI/CD for mobile | Mobile CI |
| **netlify-deploy** | Netlify | Netlify deployment | Static sites |
| **github** | GitHub | GitHub workflows | PRs, issues |
| **gitlab** | GitLab | GitLab CI/CD | GitLab repos |

---

## By Workflow

### When Starting a Project
```
1. ask-questions-if-underspecified (Trail of Bits)
2. design-md (Google Labs)
3. neon-postgres (Neon) - if using Neon
4. next-best-practices (Vercel) - if Next.js
```

### When Building Features
```
1. react-best-practices (Vercel)
2. supabase-postgres-best-practices (Supabase)
3. stripe-best-practices (Stripe) - if payments
4. testing-best-practices (Community)
```

### When Deploying
```
1. vercel-deploy (Vercel)
2. netlify-deploy (Netlify)
3. cloudflare-wrangler (Cloudflare)
4. aws-core (AWS)
```

### When Auditing/Reviewing
```
1. audit-context-building (Trail of Bits)
2. differential-review (Trail of Bits)
3. sonarqube (Community)
4. semgrep (Community)
```

### When Documenting
```
1. notion (Notion)
2. docx/xlsx/pdf (Anthropic)
3. design-md (Google Labs)
```

---

## How to Load Skills

### Via OpenCode

**opencode.json:**
```json
{
  "skills": {
    "directories": [
      ".opencode/skills",
      "/path/to/awesome-agent-skills"
    ]
  }
}
```

**Clone the repo:**
```bash
git clone https://github.com/VoltAgent/awesome-agent-skills.git
cd awesome-agent-skills
```

**Link specific skills:**
```bash
ln -s /path/to/awesome-agent-skills/skills/security/trailofbits \
  .opencode/skills/security-trailofbits
```

### Via MCP_DOCKER

Some skills have MCP server equivalents:
```bash
# Find MCP version
MCP_DOCKER_mcp-find --query "neon postgres"

# Configure and add
MCP_DOCKER_mcp-config-set --server neon --config '{"api_key":"..."}'
MCP_DOCKER_mcp-add --name neon --activate
```

---

## Integration with roninmemory

### Recommended Skill Stack

**For Web Development:**
- vercel-labs/next-best-practices
- supabase/supabase-postgres-best-practices
- anthropic/playwright-testing
- trailofbits/ask-questions-if-underspecified

**For AI/ML:**
- google-gemini/gemini-api-dev
- huggingface/hugging-face-cli
- chroma/chroma (if using vectors)

**For Security:**
- trailofbits/audit-context-building
- trailofbits/differential-review
- semgrep/semgrep

**For Documentation:**
- notion/notion
- anthropic/docx/xlsx
- google-labs-code/design-md

**For DevOps:**
- hashicorp/terraform-code-generation
- aws-core/aws-core
- cloudflare/wrangler

---

## Skill Quality Standards

From VoltAgent repo - skills should have:
- ✅ Clear purpose and scope
- ✅ Real-world usage patterns
- ✅ Not mass AI-generated
- ✅ Maintained by teams
- ✅ Compatible with Claude/Codex/Cursor

---

## Contributing

To add skills to roninmemory:
1. Fork awesome-agent-skills
2. Create skill in appropriate category
3. Test with roninmemory agent
4. Submit PR

---

## Related Resources

- **VoltAgent Repo:** https://github.com/VoltAgent/awesome-agent-skills
- **Claude Subagents:** https://github.com/VoltAgent/awesome-claude-code-subagents
- **Codex Subagents:** https://github.com/VoltAgent/awesome-codex-subagents
- **OpenClaw Skills:** https://github.com/VoltAgent/awesome-openclaw-skills
- **AI Agent Papers:** https://github.com/VoltAgent/awesome-ai-agent-papers

---

*Last updated: 2026-03-30*
*Source: VoltAgent/awesome-agent-skills (13.4k stars, 1060+ skills)*
