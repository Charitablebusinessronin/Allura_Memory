# Document Structure Validator

> Validates the Allura 6-document structure and prevents drift

## Purpose

This skill ensures the Allura documentation maintains exactly 6 core documents:
1. BLUEPRINT.md
2. DATA-DICTIONARY.md
3. RISKS-AND-DECISIONS.md
4. SOLUTION-ARCHITECTURE.md
5. DESIGN-ALLURA.md
6. REQUIREMENTS-MATRIX.md

## Usage

### Validate Structure

```
skill doc-structure-validator validate
```

Checks that all 6 core documents exist in docs/allura/ and reports any drift.

### Check Document Links

```
skill doc-structure-validator check-links
```

Verifies that all inter-document links are valid.

## Validation Rules

1. **Core 6 Required**: All 6 documents must exist
2. **No Extra Core Docs**: No additional *.md files in docs/allura/ beyond the core 6
3. **Archive Reference**: Original documents archived in docs/archive/
4. **Links Valid**: All internal links must resolve to existing documents

## Integration Points

- Reads from: docs/allura/
- Reads from: docs/archive/
- Logs results: events table with event_type 'doc_validation'

## Output Format

```
✓ BLUEPRINT.md exists
✓ DATA-DICTIONARY.md exists
✓ RISKS-AND-DECISIONS.md exists
✓ SOLUTION-ARCHITECTURE.md exists
✓ DESIGN-ALLURA.md exists
✓ REQUIREMENTS-MATRIX.md exists

Structure: VALID
Drift detected: None
```
