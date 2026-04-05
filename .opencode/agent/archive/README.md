# Archived Agents

This directory contains agent definitions that have been **archived** (superseded or deprecated).

## Archive Policy

Following the **Steel Frame Versioning** pattern:
- Nothing is deleted, only archived
- Archived agents are marked as `deprecated` in Notion
- New versions supersede old ones via `SUPERSEDES` relationships

## Archived Agents

### MemoryCopywriter.md
- **Archived**: 2026-04-05
- **Reason**: Functionality merged into `memory-chronicler`
- **Superseded By**: `memory-chronicler`
- **Use For**: Marketing copy, content generation tasks

### MemoryRepoManager.md
- **Archived**: 2026-04-05
- **Reason**: Functionality merged into `memory-orchestrator`
- **Superseded By**: `memory-orchestrator`
- **Use For**: Repository maintenance, workspace management

### MemoryScribe.md
- **Archived**: 2026-04-05
- **Reason**: Functionality merged into `memory-chronicler`
- **Superseded By**: `memory-chronicler`
- **Use For**: Documentation, technical writing

## Active Agent Equivalents

| Archived Agent | Active Equivalent | Notes |
|----------------|-------------------|-------|
| MemoryCopywriter | memory-chronicler | Use for all content tasks |
| MemoryRepoManager | memory-orchestrator | Use for workspace/repo management |
| MemoryScribe | memory-chronicler | Use for documentation tasks |

## Restoration

To restore an archived agent:
1. Move file from `archive/` to `core/`
2. Add entry to `opencode.json`
3. Create entry in Notion Agents Registry
4. Mark as `Active` (not `Deprecated`)
5. Create `SUPERSEDES` relationship if replacing another agent

## References

- [Agents Registry](https://www.notion.so/17f532949e294a55934a86e13973627f)
- [Steel Frame Versioning](../../memory-bank/systemPatterns.md)
