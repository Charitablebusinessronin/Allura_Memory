# Ronin Notion Workspace Schema

## Database: Ronin Agents Command Center

**ID:** `f1bb3b77-0658-4545-8acf-b2081fbe8690`  
**Data Source:** `collection://25ba2b95-bf47-4f64-9ce0-7f93065b9414`

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS "collection://25ba2b95-bf47-4f64-9ce0-7f93065b9414" (
	url TEXT UNIQUE,
	createdTime TEXT, -- ISO-8601 datetime string
	"Source Path" TEXT,
	"Module" TEXT, -- one of ["Core", "BMM", "BMB", "CIS", "GDS", "WDS", "External"]
	"Status" TEXT, -- one of ["Active", "Testing", "Planned", "Reference", "Drafting"]
	"Confidence" FLOAT,
	"Platform" TEXT, -- one of ["Claude", "GPT-4", "Gemini", "Ollama", "Custom", "OpenClaw", "OpenCode"]
	"Function" TEXT,
	"Type" TEXT, -- one of ["System", "Role", "Persona", "Technical", "Analysis", "External"]
	"Name" TEXT
)
```

### Property Options

**Module (select):**
- Core (brown)
- BMM (blue) - BMAD Method Agile Suite
- BMB (green)
- CIS (purple) - Creative & Innovation Suite
- GDS (orange) - Game Development Suite
- WDS (pink) - Web Development Suite
- External (gray)

**Platform (select):**
- Claude (blue)
- GPT-4 (purple)
- Gemini (green)
- Ollama (orange)
- Custom (gray)
- OpenClaw (red)
- OpenCode (brown)

**Type (select):**
- System (purple)
- Role (blue)
- Persona (pink)
- Technical (gray)
- Analysis (yellow)
- External (orange)

**Status (select):**
- Active (green)
- Testing (yellow)
- Planned (gray)
- Reference (blue)
- Drafting (orange)

### Views

1. **Default view** (table) - All properties
2. **Gallery (Default)** - Card view with cover images
3. **By Module** (board) - Grouped by Module
4. **By Platform** (board) - Grouped by Platform
5. **High Confidence (≥ 0.9)** (table) - Filtered to confidence >= 0.9

---

## Database: Insights

**ID:** `333b2d8f-0b50-40ba-972a-b6070c5e3743`  
**Data Source:** `collection://9fac87b0-6429-4144-80a4-c34d05bb5d02`

### Purpose
Store curated, approved knowledge patterns with confidence scores.

### Key Fields
- Title (title)
- Content (rich text)
- Confidence (number)
- Related Systems (multi-select)
- Status (select: Approved, Candidate, Deprecated)
- Source Agent (relation)

---

## Database: Agent Learning Log Entries

**ID:** `f3e70bc3-8462-4694-8246-a8c0e48406e8`  
**Data Source:** `collection://8cbfaae6-cee7-4101-b341-f92ae3a039e1`

### Purpose
Track operational learnings and rules from agent execution.

### Key Fields
- Rule (title)
- Applies To (select: Cross-project, diff-driven-saas, etc.)
- Related Systems (multi-select)
- Why It Matters (rich text)
- Status (select: Approved, Candidate, Testing)

---

## Key Pages

### Ronin Command Center
**ID:** `21e09305-dbc4-441f-90db-c90f4fecc93f`

Master directory containing:
- Full agent roster by module
- System stats
- Approved insights summary
- Agent learning log preview

### Ronin's Notion Hub
**ID:** `2661d9be-65b3-81df-8977-e88482d03583`

Master directory and navigation hub.

---

## Relationships

```
Ronin Agents Command Center
    ↓ (references)
Insights (approved patterns from agents)
    ↓ (informs)
Agent Learning Log Entries (operational rules)
```

## Data Flow

1. **Agents execute** → Generate traces (Postgres)
2. **OpenClaw drafts** → Creates candidate insights (Notion)
3. **Sabir approves** → Promotes to approved (Notion + Neo4j)
4. **Neo4j stores** → Approved patterns for retrieval
5. **Notion shows** → Work in progress and registry
