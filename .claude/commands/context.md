---
description: "Context manager — harvest summaries, scan workspace, and organize knowledge into memory-bank"
allowed-tools: ["Read", "Write", "Edit", "Glob", "Bash"]
---

# Context Manager

**Usage:** `/context [operation] [args]`

Arguments: `$ARGUMENTS`

---

## Default (No Arguments) — Quick Scan

Scan workspace for floating context files:
- `*OVERVIEW.md`, `*SUMMARY.md`, `SESSION-*.md`, `CONTEXT-*.md`
- Files in `.tmp/` directory
- Files > 2KB in root directory

Report what was found and suggest: `/context harvest` to clean up.

---

## Operations

### `/context harvest [path]`
Extract knowledge from AI summaries → compact into `memory-bank/`. Archive or delete the source files (show approval prompt before deleting).

Files written must be under 200 lines. Use MVI (Minimal Viable Information):
- Core concept: 1–3 sentences
- Key points: 3–5 bullets  
- Minimal example: <10 lines

### `/context extract from <source>`
Extract context from a doc, code file, or URL. Compact and save to appropriate `memory-bank/` file.

### `/context organize`
Restructure `memory-bank/` files. Ensure they follow function-based structure:
- `activeContext.md` — current focus
- `progress.md` — what's done
- `systemPatterns.md` — architecture decisions
- `techContext.md` — stack details
- `projectbrief.md` — scope and goals

### `/context validate`
Check all `memory-bank/` files:
- Size (flag files > 200 lines)
- Cross-references are valid
- No stale information contradicting current code state

### `/context map`
Show current memory-bank structure with file sizes and last-modified dates.

---

## Rules

- Never auto-delete. Always show an approval prompt for destructive operations.
- Keep files under 200 lines (MVI principle).
- Load existing `memory-bank/` files before writing to them.
- Tier 1 (safety): file size, approval gate, MVI format — always overrides other concerns.
