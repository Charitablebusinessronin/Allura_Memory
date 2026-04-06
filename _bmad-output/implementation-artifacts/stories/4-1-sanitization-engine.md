# Story 4.1: Sanitization Engine

Status: done

## Story

As a **platform curator**,
I want **a sanitization engine to remove tenant-specific data**,
so that **knowledge can be shared across organizations without leaking sensitive information**.

## Acceptance Criteria

1. [x] Remove tenant identifiers - Strip group_id, workspace names, internal IDs
2. [x] Anonymize sensitive data - Hash PII, generalize specific values
3. [x] Create abstracted patterns - Generalize domain-specific terms
4. [x] Validate sanitization - Verify no tenant data remains

---

## Tasks / Subtasks

- [x] **Task 1: Define Sanitization Rules** (AC: #1)
  - [x] Create `SanitizationRule` type with pattern matching
  - [x] Define PII patterns (email, phone, names, IDs)
  - [x] Define tenant identifier patterns (group_id, workspace)

- [x] **Task 2: Implement Sanitizer Class** (AC: #1, #2)
  - [x] Create `Sanitizer.sanitize(entity, rules)` method
  - [x] Create `Sanitizer.anonymize(data, strategy)` method
  - [x] Create `Sanitizer.abstract(content, patterns)` method

- [x] **Task 3: Add Validation** (AC: #4)
  - [x] Create `SanitizationValidator.validate(content)` method
  - [x] Check for remaining tenant identifiers
  - [x] Return list of violations if any

- [x] **Task 4: Create Platform Library Integration** (AC: #3)
  - [x] Define `SanitizedKnowledge` interface
  - [x] Create sanitization pipeline for promotion
  - [x] Integrate with ApprovalWorkflowManager

---

## Dev Notes

### Architecture Pattern

```typescript
// Sanitization happens BEFORE promotion to platform library
Proposal → Sanitization Engine → SanitizedKnowledge → Platform Library
```

### Sanitization Rules

| Rule Type | Pattern | Replacement |
|-----------|---------|--------------|
| `group_id` | `allura-*` | `platform-shared` |
| `email` | `*@*.*` | `[email-redacted]` |
| `phone` | `\d{3}-\d{3}-\d{4}` | `[phone-redacted]` |
| `name` | Proper nouns | `[name-redacted]` |
| `workspace` | Specific names | Generalized |

### File Structure

```
src/lib/sanitization/
├── types.ts
├── rules.ts
├── sanitizer.ts
├── validator.ts
└── patterns.ts
```

---

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### File List

- src/lib/sanitization/types.ts
- src/lib/sanitization/rules.ts
- src/lib/sanitization/sanitizer.ts
- src/lib/sanitization/validator.ts
- src/lib/sanitization/patterns.ts
- src/lib/sanitization/sanitizer.test.ts