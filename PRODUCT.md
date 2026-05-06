# Product

## Register

product

## Users

Allura Memory serves teams building and operating AI agents that need durable, inspectable memory across sessions. The primary users are agent operators and memory curators who review what the system captured, decide what deserves promotion, and trace every durable claim back to evidence. Secondary users are developers integrating Allura through MCP and self-hosting administrators responsible for keeping PostgreSQL, Neo4j, embeddings, and the HTTP gateway healthy.

These users work in two distinct modes. In the product dashboard they need dense, reliable operational clarity: pending insights, evidence trails, graph relationships, failed promotions, health, audit, and recovery paths. In the consumer memory view they need a simpler mental model: their AI's notebook, searchable memories, plain-English provenance, usage visibility, and safe forgetting with undo.

## Product Purpose

Allura Memory is a governed AI memory layer that makes agent knowledge persistent, inspectable, and accountable. It captures raw events into PostgreSQL, promotes reviewed knowledge into Neo4j, preserves audit history through append-only traces, and exposes memory operations through MCP-native interfaces.

The product exists because AI agents forget, and because ungoverned memory becomes a black box. Allura succeeds when an operator can answer three questions quickly: what does the Brain know, why does it believe that, and who approved it? It should make governance feel like part of the workflow, not a bureaucratic tax.

## Brand Personality

Allura's personality is warm, connected, and exacting. The brand leads with care, but the product earns trust through precision. It should feel human enough to reduce anxiety around memory and technical enough to support serious operational work.

The durable brand promise is "Memory that shows its work." The product voice should be plain, confident, and evidence-first. Use human language for consumer-facing memory concepts, such as "learned," "used," and "forget," while preserving explicit technical language where operators need it, such as evidence, promotion, curator queue, audit, and graph.

## Anti-references

Allura should not feel like a cold enterprise admin console, a generic SaaS analytics dashboard, a hacker terminal, or an academic knowledge graph demo. Avoid surfaces that celebrate complexity for its own sake. Avoid decorative AI tropes, neon cyber aesthetics, frosted glass panels, generic gradient hero treatments, and repeated icon-card grids.

The consumer memory view must not expose developer concepts such as `group_id`, `user_id`, raw event IDs, or ISO timestamps as primary content. The dashboard may be technical, but it must not become obscure. Every dense surface needs clear hierarchy, accessible contrast, and an obvious next action.

## Design Principles

1. Show the chain of custody. Every durable insight should make its evidence, source, status, and promotion path discoverable.
2. Separate the two doors. Consumer memory is simple and personal; enterprise administration is dense and operational. Do not force one surface to serve both at once.
3. Govern without hiding. Approval gates, failures, and superseded knowledge are product features, not edge cases to bury.
4. Make search the natural first move. Memory retrieval is the primary product action, so search deserves visual and interaction priority.
5. Use warmth to support trust, not to soften precision. The product should feel humane, but never vague.

## Accessibility & Inclusion

All product interfaces should target WCAG AA at minimum, with stricter contrast for dashboard text, evidence trails, and operational statuses. Touch targets should be at least 48px where the interface is used on mobile or tablet. Reduced motion must be respected. Color may reinforce meaning, but status and severity cannot depend on color alone.

The dashboard is dark-first because operators inspect dense evidence and status information for extended sessions, often in low-light work contexts. Marketing and public-facing materials are light-first and more spacious. Consumer memory views should reduce cognitive load, use plain English, and distinguish empty states from error states.

## AI-Assisted Documentation

Portions of this file were drafted with AI assistance from repository evidence in `README.md`, `docs/branding`, `docs/design`, `docs/frontend`, and supplied screenshots. It should be reviewed when product positioning or user priorities change.
