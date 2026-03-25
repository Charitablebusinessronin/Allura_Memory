# Draft: Docker Cleanup - Remove Supabase

## Goal (confirmed)
Clean up Docker containers to keep only what's needed for Ronin Memory stack, keeping architecture simple with ONE memory system.

## Requirements (confirmed)
- **KEEP**: Ronin Memory stack (PostgreSQL 5432, Neo4j 7474/7687, Dozzle 8088)
- **KEEP**: Mission Control (Frontend 5420, Backend 5002, Redis, DB 5433)
- **KEEP**: Stirling-PDF (user confirmed)
- **REMOVE**: All Supabase containers (confirmed empty - 0 tables, 0 rows)
- **PRESERVE**: OpenClaw desktop installation (separate, not Docker)

## Technical Decisions
- **Supabase is empty** → No data migration needed
- **Ronin Memory has 10,650 events** → Primary memory system
- **Mission Control setup incomplete** → Gateway/Boards/Agent need manual creation
- **No web dashboard needed** → Notion is the dashboard (confirmed earlier)

## Scope Boundaries
- **INCLUDE**: Stop Supabase services, remove containers, cleanup docker-compose
- **INCLUDE**: Update documentation to reflect single memory system
- **EXCLUDE**: OpenClaw desktop (already installed, separate)
- **EXCLUDE**: Mission Control UI setup (manual task for user)

## Verification State
- ✅ Supabase confirmed empty (checked with `SELECT COUNT(*) FROM all tables`)
- ✅ Ronin Memory PostgreSQL has 10,650 events
- ✅ Neo4j has ADR records
- ✅ Mission Control responding on ports 5420/5002
- ✅ OpenClaw Gateway running on port 3002

## Open Questions
- None - all decisions confirmed