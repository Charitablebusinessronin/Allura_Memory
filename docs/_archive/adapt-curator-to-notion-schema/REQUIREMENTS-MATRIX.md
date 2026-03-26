# Requirements Traceability Matrix: Adapt Curator to Master Knowledge Base Schema

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (Claude).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This matrix traces every Business Requirement and Functional Requirement for the curator-to-Notion schema adaptation. Use it to verify coverage and assess the impact of changes.

---

## Table of Contents

- [1. Business Requirements → Functional Requirements](#1-business-requirements--functional-requirements)
- [2. Functional Requirements Detail](#2-functional-requirements-detail)
  - [Schema Mapping (F1–F4)](#schema-mapping-f1f4)
  - [Payload Building (F5–F8)](#payload-building-f5f8)
  - [Client Updates (F9–F12)](#client-updates-f9f12)
- [3. Use Case Index](#3-use-case-index)

---

## 1. Business Requirements → Functional Requirements

| ID | Business Requirement | Functional Requirements | Use Cases |
|----|----------------------|------------------------|-----------|
| B1 | Curator must successfully create pages in the correct Notion database (Master Knowledge Base) | [F11](#f11), [F9](#f9), [F10](#f10) | CPN-UC1 |
| B2 | Curator payloads must align with actual Notion database schema | [F1](#f1), [F2](#f2), [F3](#f3), [F4](#f4), [F5](#f5), [F6](#f6), [F7](#f7), [F8](#f8), [F12](#f12) | CPN-UC1, CPN-UC2 |
| B3 | Property mappings must be centralized and maintainable | [F1](#f1) | CPN-UC2 |
| B4 | Existing curator functionality must continue working after schema adaptation | [F9](#f9), [F10](#f10), [F11](#f11) | CPN-UC3 |

---

## 2. Functional Requirements Detail

### Schema Mapping (F1–F4)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f1"></a>F1 | Create a property mapping module that defines all curator domain to Notion property mappings | `src/curator/notion-property-mapper.ts` · [BLUEPRINT.md](BLUEPRINT.md) §5 `PROPERTY_MAPPINGS` |
| <a name="f2"></a>F2 | Map curator `title` → Notion `Name` (title property) | `MASTER_KB_PROPERTIES.NAME` · `PROPERTY_MAPPINGS` entry |
| <a name="f3"></a>F3 | Map curator `sourceProject` → Notion `Source` (rich_text property) | `MASTER_KB_PROPERTIES.SOURCE` · `PROPERTY_MAPPINGS` entry |
| <a name="f4"></a>F4 | Map curator `canonicalTag` → Notion `Category` (select property) with display tag transformation | `MASTER_KB_PROPERTIES.CATEGORY` · `PROPERTY_MAPPINGS` entry with `canonicalToDisplay` transform |

### Payload Building (F5–F8)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f5"></a>F5 | Map curator `displayTags` → Notion `Tags` (multi_select property) | `MASTER_KB_PROPERTIES.TAGS` · `PROPERTY_MAPPINGS` entry |
| <a name="f6"></a>F6 | Map curator `aiAccessible` → Notion `AI Accessible` (checkbox property) | `MASTER_KB_PROPERTIES.AI_ACCESSIBLE` · `PROPERTY_MAPPINGS` entry |
| <a name="f7"></a>F7 | Map curator `status` → Notion `Content Type` (select property) via transformation | `MASTER_KB_PROPERTIES.CONTENT_TYPE` · `STATUS_TO_CONTENT_TYPE` mapping |
| <a name="f8"></a>F8 | Build complete Notion API payload with all mapped properties | `buildMasterKBPayload()` function · [BLUEPRINT.md](BLUEPRINT.md) §6 |

### Client Updates (F9–F12)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f9"></a>F9 | Update `promotion-orchestrator.ts` to use property mapper for payload construction | Import and call `buildMasterKBPayload()` · [BLUEPRINT.md](BLUEPRINT.md) §3 |
| <a name="f10"></a>F10 | Update `direct-notion-client.ts` to use mapped property names for reading existing pages | Use `MASTER_KB_PROPERTIES` in `mapInsightRow()` · [BLUEPRINT.md](BLUEPRINT.md) §3 |
| <a name="f11"></a>F11 | Update `config.ts` to reference correct Master Knowledge Base database ID | Update `INSIGHTS_DATABASE_ID` default · [DATA-DICTIONARY.md](DATA-DICTIONARY.md) §Environment Variables |
| <a name="f12"></a>F12 | Skip properties that don't exist in Master KB without error | Filter by `exists` flag in `PROPERTY_MAPPINGS` · `getSupportedProperties()` |

---

## 3. Use Case Index

### Curator Promotion Use Cases

| ID | Name | Design Doc | Requirements |
|----|------|------------|--------------|
| CPN-UC1 | Promote insight to Master Knowledge Base | [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) §3.1 | F1, F2, F3, F4, F5, F6, F7, F8, F9, F11 |
| CPN-UC2 | Query existing insights by category | [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) §3.2 | F1, F10 |
| CPN-UC3 | Update insight approval status | [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) §3.1 | F9, F10 |

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — Core design
- [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) — System topology
- [DATA-DICTIONARY.md](DATA-DICTIONARY.md) — Field definitions
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) — Risks and decisions
- [TASKS.md](TASKS.md) — Implementation tasks
