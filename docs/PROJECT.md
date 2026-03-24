# Ronin Memory

> Production memory system for AI agents with dual-layer persistence and human-in-the-loop governance.

## The Problem

AI agents start every session from zero. They can't remember past decisions, learn from mistakes, or build institutional knowledge. This wastes compute, repeats errors, and limits agent sophistication.

## The Solution

Built a **6-layer memory architecture** that persists agent knowledge across sessions with production-grade governance:

### Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Raw Memory** | PostgreSQL | Append-only event logs (episodic memory) |
| **Semantic Memory** | Neo4j | Knowledge graph with versioned insights |
| **Control** | TypeScript | Self-correcting execution loops (Ralph) |
| **Discovery** | Sandboxed | Automated agent design evaluation (ADAS) |
| **Governance** | Policy Gateway | HITL approval gates, circuit breakers |
| **Audit** | ADR | 5-layer decision records for compliance |

### Key Features

- **30+ MCP Tools**: Store, search, retrieve, govern memories via Model Context Protocol
- **Versioned Insights**: Steel Frame pattern — immutable versions with SUPERSEDES relationships
- **Human-in-the-Loop**: Critical decisions require approval before activation
- **Multi-Tenant**: group_id isolation prevents cross-project contamination
- **1,854+ Tests**: Strict TypeScript, comprehensive test coverage
- **Dual Database**: PostgreSQL for raw events, Neo4j for semantic queries

### Integration

```typescript
// Store a learned insight
await memory.store({
  type: "Insight",
  topic_key: "auth.jwt-best-practices",
  content: "JWT tokens should expire in 15 minutes for mobile apps",
  group_id: "myproject",
  confidence: 0.92,
  tags: ["security", "mobile"]
});

// Search institutional knowledge
const results = await memory.search({
  query: "authentication patterns for mobile",
  group_id: "myproject",
  limit: 5
});
```

## Technical Highlights

- **MCP Protocol**: Works with Claude Desktop, OpenClaw, and any MCP-compatible agent
- **Type-Safe**: Strict TypeScript with Zod runtime validation
- **Production-Ready**: Docker Compose setup, health checks, circuit breakers
- **Observable**: Comprehensive logging, ADR audit trails, decision lineage

## Impact

- Agents remember context across sessions
- Knowledge accumulates and improves over time
- Decisions are auditable and explainable
- Critical changes require human approval
- Reduces redundant computation and repeated mistakes

## Tech Stack

- **Language**: TypeScript (ES2022, strict mode)
- **Databases**: PostgreSQL 16, Neo4j 5.26 with APOC
- **Protocol**: Model Context Protocol (MCP)
- **Testing**: Vitest (1,854+ tests)
- **Runtime**: Bun/Node.js
- **Infrastructure**: Docker, GitHub Actions CI

## Skills Demonstrated

- System architecture and database design
- API design and protocol implementation
- Production software engineering (testing, CI/CD, observability)
- Type safety and runtime validation
- Multi-service integration
- Governance and compliance thinking

---

**Links**: [GitHub](https://github.com/ronin4life/memory) | [Live Demo](https://memory-demo.ronin.dev) | [Documentation](https://docs.ronin.dev/memory)
