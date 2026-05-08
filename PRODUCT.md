# Product

## Register

product

## Brand Identity

**Brand name:** Allura

**Tagline:** Memory that shows its work.

**Secondary tagline:** Memory is the foundation. Intelligence is the outcome.

**Brand domain:** allurama.ai / allurama.com

**Brand essence:** Warm + Connected. Allura exists at the intersection of memory and technology, designed to help people hold on to what matters and share it with the people who matter most. The brand combines intelligent design with human understanding to create experiences that are simple, meaningful, and lasting.

**Brand promise:** A thoughtful balance of heart, mind, and imagination. That is how we make memory matter.

**Brand belief:** Memories deserve more than storage. They deserve clarity, connection, and care — today and for generations to come.

### Brand Essence Pillars

| Pillar | Color | Description |
|--------|-------|-------------|
| **Memory** | Blue | We honor what matters. We help people preserve the moments, stories, and connections that shape their lives. |
| **Connection** | Orange | We bring people closer. Our solutions make it easy to share, relive, and strengthen the bonds that matter most. |
| **Clarity** | Green | We make complex things simple. Intuitive design and clear experiences create confidence. |
| **Trust** | Charcoal | We protect what people trust us with. Security, reliability, and transparency are at the core of everything we do. |
| **Empowerment** | Gold | We give people the power to hold on, look back, and move forward with the people who matter. |

### Brand Personality

Allura's personality is shaped by a balance of care, creativity, and curiosity — a thoughtful blend of three archetypes:

| Archetype | Weight | Description |
|-----------|--------|-------------|
| **Caregiver** | 50% | We lead with empathy and act with care. We protect what matters and put people first in everything we do. |
| **Creator** | 30% | We build with purpose and design with intention. We turn ideas into simple, intelligent solutions. |
| **Explorer** | 20% | We stay curious and open to what is next. We explore new ideas, challenge the status quo, and keep evolving. |

**Brand attributes:** We CARE (Deeply human) · We CREATE (Purposefully) · We EXPLORE (Fearlessly)

### Brand Values

- **Human First** — We design for people, not technology.
- **Built on Trust** — We protect what matters most.
- **Clarity in Everything** — We make complex things feel simple.
- **Stronger Together** — We believe in connection, community, and impact.
- **Empowering You** — We give people the power to hold on, look back, and move forward.

### Logo System

**Primary Wordmark:** Custom geometric lowercase letterforms spelling "allura." Dark charcoal base with blue and teal accent shapes integrated into the letterforms. Minimum size 32px. Clear space = height of the "ll."

**Lettermark (AL monogram):** Abstract AL monogram representing connection, memory, and clarity. Used as app icon and monogram. Minimum size 24px.

**"Allura Memory" lockup:** Product and campaign variant with a gold bar accent beneath "allura memory" text on dark backgrounds.

**Logo rules:** Do not recolor. Do not stretch. Do not rotate. Do not alter the lockup.

## Users

Allura Memory serves two audiences with one brand. The first audience is consumer: people who want to preserve, connect, and share their memories with the people who matter most. They need a simple mental model — their AI's notebook, searchable memories, plain-English provenance, usage visibility, and safe forgetting with undo. The brand leads with warmth and care for this audience.

The second audience is technical: teams building and operating AI agents that need durable, inspectable memory across sessions. The primary users are agent operators and memory curators who review what the system captured, decide what deserves promotion, and trace every durable claim back to evidence. Secondary users are developers integrating Allura through MCP and self-hosting administrators responsible for keeping PostgreSQL, Neo4j, embeddings, and the HTTP gateway healthy.

These users work in two distinct modes. In the product dashboard they need dense, reliable operational clarity: pending insights, evidence trails, graph relationships, failed promotions, health, audit, and recovery paths. In the consumer memory view they need a simpler mental model.

## Product Purpose

Allura Memory is a governed AI memory layer that makes agent knowledge persistent, inspectable, and accountable. It captures raw events into PostgreSQL, promotes reviewed knowledge into Neo4j, preserves audit history through append-only traces, and exposes memory operations through MCP-native interfaces.

The product exists because AI agents forget, and because ungoverned memory becomes a black box. Allura succeeds when an operator can answer three questions quickly: what does the Brain know, why does it believe that, and who approved it? It should make governance feel like part of the workflow, not a bureaucratic tax.

The broader Allura mission is to give people the power to hold on to what matters and share it with the people who matter most. The AI memory layer is one expression of that mission — the sovereign memory layer for AI, capturing, connecting, and activating context across entire ecosystems.

## Anti-references

Allura should not feel like a cold enterprise admin console, a generic SaaS analytics dashboard, a hacker terminal, or an academic knowledge graph demo. Avoid surfaces that celebrate complexity for its own sake. Avoid decorative AI tropes, neon cyber aesthetics, frosted glass panels, generic gradient hero treatments, and repeated icon-card grids.

The consumer memory view must not expose developer concepts such as `group_id`, `user_id`, raw event IDs, or ISO timestamps as primary content. The dashboard may be technical, but it must not become obscure. Every dense surface needs clear hierarchy, accessible contrast, and an obvious next action.

## Design Principles

1. **Show the chain of custody.** Every durable insight should make its evidence, source, status, and promotion path discoverable.
2. **Separate the two doors.** Consumer memory is simple and personal; enterprise administration is dense and operational. Do not force one surface to serve both at once.
3. **Govern without hiding.** Approval gates, failures, and superseded knowledge are product features, not edge cases to bury.
4. **Make search the natural first move.** Memory retrieval is the primary product action, so search deserves visual and interaction priority.
5. **Use warmth to support trust, not to soften precision.** The product should feel humane, but never vague.
6. **Build from the brand pillars.** Every surface should reflect the five-pillar model: memory (blue), connection (orange), clarity (green), trust (charcoal), and empowerment (gold).

## Design Language

Allura's design language is geometric, warm, and constructed. All brand elements build from circles, rectangles, and organic overlaps. Overlapping transparent forms create depth. The signature motif — an overlapping blue circle, orange circle, and green shape — appears in logos, backgrounds, and decorative elements. Human-centered iconography uses simple line art in colored circles. Rounded corners at 12px radius on containers. Warm and bold in balance: institutional charcoal grounded by approachable accent colors.

## Accessibility & Inclusion

All product interfaces should target WCAG AA at minimum, with stricter contrast for dashboard text, evidence trails, and operational statuses. Touch targets should be at least 48px where the interface is used on mobile or tablet. Reduced motion must be respected. Color may reinforce meaning, but status and severity cannot depend on color alone.

The dashboard is dark-first because operators inspect dense evidence and status information for extended sessions, often in low-light work contexts. Marketing and public-facing materials are light-first and more spacious. Consumer memory views should reduce cognitive load, use plain English, and distinguish empty states from error states.

## AI-Assisted Documentation

Portions of this file were drafted with AI assistance from the Allura Brand Kit (Figma: allura-gpt, Allura — Brand Identity), BRAND-EXTRACTION.md, logo assets, HTML prototypes, and prior PRODUCT.md content. Updated May 2026 to incorporate the brand essence pillars, archetype model, logo system, and dual-mission positioning.
