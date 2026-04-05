---
description: "Rewrite any text into clear Goal and Done format. Instant clarity."
argument-hint: "[text to rewrite or 'clipboard']"
allowed-tools: ["read", "write", "edit"]
global: false
---

# QuickRewrite Command

Turn messy text into clear goals instantly.

## Usage

```bash
/quickrewrite "your messy text here"
/quickrewrite clipboard      # Uses clipboard content
/quickrewrite                # Interactive: paste when prompted
```

## How It Works

1. **Receive** your text (messy, unclear, scattered)
2. **Extract** the core intent
3. **Rewrite** into Goal + Done format
4. **Output** clean, actionable structure

## Output Format

```
🎯 GOAL:
[clear objective in one sentence]

📋 REQUIREMENTS:
1. [what must be true]
2. [what must be true]
3. [what must be true]

🏁 DONE WHEN:
- [specific checkpoint]
- [specific checkpoint]
- [specific checkpoint]
```

## Examples

### Example 1: Messy Request

**Input:**
```
/quickrewrite "we need to like fix the login thing because users are 
complaining and also maybe add some better error messages and 
security stuff"
```

**Output:**
```
🎯 GOAL:
Fix user login issues and improve security messaging

📋 REQUIREMENTS:
1. Resolve current login failures
2. Improve error message clarity
3. Add security context to error states

🏁 DONE WHEN:
- Login success rate > 99%
- Error messages reviewed and approved
- Security audit passes
```

### Example 2: Vague Task

**Input:**
```
/quickrewrite "make the dashboard better"
```

**Output:**
```
🎯 GOAL:
Improve dashboard UX and performance

📋 REQUIREMENTS:
1. Identify current dashboard pain points
2. Implement 3 highest-impact improvements
3. Validate with user feedback

🏁 DONE WHEN:
- Dashboard loads in <2 seconds
- User satisfaction score improves 20%
- All changes deployed and monitored
```

### Example 3: Technical Debt

**Input:**
```
/quickrewrite "clean up that api code, it's getting messy"
```

**Output:**
```
🎯 GOAL:
Refactor API layer for maintainability

📋 REQUIREMENTS:
1. Extract business logic from controllers
2. Standardize error handling
3. Add comprehensive test coverage

🏁 DONE WHEN:
- All API routes have unit tests
- Code review approved
- Zero regression in existing functionality
```

## Rules

1. **Be concise** - One sentence goals, 3-5 requirements
2. **Remove ambiguity** - No vague words like "better" or "improve"
3. **Prefer measurable** - Specific numbers or clear pass/fail criteria
4. **Actionable** - Every item must be doable

## When to Use

✅ Meeting notes need structure
✅ Slack messages are unclear
✅ Requirements scattered
✅ Starting new work from vague description
✅ Clarifying stakeholder requests

## When NOT to Use

❌ Already have clear spec
❌ Debugging code
❌ Complex multi-phase projects (use full planning instead)

---

**Speed**: Results in <3 seconds
**Format**: Copy-ready for docs, tickets, or delegation
**Goal**: Remove friction from turning chaos into clarity
