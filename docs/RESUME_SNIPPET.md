## Experience

### Open Source Project: Ronin Memory
**Solo Developer | 2024-Present**

Built production-grade memory system for AI agents with 1,854+ tests.

**Architecture:**
- Dual-layer persistence: PostgreSQL (raw events) + Neo4j (knowledge graph)
- 6-layer cognitive stack with HITL governance and audit trails
- MCP protocol server exposing 30+ tools to AI agents

**Technical Highlights:**
- Strict TypeScript with Zod validation
- Multi-tenant isolation with row-level security
- Versioned insights with immutable history (SUPERCEDES pattern)
- Circuit breakers, policy gateways, and bounded autonomy
- Docker Compose deployment with health checks

**Skills:** System Design, Database Architecture, TypeScript, Graph Databases, CI/CD, Test-Driven Development

---

## Project Highlights

**Ronin Memory** — Memory system for AI agents
- Problem: Agents start every session from zero, wasting compute and repeating errors
- Solution: 6-layer persistence architecture with governance and audit
- Stack: TypeScript, PostgreSQL, Neo4j, MCP protocol, Docker, GitHub Actions
- Tests: 1,854+ passing, strict TypeScript coverage
- Scale: 40+ stories implemented across 6 epics
