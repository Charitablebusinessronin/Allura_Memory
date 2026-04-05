---
main_config: '{project-root}/_bmad/bmm/config.yaml'
outputFile: '{planning_artifacts}/PROJECT.md'
template_registry: '{project-root}/_bmad/_config/template-registry.yaml'
hive_mind: '{project-root}/.opencode/skills/roninmemory-hive-mind/SKILL.md'
target_section: '2'
---

# PRD Create Workflow

**Goal:** Create comprehensive Requirements Matrix section within PROJECT.md through structured workflow facilitation.

**Your Role:** Product-focused PM facilitator collaborating with an expert peer.

**Updated for Template Standardization:**
- ✅ Uses PROJECT.md (unified document) instead of separate prd.md
- ✅ Appends to Section 2 (Requirements Matrix)
- ✅ Follows template-registry.yaml configuration
- ✅ Auto-hydrates context via hive-mind skill

---

## WORKFLOW ARCHITECTURE

This uses **step-file architecture** for disciplined execution with template compliance.

### Core Principles

- **Micro-file Design**: Each step is a self contained instruction file
- **Just-In-Time Loading**: Only the current step file is in memory
- **Sequential Enforcement**: Sequence must be completed in order
- **State Tracking**: Document progress in output file frontmatter
- **Template Compliance**: Follows templates/PROJECT.template.md §2
- **Memory Integration**: Always query hive-mind before creating

### Step Processing Rules

1. **HIVE MIND FIRST**: Invoke roninmemory-hive-mind at start
2. **READ COMPLETELY**: Always read the entire step file before taking any action
3. **FOLLOW SEQUENCE**: Execute all numbered sections in order, never deviate
4. **TEMPLATE COMPLIANCE**: Follow PROJECT.template.md structure
5. **AI DISCLOSURE**: Include mandatory disclosure block
6. **SAVE STATE**: Update `stepsCompleted` in frontmatter before loading next step

### Critical Rules (NO EXCEPTIONS)

- 🧠 **ALWAYS** invoke hive-mind skill at start
- 🛑 **NEVER** load multiple step files simultaneously
- 📖 **ALWAYS** read entire step file before execution
- 🚫 **NEVER** skip steps or optimize the sequence
- 💾 **ALWAYS** update frontmatter before loading next step
- 📋 **ALWAYS** include AI disclosure block
- 🔍 **ALWAYS** check if PROJECT.md exists before creating

---

## INITIALIZATION SEQUENCE

### Step 0: Hive Mind Connection (MANDATORY)

**Before anything else:**

```bash
/opencode invoke roninmemory-hive-mind
```

**What this loads:**
- ✅ Prior PRD attempts from PostgreSQL
- ✅ Requirements decisions from Neo4j
- ✅ Active context from memory-bank
- ✅ Current blockers and focus

**Continue only after:** "Butter smooth. Full context. Ready to build."

### Step 1: Configuration Loading

Load and read full config from {main_config} and resolve:

- `project_name`, `output_folder`, `planning_artifacts`, `user_name`
- `communication_language`, `document_output_language`, `user_skill_level`
- `date` as system-generated current datetime
- `template_registry` for template compliance

✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the configured `{communication_language}`.
✅ YOU MUST ALWAYS WRITE all artifact and document content in `{document_language}`.

### Step 2: Check for Existing PROJECT.md

**Query:**
```bash
ls -la {planning_artifacts}/PROJECT.md
```

**If EXISTS:**
- Load existing PROJECT.md
- Identify current sections present
- Determine where to append §2 (Requirements Matrix)
- Set mode: "append"

**If NOT EXISTS:**
- Copy from templates/PROJECT.template.md
- Set mode: "create"
- Initialize all 6 sections with placeholders

### Step 3: Route to Create Workflow

"**Create Mode: Creating Requirements Matrix (§2) within PROJECT.md.**"

"**Template Compliance:** Following templates/PROJECT.template.md §2 structure."

Read fully and follow: `./steps-c/step-01-init.md`

---

## TEMPLATE COMPLIANCE

### Section 2: Requirements Matrix Structure

**Must Include:**

```markdown
## 2. Requirements Matrix

### 2.1 Business Requirements

| # | Requirement | Functional Requirements | Status |
|---|-------------|------------------------|--------|
| B1 | [Business goal] | F1–F3 | 🟡 Status |

### 2.2 Functional Requirements

#### Domain: [Name] (F1–FN)

| # | Requirement | Satisfied By | Status |
|---|-------------|--------------|--------|
| <a name="f1"></a>F1 | [Requirement text] | `POST /v1/endpoint` | Status |
```

### AI Disclosure Block (MANDATORY)

```markdown
> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.
```

---

## OUTPUT SPECIFICATION

### File Location

```
{planning_artifacts}/PROJECT.md
```

**NOT:** `{planning_artifacts}/prd.md` (legacy path)

### Section Target

**§2 Requirements Matrix** within unified PROJECT.md

### Frontmatter Tracking

```yaml
---
stepsCompleted: [0, 1, 2, 3]
section: "2"
mode: "append"  # or "create"
template_version: "6.3.0"
hive_mind_connected: true
date: "2026-04-05"
---
```

---

## INTEGRATION WITH BMAD

### Updated Skills

**bmad-create-prd:**
- Old: Creates separate `prd.md`
- New: Appends to `PROJECT.md` §2

**bmad-create-architecture:**
- Appends to `PROJECT.md` §1 (Blueprint) + §3 (Architecture)

**bmad-init:**
- Creates full `PROJECT.md` from template
- Initializes all 6 sections

### Document Hierarchy

1. Notion (Product vision)
2. `_bmad-output/planning-artifacts/PROJECT.md` (Canon) ← **THIS**
3. `_bmad-output/implementation-artifacts/` (Specs)
4. `docs/_archive/` (Historical)
5. `memory-bank/` (Session context)

---

## SUCCESS CRITERIA

- [ ] Hive mind invoked at start
- [ ] PROJECT.md exists or created from template
- [ ] Section 2 (Requirements Matrix) complete
- [ ] All B# requirements mapped to F#
- [ ] All F# have implementation references
- [ ] AI disclosure block present
- [ ] Frontmatter updated with progress
- [ ] Logged to PostgreSQL + Neo4j

---

**Next:** Load `./steps-c/step-01-init.md` after hive mind connection.
