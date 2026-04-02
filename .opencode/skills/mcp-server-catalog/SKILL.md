# MCP Server Catalog - 300+ Available Tools

> **When to use this skill:** When you need to add MCP capabilities to your OpenCode session. Use `MCP_DOCKER_mcp-find` to discover, `MCP_DOCKER_mcp-config-set` to configure, and `MCP_DOCKER_mcp-add` to activate.

---

## Quick Reference

```bash
# Discover
MCP_DOCKER_mcp-find --query "database"

# Configure  
MCP_DOCKER_mcp-config-set --server database-server --config '{"database_url":"..."}'

# Activate
MCP_DOCKER_mcp-add --name database-server --activate

# Use (via configured server)
query_database --query "..."  // When using postgres-mcp server
```

---

## Databases & Storage (31 servers)

| Server | Purpose | Key Tools |
|--------|---------|-----------|
| **database-server** | PostgreSQL/MySQL/SQLite | `query_database`, `execute_sql`, `insert_data` |
| **neo4j-cypher** | Neo4j graph database | `read_neo4j_cypher`, `write_neo4j_cypher` |
| **neo4j-memory** | Neo4j persistence layer | Graph storage for memory |
| **neo4j-cloud-aura-api** | Neo4j Aura management | Cloud instance management |
| **mongodb** | MongoDB/Atlas | Document database operations |
| **postgres-mcp** | PostgreSQL MCP | Direct Postgres integration |
| **redis** | Redis key-value | `get`, `set`, `delete` |
| **redis-cloud** | Redis Cloud API | Managed Redis operations |
| **sqlite-mcp-server** | SQLite with extensions | Full-text search, vectors |
| **couchbase** | Distributed document DB | SQL++ queries |
| **chroma** | Vector database | Embeddings storage |
| **neon** | Serverless Postgres | Branch management |
| **oracle** | Oracle Database | Enterprise SQL |
| **cockroachdb** | CockroachDB | Distributed SQL |
| **tigris** | S3-compatible storage | Object storage |
| **instant** | Firebase-like database | Real-time sync |
| **metabase** | BI/Analytics | 70+ data tools |
| **fibery** | Workspace database | App building |
| **n8n** | Workflow automation | 543 nodes |
| **schemacrawler-ai** | Schema analysis | Natural language DB queries |

---

## Search & Web (25+ servers)

| Server | Purpose | Key Tools |
|--------|---------|-----------|
| **tavily** | Web search & extraction | `tavily_search`, `tavily_extract`, `tavily_research` |
| **exa** | AI search engine | `web_search_exa` |
| **brave** | Brave Search API | Web, images, news |
| **kagisearch** | Kagi search | Premium web search |
| **perplexity-ask** | Perplexity API | Research queries |
| **ref** | Documentation search | Private + public docs |
| **context7** | Code documentation | Library docs |
| **audioscrape** | Audio content search | Podcast search |
| **paper-search** | Academic papers | arXiv, PubMed |

---

## Browser Automation (15+ servers)

| Server | Purpose | Key Tools |
|--------|---------|-----------|
| **playwright** | Browser automation | `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot` |
| **playwright-mcp-server** | Enhanced Playwright | Full browser control |
| **puppeteer** | Chrome automation | Page manipulation |
| **browserbase** | Cloud browser | AI-powered automation |
| **firecrawl** | Web scraping | `crawl`, `scrape`, `map` |
| **cloudflare-browser-rendering** | Page rendering | Screenshots, markdown |
| **apify-mcp-server** | Web scraping | Actor marketplace |

---

## Version Control (20+ servers)

| Server | Purpose | Key Tools |
|--------|---------|-----------|
| **github** | GitHub API | Repos, issues, PRs |
| **github-official** | Official GitHub | Full GitHub integration |
| **github-chat** | GitHub Chat API | Repo analysis |
| **gitlab** | GitLab API | Self-hosted + cloud |
| **git** | Git operations | Local repo management |
| **gitmcp** | Git tools | Repository interaction |
| **linear** | Linear.app | Issue tracking |
| **atlassian** | Jira + Confluence | Project management |
| **teamwork** | Teamwork.com | Collaboration |

---

## Communication (15+ servers)

| Server | Purpose | Key Tools |
|--------|---------|-----------|
| **slack** | Slack workspace | Messages, channels |
| **mcp-discord** | Discord platform | Bot integration |
| **waystation** | Multi-platform | Notion, Slack, Asana |
| **line** | LINE Messaging | Official accounts |
| **gmail-mcp** | Gmail IMAP/SMTP | Email operations |

---

## Documentation & Knowledge (25+ servers)

| Server | Purpose | Key Tools |
|--------|---------|-----------|
| **notion** | Notion workspace | Pages, databases |
| **notion-remote** | Notion pages | Collaborative docs |
| **obsidian** | Obsidian vault | Personal knowledge |
| **deepwiki** | GitHub wiki | Repo documentation |
| **atlas-docs** | Library docs | Hosted documentation |
| **cloudflare-docs** | Cloudflare docs | Workers, Pages, R2 |
| **astro-docs** | Astro framework | Web framework docs |
| **gemini-api-docs** | Gemini API | Google AI docs |
| **docker-docs** | Docker docs | Container docs |
| **javadocs** | Java/Kotlin/Scala | Library documentation |
| **maven-tools-mcp** | Maven Central | Dependency intelligence |
| **markdownify** | Convert to Markdown | Any format → MD |
| **llmtxt** | llms.txt discovery | Website context |

---

## Cloud & Infrastructure (50+ servers)

### AWS (30+ servers)
| Server | Purpose |
|--------|---------|
| **aws-core-mcp-server** | AWS starting point |
| **aws-api** | Comprehensive AWS API |
| **awslabs-ccapi** | Cloud Control API |
| **awslabs-cfn** | CloudFormation |
| **awslabs-cloudwatch** | Monitoring |
| **awslabs-cloudwatch-appsignals** | APM |
| **awslabs-cloudtrail** | Audit logging |
| **awslabs-iam** | Identity management |
| **awslabs-cost-explorer** | Cost analysis |
| **awslabs-billing-cost-management** | Billing |
| **awslabs-s3-tables** | S3 analytics |
| **awslabs-memcached** | Caching |
| **awslabs-elasticache** | Redis/ElastiCache |
| **amazon-neptune** | Graph database |
| **aws-bedrock-data-automation** | AI data processing |
| **aws-bedrock-custom-model-import** | Custom ML models |
| **awslabs-nova-canvas** | Image generation |
| **aws-location** | Maps, geocoding |
| **aws-appsync** | GraphQL APIs |
| **aws-msk** | Managed Kafka |
| **aws-healthomics** | Life sciences |
| **aws-iot-sitewise** | IoT management |
| **aws-kb-retrieval-server** | Knowledge base |
| **awslabs-timestream-for-influxdb** | Time-series |
| **awslabs-cloudwatch-appsignals** | App monitoring |
| **aws-pricing** | Cost estimates |
| **aws-dataprocessing** | Data transform |
| **aws-documentation** | AWS docs |
| **aws-terraform** | IaC patterns |
| **aws-cdk-mcp-server** | CDK patterns |

### Azure (10+ servers)
| Server | Purpose |
|--------|---------|
| **azure** | Microsoft Azure |
| **aks** | Azure Kubernetes |
| **atlassian** | Confluence/Jira |

### Other Cloud (15+ servers)
| Server | Purpose |
|--------|---------|
| **pulumi-remote** | Pulumi IaC |
| **terraform** | Terraform IaC |
| **cloud-run-mcp** | Google Cloud Run |
| **render** | Render.com |
| **heroku** | Heroku platform |
| **cloudflare-workers-bindings** | Workers |
| **cloudflare-observability** | Monitoring |
| **cloudflare-graphql** | GraphQL analytics |
| **cloudflare-audit-logs** | Audit logs |
| **cloudflare-ai-gateway** | AI gateway |
| **cloudflare-one-casb** | Security |
| **cloudflare-digital-experience-monitoring** | RUM |
| **cloudflare-browser-rendering** | Rendering |
| **cloudflare-docs** | Documentation |

---

## Security (25+ servers)

| Server | Purpose |
|--------|---------|
| **beagle-security** | Automated security tests |
| **stackhawk** | Security scanning |
| **semgrep** | Code security scan |
| **ramparts** | MCP server security |
| **sonarqube** | Code quality |
| **okta-mcp-fctr** | Identity management |
| **vectra-ai-rux-mcp-server** | Threat detection |
| **cyreslab-ai-shodan** | Shodan integration |
| **firewalla-mcp-server** | Network security |
| **cloudflare-one-casb** | SaaS security |
| **onlyoffice-docspace** | Secure collaboration |
| **vuln-nist-mcp-server** | CVE database |

---

## Monitoring & Observability (38+ servers)

| Server | Purpose |
|--------|---------|
| **prometheus** | Metrics querying |
| **grafana** | Dashboards |
| **victoriametrics** | Time-series DB |
| **victorialogs** | Log management |
| **victoriatraces** | Distributed tracing |
| **dynatrace-mcp-server** | Observability platform |
| **cloudflare-observability** | Full-stack monitoring |
| **smartbear** | BugSnag, PactFlow |
| **scorecard** | LLM evaluation |
| **testkube** | Continuous testing |
| **buildkite** | CI/CD pipelines |
| **circleci** | CI/CD automation |
| **opik** | LLM observability |
| **suzieq** | Network observability |
| **globalping** | Network testing |
| **polar-signals** | Continuous profiling |

---

## API Management (30+ servers)

| Server | Purpose |
|--------|---------|
| **openapi** | OpenAPI/Swagger |
| **openapi-schema** | Schema exposure |
| **smartbear** | API Hub, PactFlow |
| **kong** | Kong Gateway |
| **aws-appsync** | GraphQL APIs |
| **text-to-graphql** | Natural language GraphQL |
| **grafbase** | GraphQL federation |
| **dreamfactory-mcp** | REST API generation |
| **mcp-api-gateway** | Universal API gateway |
| **stripe** | Stripe API |
| **stripe-remote** | Stripe remote |
| **singlestore** | Database API |
| **neon** | Postgres API |
| **mercado-pago** | Payments |
| **mercado-libre** | E-commerce |

---

## AI/ML (20+ servers)

| Server | Purpose |
|--------|---------|
| **amazon-bedrock-agentcore** | Bedrock agents |
| **awslabs-nova-canvas** | Image generation |
| **everart** | AI art |
| **text-to-graphql** | NL → GraphQL |
| **scorecard** | LLM testing |
| **opik** | LLM monitoring |
| **beagle-security** | AI security testing |
| **chroma** | Vector search |
| **qdrant** | Vector database |
| **weaviate** | Vector search |
| **pinecone** | Vector DB |
| **context7** | Code embeddings |

---

## Finance & Trading (15+ servers)

| Server | Purpose |
|--------|---------|
| **quantconnect** | Trading algorithms |
| **hummingbot-mcp** | Crypto trading |
| **zerodha-kite** | Stock trading (India) |
| **bitrefill** | Crypto payments |
| **maestro-mcp-server** | Bitcoin blockchain |
| **hdx** | Humanitarian data |

---

## DevOps & Infrastructure (40+ servers)

| Server | Purpose |
|--------|---------|
| **kubernetes** | K8s cluster management |
| **kubectl-mcp-server** | kubectl operations |
| **aks** | Azure Kubernetes |
| **inspektor-gadget** | K8s troubleshooting |
| **hoverfly-mcp-server** | API mocking |
| **stackgen** | AI DevOps |
| **pulumi-remote** | Infrastructure as Code |
| **terraform** | IaC management |
| **cloudflare-workers-bindings** | Edge compute |
| **n8n** | Workflow automation |
| **edubase** | E-learning platform |
| **thingsboard** | IoT platform |

---

## Testing & Quality (20+ servers)

| Server | Purpose |
|--------|---------|
| **playwright** | E2E testing |
| **testkube** | Test orchestration |
| **smartbear** | PactFlow (contracts) |
| **hoverfly-mcp-server** | API simulation |
| **scorecard** | LLM evaluation |
| **semgrep** | Static analysis |
| **sonarqube** | Code quality |
| **buildkite** | Test suites |
| **circleci** | CI testing |

---

## Filesystem & Storage (15+ servers)

| Server | Purpose |
|--------|---------|
| **rust-mcp-filesystem** | Secure file ops |
| **filesystem** | File access |
| **box** | Box.com |
| **tigris** | Object storage |
| **awslabs-s3-tables** | S3 analytics |

---

## Communication & Email (10+ servers)

| Server | Purpose |
|--------|---------|
| **slack** | Workspace |
| **mcp-discord** | Discord |
| **waystation** | Multi-platform |
| **line** | LINE |
| **gmail-mcp** | Gmail |

---

## Documentation & Wiki (15+ servers)

| Server | Purpose |
|--------|---------|
| **notion** | Workspace |
| **obsidian** | Vault |
| **atlas-docs** | Library docs |
| **deepwiki** | GitHub wiki |
| **context7** | Code docs |
| **markdownify** | Any → Markdown |

---

## How to Use

### 1. Find the right server
```bash
MCP_DOCKER_mcp-find --query "postgres monitoring" --limit 10
```

### 2. Configure it
```bash
MCP_DOCKER_mcp-config-set --server database-server \
  --config '{"database_url":"postgresql://..."}'
```

### 3. Activate it
```bash
MCP_DOCKER_mcp-add --name database-server --activate
```

### 4. Use the tools
```javascript
// PostgreSQL (via postgres-mcp server)
query_database({ query: "SELECT * FROM events" })
execute_sql({ sql_query: "..." })

// Neo4j (via neo4j-cypher server)
read_neo4j_cypher({ query: "MATCH (n) RETURN n" })
write_neo4j_cypher({ query: "CREATE (n:Node ...)" })

// Search
MCP_DOCKER_tavily_search({ query: "OpenCode MCP", max_results: 5 })
MCP_DOCKER_web_search_exa({ query: "OpenCode docs" })

// Browser
MCP_DOCKER_browser_navigate({ url: "https://example.com" })
MCP_DOCKER_browser_click({ ref: "button1" })
```

---

## Security Best Practices

1. **Never commit credentials** - Use env vars
2. **Least privilege** - Only add needed servers
3. **Remove unused** - `MCP_DOCKER_mcp-remove --name server`
4. **Validate configs** - Test before using

---

## Common Patterns

### Memory System Setup
```javascript
// Configure
MCP_DOCKER_mcp-config-set({
  server: "database-server",
  config: { database_url: "postgresql://localhost/memory" }
})
MCP_DOCKER_mcp-config-set({
  server: "neo4j-cypher",
  config: { url: "bolt://localhost:7687", username: "neo4j" }
})

// Add
MCP_DOCKER_mcp-add({ name: "database-server", activate: true })
MCP_DOCKER_mcp-add({ name: "neo4j-cypher", activate: true })
```

### Web Research
```javascript
MCP_DOCKER_tavily_research({
  input: "OpenCode MCP servers 2026",
  model: "pro"
})
```

### Browser Testing
```javascript
MCP_DOCKER_browser_navigate({ url: "http://localhost:3000" })
MCP_DOCKER_browser_snapshot({})  // Get page structure
MCP_DOCKER_browser_click({ ref: "submit-button" })
```

---

## Category Quick Links

- [Databases](#databases--storage-31-servers)
- [Search](#search--web-25-servers)
- [Browser](#browser-automation-15-servers)
- [Git](#version-control-20-servers)
- [Cloud](#cloud--infrastructure-50-servers)
- [Security](#security-25-servers)
- [Monitoring](#monitoring--observability-38-servers)
- [APIs](#api-management-30-servers)

---

*Last updated: From Docker MCP Catalog via MCP_DOCKER*
