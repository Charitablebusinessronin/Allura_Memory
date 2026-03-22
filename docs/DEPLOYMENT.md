# Production Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 16+ (or use Docker)
- Neo4j 5.x+ (or use Docker)
- OpenAI API key (for embeddings)
- Notion Integration Token (for sync)

## Quick Start

```bash
# 1. Copy environment template
cp .env.production.example .env

# 2. Edit .env with your values
nano .env

# 3. Start services with Docker Compose
docker-compose up -d

# 4. Verify services are healthy
docker-compose ps

# 5. Run tests
npm test

# 6. Run E2E tests (requires running services)
npm run test:e2e

# 7. Generate documentation
npm run docs
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | `your_secure_password` |
| `NEO4J_PASSWORD` | Neo4j password | `your_secure_password` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `NOTION_API_KEY` | Notion Integration Token | `secret_...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `memory` |
| `POSTGRES_USER` | Database user | `ronin4life` |
| `POSTGRES_POOL_MAX` | Max connections | `20` |
| `NEO4J_URI` | Neo4j URI | `bolt://localhost:7687` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_DATABASE` | Database name | `neo4j` |
| `NEO4J_POOL_MAX` | Max connections | `50` |
| `NOTION_INSIGHTS_DATABASE_ID` | Notion database ID | `insights-database` |
| `EVIDENCE_BASE_URL` | Evidence URL base | `http://localhost:3000/evidence` |

## Docker Services

The `docker-compose.yml` defines:

| Service | Port | Purpose |
|---------|------|---------|
| `postgres` | 5432 | PostgreSQL database |
| `neo4j` | 7474, 7687 | Neo4j graph database |
| `dozzle` | 8088 | Log viewer |
| `dashboard` | 3000 | Next.js application |

### Starting Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d postgres

# View logs
docker-compose logs -f neo4j

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Health Checks

### PostgreSQL

```bash
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
```

### Neo4j

```bash
curl http://localhost:7474
```

### Application

```bash
curl http://localhost:3000/api/health
```

## Performance Benchmarking

Run performance benchmarks:

```bash
# Default: 1000 events, batch size 100
npm run benchmark

# Custom configuration
node scripts/benchmark.js --events=5000 --batch=500 --output=results.json
```

## Testing

### Unit Tests

```bash
npm test
```

### E2E Integration Tests

Requires running PostgreSQL and Neo4j:

```bash
# Start databases
docker-compose up -d postgres neo4j

# Run E2E tests
npm run test:e2e
```

### Test Coverage

```bash
npm run test:coverage
```

## Monitoring

### Logs

- **PostgreSQL**: `docker-compose logs postgres`
- **Neo4j**: `docker-compose logs neo4j`
- **Dozzle**: http://localhost:8088

### Metrics

- **Neo4j Browser**: http://localhost:7474
- **Application Metrics**: Available via /api/metrics endpoint

## Troubleshooting

### Connection Errors

**PostgreSQL:**
```bash
# Check if running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Verify connection
psql -h localhost -U ronin4life -d memory
```

**Neo4j:**
```bash
# Check if running
docker-compose ps neo4j

# Check logs
docker-compose logs neo4j

# Verify connection
cypher-shell -a bolt://localhost:7687 -u neo4j -p your_password
```

### Common Issues

1. **"POSTGRES_PASSWORD environment variable is required"**
   - Set `POSTGRES_PASSWORD` in `.env`

2. **"NEO4J_PASSWORD environment variable is required"**
   - Set `NEO4J_PASSWORD` in `.env`

3. **"Connection refused"**
   - Ensure services are running: `docker-compose up -d`
   - Check port conflicts

4. **"Authentication failed"**
   - Verify credentials in `.env` match docker-compose

5. **"Database already exists"**
   - For fresh start: `docker-compose down -v`

## Security Checklist

- [ ] Change default passwords in production
- [ ] Use secrets management (Docker secrets, Vault, etc.)
- [ ] Enable TLS for PostgreSQL and Neo4j
- [ ] Configure firewall rules
- [ ] Set up backup strategies
- [ ] Enable audit logging
- [ ] Review and rotate API keys regularly

## Backup & Recovery

### Local Backup Layout

All local backup artifacts are written to repo-local folders:

- `backups/postgres/` - PostgreSQL SQL dumps
- `backups/neo4j/` - Neo4j `.dump` files

Naming convention:

- PostgreSQL: `postgres-memory-YYYYMMDDTHHMMSSZ.sql`
- Neo4j: `neo4j-neo4j-YYYYMMDDTHHMMSSZ.dump`

### Create Backups

```bash
# PostgreSQL
./scripts/backup-postgres.sh

# Neo4j
./scripts/backup-neo4j.sh

# Storage + backup visibility audit (non-mutating)
./scripts/audit-memory-storage.sh
```

### Manual Verification Gate (Required)

Before marking backup work complete, verify:

```bash
# Containers are running
docker ps --format '{{.Names}} {{.Status}}'

# Named volumes exist
docker volume ls --format '{{.Name}}' | grep '^memory_'

# Latest backup artifacts are present
ls -1 backups/postgres
ls -1 backups/neo4j
```

If Docker is unavailable in your current environment, record this as an explicit manual follow-up and do not claim live volume verification is complete.

### Restore Drills

Use the most recent artifacts from `backups/postgres/` and `backups/neo4j/`.

#### PostgreSQL Restore Drill

```bash
BACKUP_SQL="backups/postgres/<your-backup-file>.sql"

# Restore into running container
cat "${BACKUP_SQL}" | docker exec -i knowledge-postgres psql -U ronin4life memory

# Verify database responds
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
```

#### Neo4j Restore Drill

```bash
BACKUP_DUMP="backups/neo4j/<your-backup-file>.dump"

# Copy backup into container temp path
docker cp "${BACKUP_DUMP}" knowledge-neo4j:/tmp/neo4j.dump

# Stop Neo4j, restore DB, then start
docker exec knowledge-neo4j neo4j stop
docker exec knowledge-neo4j neo4j-admin database load neo4j --from-path=/tmp --overwrite-destination=true
docker exec knowledge-neo4j neo4j start

# Verify Neo4j responds
docker exec knowledge-neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" "RETURN 1 AS ok"
```

### GitHub Storage Note

Do not commit raw production backup artifacts to GitHub. If you must retain backups in-repo for local snapshots, only commit sanitized/non-sensitive fixtures and keep real dumps in a secure external store.

## Scaling

### Horizontal Scaling

- Use PostgreSQL read replicas
- Configure Neo4j clustering
- Deploy dashboard behind load balancer

### Vertical Scaling

- Increase `POSTGRES_POOL_MAX` for high throughput
- Tune `NEO4J_HEAP_MAX` for large graphs
- Adjust `NODE_OPTIONS=--max-old-space-size=4096` for memory

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Dashboard                         │
│                      (Port 3000)                             │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  PostgreSQL │      │   Neo4j     │      │   OpenAI    │
│   (Port     │      │  (Port      │      │   (External)│
│    5432)    │      │   7687)     │      │             │
│             │      │             │      │             │
│  - Events   │      │  - Agent    │      │ - Embeddings│
│  - Outcomes │      │    Designs  │      │             │
│  - Sync     │      │  - Knowledge│      │             │
│    Status   │      │    Items    │      │             │
│  - ADAS     │      │  - Insights │      │             │
│    Runs     │      │             │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
```

## Module Reference

| Epic | Module | Purpose |
|------|--------|---------|
| 1 | `postgres/` | Event/outcome persistence |
| 1 | `neo4j/` | Knowledge graph storage |
| 1 | `validation/` | Schema validation |
| 1 | `audit/` | Audit trail logging |
| 1 | `curation/` | Content curation |
| 2 | `adas/` | Design discovery pipeline |
| 2 | `notion/` | Design sync (Epic 2) |
| 3 | `policy/` | Policy enforcement |
| 3 | `budget/` | Resource budgeting |
| 3 | `termination/` | Safe termination |
| 3 | `ralph/` | Self-correction loops |
| 3 | `adr/` | Decision records |
| 3 | `circuit-breaker/` | Failure protection |
| 4 | `import/` | ETL pipeline |
| 4 | `dedup/` | Entity deduplication |
| 4 | `lifecycle/` | State management |
| 4 | `sync/` | Notion mirroring |
