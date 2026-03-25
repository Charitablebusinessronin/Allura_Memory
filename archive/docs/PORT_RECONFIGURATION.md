# Mission Control Port Reconfiguration Guide

## Objective
Move Mission Control from default ports (3000/8000) to custom ports (5420/5002)

## Changes Required

### 1. Mission Control Environment Variables

File: `/home/ronin704/dev/projects/openclaw-mission-control/.env`

```bash
# Change from:
FRONTEND_PORT=3000
BACKEND_PORT=8000

# To:
FRONTEND_PORT=5420
BACKEND_PORT=5002

# Also update BASE_URL
BASE_URL=http://localhost:5002
```

### 2. Restart Mission Control with New Ports

```bash
cd /home/ronin704/dev/projects/openclaw-mission-control
docker compose down
docker compose up -d
```

### 3. Update Ronin Memory docker-compose.yml

File: `/home/ronin704/dev/projects/memory/docker-compose.yml`

Update the `mission-control` service:

```yaml
mission-control:
  image: openclaw-mission-control:latest
  container_name: openclaw-mission-control
  restart: unless-stopped
  environment:
    FRONTEND_PORT: 5420
    BACKEND_PORT: 5002
    POSTGRES_DB: mission_control
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: mission_control_secure_pass_2026
    POSTGRES_PORT: 5432
    POSTGRES_HOST: mission-control-db
    BASE_URL: http://localhost:5002
    CORS_ORIGINS: http://localhost:5420
    DB_AUTO_MIGRATE: "true"
    LOG_LEVEL: INFO
    AUTH_MODE: local
    LOCAL_AUTH_TOKEN: 5KsX6-7qREpWKrxUFpKP9NEFW2RP2ByjVP-xxG0EcsQDzIiqFgFAcfMfMoSfnNUal4E
    NEXT_PUBLIC_API_URL: auto
  ports:
    - "5420:5420"
    - "5002:5002"
  networks:
    - knowledge-network
```

### 4. Verify Port Changes

After restart, verify:

```bash
# Check ports
docker ps | grep openclaw-mission-control

# Should show:
# 0.0.0.0:5420->5420/tcp
# 0.0.0.0:5002->5002/tcp

# Test frontend
curl -s http://localhost:5420 | head -5

# Test API
curl -s http://localhost:5002/healthz
```

### 5. Update CLI Configuration

Update the CLI tool to use new ports:

```python
DEFAULT_FRONTEND_PORT = 5420
DEFAULT_API_PORT = 5002
```

File: `/home/ronin704/dev/projects/memory/cli-mission-control/mc-cli`

### 6. Access URLs After Change

- **Mission Control UI**: http://localhost:5420
- **Mission Control API**: http://localhost:5002
- **API Health Check**: http://localhost:5002/healthz

## Summary

| Service | Old Port | New Port |
|---------|----------|----------|
| Frontend | 3000 | 5420 |
| API | 8000 | 5002 |

## Notes

- Old port 3000 is now free for other uses
- All existing data (boards, agents, etc.) is preserved
- Token remains the same
- Requires docker-compose restart
