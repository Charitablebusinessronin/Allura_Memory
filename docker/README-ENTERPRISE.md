# Enterprise Docker Setup

Based on [Next.js Enterprise Boilerplate](https://github.com/blazity/next-enterprise) by Blazity.

## Quick Start

### Standard Deployment

```bash
# Start core services (PostgreSQL, Neo4j, MCP)
docker compose up -d

# Start the Next.js app
bun run dev
```

### Enterprise Deployment (with Observability)

```bash
# Start all services with observability stack
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up -d

# View logs
docker compose logs -f app

# Stop all services
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml down
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx (Reverse Proxy)                     │
│                     Port 80/443 (SSL Termination)               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Allura Memory (Next.js App)                   │
│                         Port 3100                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Memory    │  │   Curator   │  │   Admin     │              │
│  │   Viewer    │  │   Queue     │  │   Dashboard │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     Neo4j       │  │     Redis        │
│   (Traces)      │  │   (Insights)    │  │   (Cache)        │
│   Port 5432     │  │   Port 7687     │  │   Port 6379      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenTelemetry Collector                       │
│                      Port 4318/4319                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │ Prometheus  │ │    Loki     │ │   Grafana   │
        │  (Metrics)  │ │   (Logs)    │ │ (Dashboard) │
        │  Port 9090  │ │  Port 3101  │ │  Port 3001  │
        └─────────────┘ └─────────────┘ └─────────────┘
```

## Services

### Core Services (docker-compose.yml)

| Service | Port | Purpose |
|---------|------|---------|
| `postgres` | 5432 | Raw event traces (append-only) |
| `neo4j` | 7474/7687 | Promoted insights (versioned) |
| `mcp` | - | MCP server for agent connectivity |
| `dozzle` | 8088 | Container log viewer |
| `ruvector` | 5433 | Vector DB with GNN |

### Enterprise Services (docker-compose.enterprise.yml)

| Service | Port | Purpose |
|---------|------|---------|
| `app` | 3100 | Next.js application |
| `nginx` | 80/443 | Reverse proxy, SSL termination |
| `redis` | 6379 | Session & caching |
| `otel-collector` | 4318/4319 | Observability pipeline |
| `prometheus` | 9090 | Metrics backend |
| `grafana` | 3001 | Observability dashboard |
| `loki` | 3101 | Log aggregation |

## Configuration

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Key variables:

```bash
# Core
POSTGRES_PASSWORD=your_secure_password
NEO4J_PASSWORD=your_secure_password
PROMOTION_MODE=soc2

# Enterprise
GRAFANA_PASSWORD=admin
REDIS_PASSWORD=redis
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

### SSL Certificates

Place certificates in `docker/ssl/`:

```
docker/ssl/
├── cert.pem
└── key.pem
```

For development, generate self-signed:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/ssl/key.pem \
  -out docker/ssl/cert.pem \
  -subj "/CN=localhost"
```

## Observability

### Grafana Dashboards

Access Grafana at http://localhost:3001/grafana/

Default credentials:
- User: `admin`
- Password: `admin` (or `$GRAFANA_PASSWORD`)

Pre-configured dashboards:
- **Allura Memory Overview**: Request rate, latency, memory operations, pending proposals

### Prometheus Metrics

Available at http://localhost:9090/prometheus/

Key metrics:
- `allura_http_requests_total` - Total HTTP requests
- `allura_http_request_duration_seconds` - Request latency histogram
- `allura_memory_operations_total` - Memory operations (add, search, get, list, delete)
- `allura_promotion_proposals_total` - Curator queue status

### Log Aggregation

Loki aggregates logs from all services. Query in Grafana:

```
{service="allura-memory"} |= "error"
```

## Health Checks

### Application Health

```bash
# Basic health
curl http://localhost:3100/api/health

# Readiness (dependencies)
curl http://localhost:3100/api/health/ready

# Liveness (process)
curl http://localhost:3100/api/health/live

# Detailed status
curl http://localhost:3100/api/health/detailed
```

### Database Health

```bash
# PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life -d memory

# Neo4j
curl -s http://localhost:7474 | jq .neo4j_version

# Redis
docker exec allura-redis redis-cli -a redis ping
```

## Scaling

### Horizontal Scaling

Add more app instances in `docker-compose.enterprise.yml`:

```yaml
services:
  app:
    deploy:
      replicas: 3
```

Or use Docker Swarm / Kubernetes for production.

### Load Balancing

Nginx is pre-configured for load balancing. Add upstreams:

```nginx
upstream allura_app {
    least_conn;
    server app-1:3100 max_fails=3 fail_timeout=30s;
    server app-2:3100 max_fails=3 fail_timeout=30s;
    server app-3:3100 max_fails=3 fail_timeout=30s;
}
```

## Security

### Non-Root User

The Dockerfile.enterprise creates a non-root user (`nextjs`) for security.

### Rate Limiting

Nginx rate limiting is configured:
- API endpoints: 10 req/s (burst 20)
- General: 30 req/s (burst 50)

### Security Headers

Pre-configured headers:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## Development

### Hot Reload

For development with hot reload:

```bash
# Start databases only
docker compose up -d postgres neo4j redis

# Run Next.js locally with hot reload
bun run dev
```

### Debugging

```bash
# View app logs
docker compose logs -f app

# View all logs
docker compose logs -f

# Container shell
docker exec -it allura-memory-app sh
```

## Production Checklist

- [ ] Change default passwords (`GRAFANA_PASSWORD`, `REDIS_PASSWORD`)
- [ ] Configure SSL certificates
- [ ] Set `NODE_ENV=production`
- [ ] Configure backup volumes
- [ ] Set up log rotation
- [ ] Configure alerting rules in Prometheus
- [ ] Review rate limiting thresholds
- [ ] Enable Redis persistence
- [ ] Configure Neo4j backup

## References

- [Next.js Enterprise Boilerplate](https://github.com/blazity/next-enterprise)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)