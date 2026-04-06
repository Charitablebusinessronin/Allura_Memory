# Dispatch Protocol — Quick Reference

## When to Dispatch

| Signal | Agent | Approval Required? |
|--------|-------|-------------------|
| "I need to find context" | MemoryScout | ❌ **EXEMPT** |
| "This needs architectural design" | MemoryArchitect | ✅ Yes |
| "4+ files need modification" | MemoryBuilder | ✅ Yes |
| "This needs validation/review" | MemoryGuardian | ✅ Yes |
| "This needs documentation" | MemoryChronicler | ✅ Yes |
| "I need system metrics" | MemoryAnalyst | ✅ Yes |

## Dispatch Sequence

```
ALWAYS: MemoryScout → discovers context (exempt)
THEN:   MemoryArchitect → designs (needs approval)
THEN:   MemoryOrchestrator → approves design
THEN:   MemoryBuilder → implements (logs)
THEN:   MemoryGuardian → validates (stop if fail)
THEN:   MemoryChronicler → documents (logs)
```

## How to Dispatch

### Via Task Tool
```javascript
task({
  subagent_type: "MemoryGuardian",
  description: "Review code for X",
  prompt: "Review this implementation..."
})
```

### Via Menu Command (User)
```
/memory:scout     — Discovery
/memory:architect — Architecture design
/memory:build     — Implementation
/memory:guardian  — Validation
/memory:chronicler — Documentation
/memory:analyst   — Metrics
```

## Agent Files Reference

| Agent | File Location |
|-------|--------------|
| MemoryOrchestrator | `.opencode/agent/core/openagent.md` |
| MemoryArchitect | `.opencode/agent/MemoryArchitect.md` |
| MemoryBuilder | `.opencode/agent/MemoryBuilder.md` |
| MemoryGuardian | `.opencode/agent/subagents/code/reviewer.md` |
| MemoryScout | `.opencode/agent/subagents/core/contextscout.md` |
| MemoryAnalyst | `.opencode/agent/MemoryAnalyst.md` |
| MemoryChronicler | `.opencode/agent/subagents/core/documentation.md` |

## Anti-Patterns

❌ **DON'T:**
- Dispatch without explicit need (coordination overhead)
- Skip MemoryScout discovery phase
- Build before architect designs
- Validate before builder implements
- Dispatch to multiple agents in parallel when sequential needed

✅ **DO:**
- Run MemoryScout first (always, exempt from approval)
- Get design approval before implementation
- Log every dispatch to PostgreSQL
- Wait for validation before declaring done
- Document decisions after completion

## Logging Template

```sql
-- Dispatch
INSERT INTO events (event_type, group_id, agent_id, status, metadata)
VALUES ('AGENT_DISPATCHED', 'allura-system', 'memory-orchestrator', 
        'running', '{"dispatched_to": "?", "task": "?", "reason": "?"}');

-- Completion
INSERT INTO events (event_type, group_id, agent_id, status, metadata)
VALUES ('AGENT_COMPLETE', 'allura-system', '?', 
        'completed', '{"outcome": "?", "files_modified": ?}');
```

## Full Documentation

- **Complete mapping:** `.opencode/agent/agent-mapping.yaml`
- **MemoryOrchestrator prompt:** `.opencode/agent/core/openagent.md`
- **Menu commands:** `.opencode/agent/menu.yaml`
- **Agent registry:** `.opencode/agent/README.md`