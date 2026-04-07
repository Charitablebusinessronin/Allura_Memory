# OpenCode Reset Log - April 7, 2026

## What Was Reset

### Removed Custom Agents
The following custom agents were removed and backed up:

1. **memory-orchestrator** - Primary orchestrator with Brooksian principles
2. **memory-architect** - Architecture-focused agent for design decisions
3. **memory-builder** - Implementation-focused agent for code construction
4. **memory-guardian** - Code review and security agent
5. **memory-scout** - Context discovery agent
6. **memory-chronicler** - Documentation agent
7. **memory-builder-focus** - Focus mode with elevated permissions
8. **memory-builder-auto** - Fully autonomous mode

### Removed Plugins
1. `@gotgenes/opencode-agent-identity`
2. `superpowers@git+https://github.com/obra/superpowers.git`
3. `./plugin/group-id-enforcer.ts`

### Removed MCP Servers
1. `exa` - Remote MCP server for web search

### Removed Custom Instructions
1. `.opencode/context/project/bmad-integration.md`

### Removed Skills Directories
1. `.opencode/skills`

## Backup Locations

- **Original opencode.json**: `opencode.json.backup-20260407-063858`
- **Original .opencode directory**: `.opencode.backup-20260407-063857`

## Current Configuration

Standard OpenCode configuration with:
- Default agent: `opencode`
- Instructions: `AGENTS.md`, `.github/copilot-instructions.md`
- No custom agents
- No plugins
- No MCP servers
- No skills directories

## Restoration Instructions

To restore your custom configuration:

```bash
# Restore opencode.json
cp opencode.json.backup-20260407-063858 opencode.json

# Restore .opencode directory
mv .opencode.backup-20260407-063857 .opencode
```

## What Remains

Your project still has:
- `AGENTS.md` - Agent instructions for Claude Code
- `.github/copilot-instructions.md` - Copilot instructions
- `CLAUDE.md` - Claude Code instructions
- All source code and memory systems intact
- PostgreSQL and Neo4j configurations unchanged
- BMad workflow files preserved

## Next Steps

If you want to rebuild your OpenCode configuration:

1. **Decide on agent structure** - Do you want custom agents or standard OpenCode?
2. **Choose plugins** - Which plugins do you actually need?
3. **Configure MCP servers** - Which external tools do you want to integrate?
4. **Set up skills** - What specialized workflows do you need?

The backup is preserved. You can restore it anytime or selectively migrate components.