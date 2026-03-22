# Project Brief: Unified AI Knowledge System (memory)

## Overview

The `memory` project is building a **Unified AI Engineering Brain** - a goal-directed, closed-loop control system that persists state across multiple projects. Unlike standard RAG systems, this system separates noisy events from promoted knowledge, enables dual-context queries, maintains audit-ready decision trails, and implements entity deduplication.

## Goals

### Primary Goal
Enable AI engineering teams to capture, isolate, and retrieve durable project memory across raw traces, semantic knowledge, and shared/global context without starting from zero.

### Key Objectives

1. **Persistent Knowledge Capture** (Epic 1)
   - Record all workflow events and execution outputs in PostgreSQL (append-only raw traces)
   - Store versioned semantic insights in Neo4j with full lineage
   - Link promoted knowledge back to raw evidence for audit reconstruction

2. **ADAS Discovery & Promotion** (Epic 2)
   - Automate the search for higher-performing agentic architectures
   - Evaluate candidate designs against objective metrics (accuracy, cost, latency)
   - Promote successful designs to permanent knowledge registry after human approval

3. **Governed Runtime & Policy Enforcement** (Epic 3)
   - Mediate all tool calls through a policy gateway
   - Implement Human-in-the-Loop (HITL) approval for high-risk operations
   - Record Agent Decision Records (ADRs) with 5-layer auditability

4. **Knowledge Lifting & Curation** (Epic 4)
   - Orchestrate data flows from PostgreSQL traces to Neo4j semantic graph
   - Deduplicate entities using embedding similarity and word-distance matching
   - Manage insight lifecycle (active → deprecated → expired)

## Target Users

- **AI Engineering Teams**: Building and managing intelligent agents
- **Platform Owners**: Ensuring security, compliance, and tenant isolation
- **Compliance Officers**: Requiring SOC 2, GDPR, ISO 27001 audit trails

## Scope

### In Scope
- 4-Layer Knowledge Stack: AI Reasoning → Raw Trace (PostgreSQL) → Promoted Knowledge (Neo4j) → Human Workspace (Notion)
- Steel Frame versioning with immutable Insights and SUPERSEDES relationships
- Multi-tenant isolation via `group_id`
- HITL governance layer with Mission Control approval flows
- ADR 5-Layer Framework for audit compliance

### Out of Scope (For Now)
- Circuit breakers and automatic budget termination (HITL escalation instead)
- Advanced governance automation (automated decay scheduling)
- Multi-cluster Neo4j deployment
- Notion UI implementation (schema only)

## Timeline

**Current Sprint**: Epic 1, Story 1.1 - Record Raw Execution Traces

**Epic Status**:
- Epic 1: In Progress (Story 1.1 ready-for-dev)
- Epic 2: Backlog
- Epic 3: Backlog  
- Epic 4: Backlog

## Success Metrics

1. **Audit Reconstruction**: All decisions reconstructible 6-12 months later
2. **Tenant Isolation**: Zero cross-project contamination
3. **Knowledge Promotion**: Insights promoted only after human approval
4. **Entity Integrity**: No duplicate nodes in knowledge graph