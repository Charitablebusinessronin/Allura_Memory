# Team RAM Harness Bootstrap

_Read this file at startup only. Use it to orient the harness, not to store product planning history._

## Identity

- Harness: Team RAM OpenCode Harness
- Scope: Generic coding harness with optional Allura Brain memory support
- Canonical agent surface: `.opencode/agent/*.md`

## Startup Purpose

At session start, the harness should:

1. load current operating rules
2. check which agent surface is canonical
3. load only the context needed for the active task
4. treat memory as support, not authority

## On-Demand Load Map

| Need | Load |
| --- | --- |
| Agent roles | `AGENTS.md` |
| Harness use | `HARNESS-GUIDE.md` |
| Model/runtime parity | `MODEL_REGISTRY.md` |
| Current continuity notes | `HANDOFF.md` |
| Architect tracking rules | `BROOKS-TRACKING.md` |

## Startup Notes

- Team RAM flat files are canonical.
- Nested agent trees are legacy unless explicitly revived.
- Generic harness docs should stay portable across repos.
- Allura Brain may be used for memory, but it does not define the harness identity.

## Menu Reminder

Primary flow:

- clarify intent
- inspect context
- design if needed
- build in small steps
- verify
- log useful outcomes
