# Security Fix: Hardcoded Credentials Removed

## Summary

All hardcoded credentials have been replaced with environment variable references. No passwords or connection strings are hardcoded in the codebase.

## Files Fixed

### Critical Fixes (Scripts)

| File | Issue | Fix |
|------|-------|-----|
| `scripts/migrate-supabase-to-ronin.sh` | Hardcoded connection strings with passwords | Now uses `SUPABASE_PASSWORD`, `POSTGRES_PASSWORD` env vars |
| `scripts/session-init.ts` | Hardcoded `ronin4life`, `Kamina2025*` | Now reads from `POSTGRES_USER`, `POSTGRES_PASSWORD`, `NEO4J_PASSWORD` |
| `scripts/auto-memory.sh` | Hardcoded credentials | Now requires env vars or reads from containers |

### Documentation Fixes

| File | Issue | Fix |
|------|-------|-----|
| `_bmad-output/planning-artifacts/mcp-docker-integration.md` | Hardcoded connection string | Now uses environment variable template |
| `.github/copilot-instructions.md` | Hardcoded password in example | Now uses `$NEO4J_PASSWORD` variable |

## How to Use

### Before Running Scripts

1. **Create `.env.local` file**:
```bash
cp .env.example .env.local
```

2. **Fill in your credentials**:
```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=memory
POSTGRES_USER=ronin4life
POSTGRES_PASSWORD=your-secure-password

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-secure-password
```

3. **Load environment before running scripts**:
```bash
# For bash scripts
source .env.local && ./scripts/auto-memory.sh

# For TypeScript files (uses .env.local automatically)
bun run scripts/session-init.ts
```

### Migration Script

```bash
# Set required variables
export SUPABASE_PASSWORD=your-supabase-password
export POSTGRES_PASSWORD=your-postgres-password

# Then run
./scripts/migrate-supabase-to-ronin.sh
```

## Environment Variables Required

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `POSTGRES_HOST` | localhost | No | PostgreSQL hostname |
| `POSTGRES_PORT` | 5432 | No | PostgreSQL port |
| `POSTGRES_DB` | memory | No | Database name |
| `POSTGRES_USER` | ronin4life | No | Database user |
| `POSTGRES_PASSWORD` | - | **Yes** | Database password |
| `NEO4J_URI` | bolt://localhost:7687 | No | Neo4j connection URI |
| `NEO4J_USER` | neo4j | No | Neo4j username |
| `NEO4J_PASSWORD` | - | **Yes** | Neo4j password |
| `SUPABASE_PASSWORD` | - | For migration only | Supabase password |

## Validation

### Test Configuration Loading
```bash
bun vitest run src/lib/memory/config.test.ts
```

### Verify No Hardcoded Passwords
```bash
# Should return no results
grep -r "Kamina" scripts/ --include="*.ts" --include="*.sh"
grep -r "ronin4life:.*@" scripts/ --include="*.ts" --include="*.sh"
```

### Check Environment Variables
```bash
# Verify env vars are loaded
bun run -e "console.log(process.env.POSTGRES_PASSWORD ? 'SET' : 'NOT SET')"
```

## Security Best Practices

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Use environment variables** - All scripts read from env
3. **Validate on startup** - Scripts fail fast with clear errors
4. **Document in `.env.example`** - Template file has placeholders
5. **No defaults for passwords** - Explicit error if missing

## Remaining Work

- [ ] Add `.env.local` to `.gitignore` (already there)
- [ ] Document required env vars in README
- [ ] Update CI/CD to use secrets
- [ ] Add pre-commit hook to check for hardcoded passwords