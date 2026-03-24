# AI Guidelines Documentation Skill Creation

## TL;DR

> **Quick Summary**: Create a skill that helps generate and maintain the 6 required AI documentation artifacts (BLUEPRINT, SOLUTION-ARCHITECTURE, DESIGN, REQUIREMENTS-MATRIX, RISKS-AND-DECISIONS, DATA-DICTIONARY) with proper AI disclosure notices and cross-referencing.

> **Deliverables**:
> - Skill: `ai-guidelines-docs` with SKILL.md, assets/, references/
> - 6 document templates in assets/
> - 4 reference guides
> - Packaged zip for distribution

> **Estimated Effort**: Short
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Initialize skill → Copy templates → Write SKILL.md → Package

---

## Context

### Original Request
User wants to create a skill from the AI Guidelines documentation standards at `/home/ronin704/Downloads/guidelines(2)/guidelines/`.

### Interview Summary
**Key Discussions**:
- User provided full guidelines with 6 required documentation artifacts
- Templates exist at `guidelines/templates/`
- Skill should follow skill-creator framework (assets/, references/, SKILL.md)
- Each document requires AI disclosure notice

**Research Findings**:
- Guidelines specify strict source of truth hierarchy
- Required Mermaid diagrams per document type
- 10+ item verification checklist before merging
- AI must NOT decide alone on concurrency/security/naming

---

## Work Objectives

### Core Objective
Create `ai-guidelines-docs` skill that enables proper documentation generation following the AI Guidelines standards.

### Concrete Deliverables
- Skill directory at `~/.claude/skills/davepoon-buildwithclaude-skill-creator/ai-guidelines-docs/`
- SKILL.md with usage instructions
- 6 document templates in assets/
- 4 reference guides in references/
- Packaged zip file

### Definition of Done
- [ ] Skill initializes successfully
- [ ] All 6 templates copied to assets/
- [ ] All 4 references created
- [ ] SKILL.md complete with instructions
- [ ] Package validation passes

### Must Have
- AI disclosure notice in SKILL.md
- Proper cross-reference guidance
- Mermaid diagram examples
- Verification checklist

### Must NOT Have
- No modifications to existing guidelines files
- No code generation (skill is documentation-only)
- No generic placeholders in final SKILL.md

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (skill-creator framework)
- **Automated tests**: NO (documentation skill)
- **Framework**: N/A

### QA Policy
Every task includes agent-executed QA scenarios:
- Verify file structure matches skill-creator requirements
- Validate SKILL.md frontmatter
- Check all template files are valid Markdown
- Verify reference files are complete

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 4 tasks in parallel):
├── Task 1: Initialize skill directory
├── Task 2: Copy 6 document templates to assets/
├── Task 3: Create AI disclosure notice reference
└── Task 4: Create cross-reference guide reference

Wave 2 (References - 4 tasks in parallel):
├── Task 5: Create verification checklist reference
├── Task 6: Create Mermaid diagram examples reference
├── Task 7: Create initiation state placeholder
└── Task 8: Clean up example files

Wave 3 (SKILL.md - 1 task):
├── Task 9: Write complete SKILL.md

Wave FINAL (Validation - 2 tasks):
├── Task F1: Validate skill structure
└── Task F2: Package skill
```

### Dependency Matrix

- **1**: — — 9
- **2**: — — 9
- **3**: — — 9
- **4**: — — 9
- **5**: — — 9
- **6**: — — 9
- **7**: — — 9
- **8**: 7 — 9
- **9**: 1, 2, 3, 4, 5, 6, 8 — F1, F2
- **F1**: 9 — F2
- **F2**: F1 —

### Agent Dispatch Summary

- **1**: **4** — T1 → `quick`, T2 → `quick`, T3 → `quick`, T4 → `quick`
- **2**: **4** — T5 → `quick`, T6 → `quick`, T7 → `quick`, T8 → `quick`
- **3**: **1** — T9 → `writing`
- **FINAL**: **2** — F1 → `quick`, F2 → `quick`

---

## TODOs

- [ ] 1. Initialize skill directory

  **What to do**:
  - Run `init_skill.py ai-guidelines-docs --path ~/.claude/skills/davepoon-buildwithclaude-skill-creator/`
  - Verify directory structure created: SKILL.md, scripts/, references/, assets/

  **Must NOT do**:
  - Don't modify any existing files
  - Don't create extra directories beyond standard structure

  **Recommended Agent Profile**:
  > - **Category**: `quick`
    - Reason: Simple directory initialization, no complex logic
  > - **Skills**: []
    - No specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Task 9 (SKILL.md needs structure)
  - **Blocked By**: None

  **References**:
  - `scripts/init_skill.py` - Initialization script with usage

  **Acceptance Criteria**:
  - [ ] Directory exists at correct path
  - [ ] SKILL.md template created
  - [ ] scripts/, references/, assets/ directories exist

  **QA Scenarios**:

  \`\`\`
  Scenario: Skill directory initialization
    Tool: Bash
    Preconditions: Clean state, no existing ai-guidelines-docs
    Steps:
      1. Run init_skill.py with correct path and name
      2. List directory contents
      3. Verify expected structure exists
    Expected Result: Directory with SKILL.md, scripts/, references/, assets/
    Evidence: .sisyphus/evidence/task-1-init.md
  \`\`\`

  **Commit**: NO

---

- [ ] 2. Copy document templates to assets/

  **What to do**:
  - Copy 6 templates from `/home/ronin704/Downloads/guidelines(2)/guidelines/templates/` to `assets/`
    - BLUEPRINT.template.md
    - SOLUTION-ARCHITECTURE.template.md
    - DESIGN.template.md
    - REQUIREMENTS-MATRIX.template.md
    - RISKS-AND-DECISIONS.template.md
    - DATA-DICTIONARY.template.md
  - Remove example_asset.txt if it exists

  **Must NOT do**:
  - Don't modify template contents
  - Don't add extra templates

  **Recommended Agent Profile**:
  > - **Category**: `quick`
    - Reason: File copy operations, no complex logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - Source templates at `guidelines/templates/`
  - Target: `assets/`

  **Acceptance Criteria**:
  - [ ] All 6 templates exist in assets/
  - [ ] No duplicate or extra files
  - [ ] example_asset.txt removed

  **QA Scenarios**:

  \`\`\`
  Scenario: Verify all 6 templates copied
    Tool: Bash
    Preconditions: Skill directory initialized
    Steps:
      1. List assets/ directory
      2. Count .md template files
      3. Verify expected templates present
    Expected Result: Exactly 6 template files
    Evidence: .sisyphus/evidence/task-2-templates.md
  \`\`\`

  **Commit**: NO

---

- [ ] 3. Create AI disclosure notice reference

  **What to do**:
  - Create `references/ai-disclosure-notice.md`
  - Include standard AI disclosure notice block
  - Document when to remove notice
  - Add best practices

  **Must NOT do**:
  - Don't deviate from standard notice text
  - Don't make it optional - it's required

  **Recommended Agent Profile**:
  > - **Category**: `writing`
    - Reason: Creating reference documentation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - Source: AI-GUIDELINES.md §3 AI-Assisted Documentation Policy

  **Acceptance Criteria**:
  - [ ] Standard notice block included verbatim
  - [ ] When-to-remove section complete
  - [ ] Best practices section added

  **QA Scenarios**:

  \`\`\`
  Scenario: AI disclosure notice content
    Tool: Bash
    Preconditions: Reference file created
    Steps:
      1. Read reference file
      2. Verify notice block matches standard
      3. Check when-to-remove section exists
    Expected Result: File matches AI-GUIDELINES.md specification
    Evidence: .sisyphus/evidence/task-3-disclosure.md
  \`\`\`

  **Commit**: NO

---

- [ ] 4. Create cross-reference guide reference

  **What to do**:
  - Create `references/cross-reference-guide.md`
  - Document required links per document type
  - Include link syntax examples
  - Document anchor naming conventions
  - Include source of truth hierarchy table

  **Must NOT do**:
  - Don't use bare file names - must use Markdown links
  - Don't skip any required link specification

  **Recommended Agent Profile**:
  > - **Category**: `writing`
    - Reason: Creating reference documentation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - Source: AI-GUIDELINES.md §4 Document Quality Standards - Cross-Referencing

  **Acceptance Criteria**:
  - [ ] Required links table complete
  - [ ] Syntax examples included
  - [ ] Anchor naming conventions defined
  - [ ] Source of truth hierarchy table present

  **QA Scenarios**:

  \`\`\`
  Scenario: Cross-reference guide completeness
    Tool: Bash
    Preconditions: Reference file created
    Steps:
      1. Read reference file
      2. Verify all 6 document types listed
      3. Check link syntax examples present
    Expected Result: All sections from §4 present
    Evidence: .sisyphus/evidence/task-4-crossref.md
  \`\`\`

  **Commit**: NO

---

- [ ] 5. Create verification checklist reference

  **What to do**:
  - Create `references/verification-checklist.md`
  - Include requirements traceability section
  - Include data consistency section
  - Include link validation section
  - Include AI & security section
  - Include final review section

  **Must NOT do**:
  - Don't simplify the checklist items
  - Don't skip any verification items from guidelines

  **Recommended Agent Profile**:
  > - **Category**: `writing`
    - Reason: Creating reference documentation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - Source: AI-GUIDELINES.md §4 Completeness Checklist

  **Acceptance Criteria**:
  - [ ] All checklist items from §4 included
  - [ ] Checkboxes present for each item
  - [ ] Organized by section matching guidelines

  **QA Scenarios**:

  \`\`\`
  Scenario: Verification checklist coverage
    Tool: Bash
    Preconditions: Reference file created
    Steps:
      1. Read reference file
      2. Count checkbox items
      3. Verify against AI-GUIDELINES.md §4
    Expected Result: ≥10 checklist items matching guidelines
    Evidence: .sisyphus/evidence/task-5-checklist.md
  \`\`\`

  **Commit**: NO

---

- [ ] 6. Create Mermaid diagram examples reference

  **What to do**:
  - Create `references/mermaid-diagram-examples.md`
  - Include all 5 supported diagram types
  - Include example code for each type
  - Add best practices section
  - Add common patterns section

  **Must NOT do**:
  - Don't use images - only Mermaid code blocks
  - Don't skip any diagram type

  **Recommended Agent Profile**:
  > - **Category**: `writing`
    - Reason: Creating reference documentation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - Source: AI-GUIDELINES.md §5 Diagrams

  **Acceptance Criteria**:
  - [ ] All 5 diagram types covered
  - [ ] Working Mermaid code examples
  - [ ] Best practices section
  - [ ] Common patterns section

  **QA Scenarios**:

  \`\`\`
  Scenario: Mermaid examples completeness
    Tool: Bash
    Preconditions: Reference file created
    Steps:
      1. Read reference file
      2. Count diagram types covered
      3. Verify each has code example
    Expected Result: 5 diagram types with examples
    Evidence: .sisyphus/evidence/task-6-mermaid.md
  \`\`\`

  **Commit**: NO

---

- [ ] 7. Create initialization state placeholder

  **What to do**:
  - Create `scripts/init.sh` (optional placeholder)
  - Or document initialization state in SKILL.md

  **Must NOT do**:
  - Don't create unnecessary scripts
  - Only create if truly needed

  **Recommended Agent Profile**:
  > - **Category**: `quick`
    - Reason: Simple file creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - Source: skill-creator framework

  **Acceptance Criteria**:
  - [ ] Either init script created OR documented in SKILL.md

  **QA Scenarios**:

  \`\`\`
  Scenario: Initialization documentation
    Tool: Bash
    Preconditions: Skipped or file created
    Steps:
      1. Check if init.sh exists
      2. Or verify SKILL.md has init instructions
    Expected Result: User knows how to initialize
    Evidence: .sisyphus/evidence/task-7-init.md
  \`\`\`

  **Commit**: NO

---

- [ ] 8. Clean up example files

  **What to do**:
  - Remove `scripts/example.py` (example file)
  - Remove `references/api_reference.md` (example file)
  - Remove `assets/example_asset.txt` (already done in T2)
  - Verify no leftover example files

  **Must NOT do**:
  - Don't remove actual needed files
  - Only remove example_* files

  **Recommended Agent Profile**:
  > - **Category**: `quick`
    - Reason: Simple file cleanup

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 9
  - **Blocked By**: Task 7 (needs to check if needed first)

  **References**:
  - Init script created example files

  **Acceptance Criteria**:
  - [ ] All example_* files removed
  - [ ] Only actual skill files remain

  **QA Scenarios**:

  \`\`\`
  Scenario: Example file cleanup
    Tool: Bash
    Preconditions: Files created by init_skill.py
    Steps:
      1. List scripts/, references/, assets/
      2. Check for example_* files
      3. Verify none exist
    Expected Result: Clean directory, no example files
    Evidence: .sisyphus/evidence/task-8-cleanup.md
  \`\`\`

  **Commit**: NO

---

- [ ] 9. Write complete SKILL.md

  **What to do**:
  - Write complete SKILL.md with:
    - YAML frontmatter (name, description)
    - Purpose and usage instructions
    - When to use this skill
    - How to use each template
    - Reference to assets/ templates
    - Reference to references/ guides
    - Cross-reference to other documents
    - Progressive disclosure structure

  **Must NOT do**:
  - Don't leave TODO placeholders
  - Don't use generic descriptions
  - Must be specific to this skill

  **Recommended Agent Profile**:
  > - **Category**: `writing`
    - Reason: Writing comprehensive SKILL.md

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Sequential**: After Wave 1 and Wave 2 complete
  - **Blocks**: Final verification
  - **Blocked By**: Tasks 1, 2, 3, 4, 5, 6, 8

  **References**:
  - Source: AI-GUIDELINES.md (all sections)
  - Template: skill-creator SKILL.md template
  - References: All 4 created reference files
  - Assets: All 6 document templates

  **Acceptance Criteria**:
  - [ ] YAML frontmatter valid
  - [ ] name: ai-guidelines-docs
  - [ ] description: specific to documentation creation
  - [ ] All assets referenced
  - [ ] All references referenced
  - [ ] Usage instructions clear
  - [ ] Progressive disclosure structure

  **QA Scenarios**:

  \`\`\`
  Scenario: SKILL.md completeness
    Tool: Bash
    Preconditions: SKILL.md written
    Steps:
      1. Read SKILL.md
      2. Validate YAML frontmatter
      3. Check all assets referenced
      4. Check all references referenced
      5. Verify usage instructions present
    Expected Result: Complete SKILL.md matching skill-creator requirements
    Evidence: .sisyphus/evidence/task-9-skillmd.md
  \`\`\`

  **Commit**: YES (only task to commit)

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify all 9 tasks addressed the work objectives. Check:
  - All 6 templates in assets/
  - All 4 references in references/
  - SKILL.md complete
  - No leftover example files
  Output: `VERDICT: APPROVE/REJECT`

- [ ] F2. **Skill Validation** — `quick`
  Run package validation script:
  - Validate YAML frontmatter format
  - Check skill naming conventions
  - Verify file organization
  - Check description completeness
  Output: `Validation [PASS/FAIL]`

---

## Commit Strategy

- **1**: NO (Wave 1 cleanup)
- **2**: NO (Wave 2 cleanup)
- **3**: NO (Wave 2 cleanup)
- **4**: NO (Wave 2 cleanup)
- **5**: NO (Wave 2 cleanup)
- **6**: NO (Wave 2 cleanup)
- **7**: NO (Wave 2 cleanup)
- **8**: NO (Wave 2 cleanup)
- **9**: YES
  - Message: `feat(skill): add ai-guidelines-docs skill`
  - Files: `ai-guidelines-docs/SKILL.md`, `ai-guidelines-docs/assets/*.md`, `ai-guidelines-docs/references/*.md`
  - Pre-commit: `python scripts/package_skill.py` (validates first)

---

## Success Criteria

### Verification Commands
```bash
# Check skill structure
ls -la ai-guidelines-docs/

# Validate skill package
python scripts/package_skill.py ai-guidelines-docs/
```

### Final Checklist
- [ ] All 6 templates in assets/
- [ ] All 4 references in references/
- [ ] SKILL.md complete with proper frontmatter
- [ ] No example_* files remaining
- [ ] Package validation passes
