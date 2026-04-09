---
description: Smart commit — analyze staged changes and write a conventional commit message
agent: oracle
---

@.opencode/context/core/essential-patterns.md
@.opencode/context/project/project-context.md

Review all staged git changes (`git diff --staged`).

1. Identify the type: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
2. Identify the scope (file area or feature).
3. Write a conventional commit message: `type(scope): imperative summary`.
4. If changes touch the DB schema, add `BREAKING CHANGE:` footer.
5. Show the commit message and ask for approval before committing.
6. After commit: log to Postgres (`event_type: TASK_COMPLETE`, `agent_id: oracle`).
