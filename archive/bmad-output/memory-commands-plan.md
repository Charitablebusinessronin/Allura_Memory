# Plan: README Update and Memory Slash Commands

## Overview

This plan covers two related improvements:
1. **Update README.md** to document the new memory system
2. **Add slash commands** for memory operations

---

## Phase 1: README Update

### Current State Analysis

The README currently documents:
- Architecture diagram
- Core concepts (Raw Memory, Semantic Memory, Ralph Loop, ADAS, ADR)
- Quick Start guide
- API Examples
- Test coverage

### Missing Documentation

| Section | Current | Needed |
|---------|---------|--------|
| Memory System | Not documented | Full section on memory skills |
| Slash Commands | Not documented | Command reference table |
| Group IDs | Not documented | Multi-tenant isolation explanation |
| Memory Lifecycle | Not documented | draft → testing → active → deprecated → archived |
| Topic Keys | Not documented | Conventions and examples |

### Proposed README Additions

#### 1. Add "Memory System" Section (after Core Concepts)

```markdown
## Memory System

The memory system provides structured storage and retrieval of knowledge across sessions:

### Memory Types

| Type | Purpose | Example topic_key |
|------|---------|-------------------|
| Insight | Learned knowledge | `roninos.insight.deepseek-cost` |
| Decision | Architectural choices | `roninos.decision.neo4j-storage` |
| Research | Domain findings | `roninos.research.agent-lifecycle` |
| ADR | Decision records | `roninos.adr.001-auth-pattern` |
| Pattern | Code/process patterns | `roninos.pattern.steel-frame` |

### Group Isolation

All memories are isolated by `group_id`:
- `roninos` - Main Roninos framework
- `faith-meats` - Faith Meats e-commerce
- `global` - Shared knowledge

### Memory Lifecycle

```
draft → testing → active → deprecated → archived
           ↓
    promotion (requires approval)
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/memory-store` | Store new memory |
| `/memory-search` | Search memories |
| `/memory-get` | Retrieve specific memory |
| `/memory-promote` | Activate draft memory |
| `/memory-deprecate` | Mark memory deprecated |
```

#### 2. Update API Examples Section

Add memory API examples:

```markdown
### Store a Memory

```typescript
import { storeMemory, buildTopicKey } from '@/lib/memory';

await storeMemory({
  type: 'Insight',
  topic_key: buildTopicKey('INSIGHT', 'deepseek-cost-efficiency', 'roninos'),
  content: 'DeepSeek V3.2 offers 10x cost savings over GPT-4',
  confidence: 0.92,
  group_id: 'roninos',
  tags: ['ai', 'cost', 'models'],
});
```

### Search Memories

```typescript
import { searchMemories } from '@/lib/memory';

const results = await searchMemories({
  query: 'DeepSeek',
  group_id: 'roninos',
  types: ['Insight', 'Research'],
  confidence_min: 0.7,
});
```

### Get Memory with History

```typescript
import { getMemory } from '@/lib/memory';

const memory = await getMemory({
  topic_key: 'roninos.insight.deepseek-cost-efficiency',
  group_id: 'roninos',
  include_history: true,
});
```
```

---

## Phase 2: Slash Commands Implementation

### Command Structure

Create `.opencode/commands/` directory with command files:

```
.opencode/commands/
├── memory-store.md
├── memory-search.md
├── memory-get.md
├── memory-promote.md
└── memory-deprecate.md
```

### Command: /memory-store

**File**: `.opencode/commands/memory-store.md`

```markdown
# /memory-store

Store a new memory (insight, decision, research, pattern) in the knowledge graph.

## Usage

```
/memory-store <type> <topic_key> --content <content> [--confidence <0-1>] [--tags <tag1,tag2>]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| type | yes | Memory type: Insight, Decision, Research, ADR, Pattern |
| topic_key | yes | Unique identifier: `group_id.type.identifier` |
| --content | yes | Memory content (text or file reference) |
| --confidence | no | Confidence score 0.0-1.0 (default: 0.5) |
| --tags | no | Comma-separated tags |
| --supersede | no | Topic key of memory to supersede |

## Examples

```
/memory-store Insight roninos.insight.deepseek-cost
  --content "DeepSeek V3.2 offers 10x cost savings for code generation"
  --confidence 0.92
  --tags ai,cost,models

/memory-store Decision roninos.decision.neo4j-knowledge
  --content "Use Neo4j for all knowledge graph storage"
  --confidence 0.95

/memory-store Research roninos.research.agent-lifecycle
  --content @research/findings.md
  --confidence 0.90
```

## Process

1. Parse arguments and validate type
2. Check for existing memory with same topic_key
3. If supersede flag, create SUPERSEDES relationship
4. Store in Neo4j with PostgreSQL trace
5. Return memory ID and version

## Output

```
✅ Memory Stored Successfully

📌 ID: roninos.insight.deepseek-cost-efficiency
📊 Version: 1
📝 Status: draft
🏷️ Tags: ai, cost, models
🔗 Trace: evt_12345

⚠️ Note: Memory is in 'draft' status.
   Activate for production: /memory-promote roninos.insight.deepseek-cost
```
```

### Command: /memory-search

**File**: `.opencode/commands/memory-search.md`

```markdown
# /memory-search

Search memories in the knowledge graph by content, type, or keywords.

## Usage

```
/memory-search <query> [--group <group_id>] [--type <type>] [--limit <n>]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| query | yes | Search query (supports phrases) |
| --group | no | Group ID (default: from context) |
| --type | no | Filter by type: Insight, Decision, etc. |
| --limit | no | Max results (default: 10) |
| --min-confidence | no | Minimum confidence threshold |
| --global | no | Include global memories (default: true) |

## Examples

```
/memory-search "DeepSeek cost efficiency"
/memory-search "authentication" --type Decision --limit 5
/memory-search "agent lifecycle" --group roninos --min-confidence 0.8
/memory-search '"exact phrase"'
```

## Output

```
🔍 Search: "DeepSeek cost efficiency"
   Group: roninos
   Found: 3 results (45ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 [Insight] DeepSeek Cost Efficiency
   ID: roninos.insight.deepseek-cost
   Confidence: 92% | Status: active
   Tags: ai, cost, models
   
   DeepSeek V3.2 offers 10x cost savings...
   
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 [Research] AI Framework Analysis
   ID: roninos.research.ai-frameworks
   Confidence: 90% | Status: active
   Tags: ai, framework, agents
```
```

### Command: /memory-get

**File**: `.opencode/commands/memory-get.md`

```markdown
# /memory-get

Retrieve a specific memory by topic_key with optional history.

## Usage

```
/memory-get <topic_key> [--history] [--evidence]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| topic_key | yes | Memory identifier |
| --history | no | Show all versions |
| --evidence | no | Show supporting evidence |

## Examples

```
/memory-get roninos.insight.deepseek-cost
/memory-get roninos.decision.neo4j-knowledge --history
/memory-get roninos.research.agent-lifecycle --evidence
```

## Output

```
## Memory: DeepSeek Cost Efficiency

| Property | Value |
|----------|-------|
| **ID** | `roninos.insight.deepseek-cost` |
| **Type** | Insight |
| **Status** | active ✅ |
| **Version** | 1 |
| **Confidence** | 92% |
| **Created** | 2024-03-15T10:00:00Z |

### Content
DeepSeek V3.2 offers 10x cost savings over GPT-4
for code generation tasks.

### Tags
`ai` `cost` `models` `deepseek`
```
```

### Command: /memory-promote

**File**: `.opencode/commands/memory-promote.md`

```markdown
# /memory-promote

Promote a draft memory to active status (requires approval workflow).

## Usage

```
/memory-promote <topic_key> --by <approver> --rationale <text>
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| topic_key | yes | Memory to promote |
| --by | yes | Approver identifier |
| --rationale | yes | Approval rationale |

## Examples

```
/memory-promote roninos.insight.deepseek-cost
  --by ronin704
  --rationale "Validated against production benchmarks"
```

## Output

```
✅ Memory Promoted

📌 ID: roninos.insight.deepseek-cost
📊 Status: active
✅ Approved by: ronin704
📝 Rationale: Validated against production benchmarks

Memory is now active and available for production use.
```
```

### Command: /memory-deprecate

**File**: `.opencode/commands/memory-deprecate.md`

```markdown
# /memory-deprecate

Mark a memory as deprecated (no longer recommended).

## Usage

```
/memory-deprecate <topic_key> --reason <text>
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| topic_key | yes | Memory to deprecate |
| --reason | yes | Deprecation reason |

## Examples

```
/memory-deprecate roninos.insight.old-pattern
  --reason "Replaced by new approach in v2"
```

## Output

```
⚠️ Memory Deprecated

📌 ID: roninos.insight.old-pattern
📊 Status: deprecated
📝 Reason: Replaced by new approach in v2

Memory is marked as deprecated and will not be returned
in default searches. Use --include-deprecated to find.
```
```

---

## Phase 3: Skill File Updates

### Update bmad-memory-store SKILL.md

Add command documentation:

```markdown
## Slash Command

```
/memory-store <type> <topic_key> --content <content> [options]
```

See `.opencode/commands/memory-store.md` for full documentation.
```

### Update bmad-memory-search SKILL.md

Add command documentation:

```markdown
## Slash Command

```
/memory-search <query> [options]
```

See `.opencode/commands/memory-search.md` for full documentation.
```

### Update bmad-memory-get SKILL.md

Add command documentation:

```markdown
## Slash Command

```
/memory-get <topic_key> [options]
```

See `.opencode/commands/memory-get.md` for full documentation.
```

---

## Implementation Checklist

### README Update
- [ ] Add "Memory System" section after "Core Concepts"
- [ ] Add "Group Isolation" subsection
- [ ] Add "Memory Lifecycle" subsection
- [ ] Add "Slash Commands" table
- [ ] Update "API Examples" with memory functions
- [ ] Add `buildTopicKey` and `parseTopicKey` examples

### Slash Commands
- [ ] Create `.opencode/commands/` directory
- [ ] Create `memory-store.md` command file
- [ ] Create `memory-search.md` command file
- [ ] Create `memory-get.md` command file
- [ ] Create `memory-promote.md` command file
- [ ] Create `memory-deprecate.md` command file
- [ ] Update skill manifest with command triggers

### Skill Updates
- [ ] Update `bmad-memory-store/SKILL.md` with slash command reference
- [ ] Update `bmad-memory-search/SKILL.md` with slash command reference
- [ ] Update `bmad-memory-get/SKILL.md` with slash command reference
- [ ] Add `bmad-memory-promote` skill (optional)
- [ ] Add `bmad-memory-deprecate` skill (optional)

### Documentation
- [ ] Update `_bmad/_memory/unified-memory-anchor.md` with commands
- [ ] Create `docs/memory-commands.md` reference (optional)
- [ ] Update `_bmad/_config/skill-manifest.csv` with new skills

---

## Testing Plan

### Command Testing

```bash
# Store a test memory
/memory-store Insight test.validation --content "Test memory" --confidence 0.8

# Search for it
/memory-search "validation" --group test

# Get it
/memory-get test.validation

# Promote it
/memory-promote test.validation --by test-user --rationale "Test promotion"

# Deprecate it
/memory-deprecate test.validation --reason "Test deprecation"
```

### Expected Behavior

1. `/memory-store` creates draft memory, returns ID and version
2. `/memory-search` finds memory by content, returns results with confidence
3. `/memory-get` retrieves full memory content
4. `/memory-promote` changes status from draft to active
5. `/memory-deprecate` changes status from active to deprecated

---

## Order of Operations

1. **README Update** (low risk, high visibility)
   - Add documentation first
   - Test code examples

2. **Command Files** (medium risk)
   - Create `.opencode/commands/` directory
   - Add command documentation files

3. **Skill Updates** (low risk)
   - Add slash command references to existing skills
   - Update skill manifests

4. **New Skills** (optional, future work)
   - Create `bmad-memory-promote` skill
   - Create `bmad-memory-deprecate` skill

---

## Success Criteria

- [ ] README documents all memory operations
- [ ] Slash commands are discoverable via `/help` (if supported)
- [ ] Skills reference slash commands
- [ ] All commands work in `.opencode` environment
- [ ] Memory lifecycle is clear from documentation