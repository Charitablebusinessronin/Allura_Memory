---
name: quickprompt
description: "Global quick prompt skill for rapid goal definition and task planning. Use /quickprompt to instantly define goals, create plans, or generate actionable next steps."
global: true
version: "1.0.0"
author: "roninmemory"
tags: ["planning", "goals", "productivity", "quick-actions"]
---

# QuickPrompt Skill

A global skill for rapid goal definition and planning.

## Overview

**Purpose**: Transform vague ideas into structured goals in seconds
**Use When**: Starting any new task, feature, or initiative
**Output**: Clear goal + requirements + success criteria + definition of done

## Commands

### `/quickprompt` (default)

```bash
/quickprompt "your idea here"
```

**Behavior**: 
- Takes any text input
- Generates structured goal definition
- Outputs in terminal-friendly format
- Ready to copy or execute

**Examples**:
```bash
/quickprompt "Build user auth system"
/quickprompt "Make app faster"
/quickprompt "Improve code review process"
/quickprompt "Add payment integration"
```

## Output Format

```
🎯 GOAL: [clear objective]

📋 REQUIREMENTS:
1. [requirement]
2. [requirement]
3. [requirement]

✅ SUCCESS CRITERIA:
- [measurable metric]
- [measurable metric]
- [measurable metric]

🏁 DONE WHEN:
- [checkpoint]
- [checkpoint]
- [checkpoint]
```

## Rules

1. **Be Concise**: Output should be scannable in <20 seconds
2. **Remove Ambiguity**: No vague terms like "better" without specifics
3. **Prefer Numbers**: Use metrics, percentages, or clear yes/no checks
4. **Action-Ready**: User should know exactly what to do next
5. **Universal**: Works for any domain (code, business, personal, etc.)

## Quick Templates

### Feature Development
```
🎯 GOAL: Implement [feature] with [core functionality]

📋 REQUIREMENTS:
1. [Technical requirement]
2. [UI/UX requirement]
3. [Testing requirement]

✅ SUCCESS CRITERIA:
- Feature works in production
- Tests pass with >X% coverage
- No critical bugs in first week

🏁 DONE WHEN:
- Code merged and deployed
- Documentation updated
- Team demo completed
```

### Performance Improvement
```
🎯 GOAL: [Improve/Reduce] [metric] by [target]

📋 REQUIREMENTS:
1. Baseline measurement established
2. Optimization implemented
3. Results validated under load

✅ SUCCESS CRITERIA:
- [Metric] improved by ≥[target]%
- No regression in other metrics
- Monitoring shows sustained improvement

🏁 DONE WHEN:
- Changes deployed to production
- 7-day monitoring period complete
- Results documented and shared
```

### Process Improvement
```
🎯 GOAL: [Reduce/Improve] [process aspect] to [target state]

📋 REQUIREMENTS:
1. Current state documented
2. New process defined
3. Team trained and onboarded

✅ SUCCESS CRITERIA:
- [Metric] meets target
- Team adoption rate ≥X%
- No increase in error rate

🏁 DONE WHEN:
- Process documented
- Training completed
- 2-week retrospective held
```

## Integration

### With Other Agents
- **MemoryOrchestrator**: `/quickprompt` → delegate to appropriate agent
- **MemoryCurator**: `/quickprompt` → break into tasks
- **MemoryArchitect**: `/quickprompt` → create implementation plan

### With Memory System
```javascript
// Log goal definition as insight
log_event({
  group_id: "roninmemory",
  event_type: "goal_defined",
  agent_id: "quickprompt",
  metadata: { goal_summary, requirements_count }
})
```

## Best Practices

1. **Start Every Task**: Use before coding, writing, planning
2. **Iterate**: If goal is unclear, run again with refined input
3. **Save**: Copy output to project docs or memory system
4. **Review**: Check against definition of done before marking complete

## Examples

**Input**: "Add dark mode"
**Output**:
```
🎯 GOAL: Implement dark mode toggle with system preference detection

📋 REQUIREMENTS:
1. Theme system supports light/dark/auto
2. Toggle accessible from UI
3. CSS variables for all themed elements
4. Persist user preference

✅ SUCCESS CRITERIA:
- Toggle works on all pages
- No visual regressions in either mode
- System preference detected on load
- Preference persists across sessions

🏁 DONE WHEN:
- Code reviewed and merged
- E2E tests added for theme switching
- Documentation updated
- Demo completed for team
```

**Input**: "Improve API performance"
**Output**:
```
🎯 GOAL: Reduce API response time by 50% for critical endpoints

📋 REQUIREMENTS:
1. Measure baseline performance
2. Profile slowest endpoints
3. Implement caching strategy
4. Optimize database queries

✅ SUCCESS CRITERIA:
- P95 response time reduced by ≥50%
- No increase in error rates
- Cache hit rate ≥80%
- Memory usage within acceptable limits

🏁 DONE WHEN:
- Changes deployed and monitored
- 7-day metrics show sustained improvement
- Runbook updated with caching strategy
- Team retro completed
```

## Success Criteria for QuickPrompt

- [ ] Generates output in <5 seconds
- [ ] Output is immediately actionable
- [ ] Works for any domain or task type
- [ ] User can proceed without follow-up questions
- [ ] Integrates seamlessly with other agents

## Version History

- **1.0.0**: Initial release - Goal Architect Agent functionality
