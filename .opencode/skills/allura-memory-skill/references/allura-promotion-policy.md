# Allura Promotion Policy

Promote raw memory into curated insight only when the information is useful beyond the immediate session.

## Promotion Preconditions

Promote only when:

- evidence exists
- the information is reusable or durable
- confidence is high enough to justify persistence
- it is not a duplicate of existing knowledge
- tenant scope is explicit

## Promotion Outcomes

Possible outcomes:

- `duplicate`
- `related_context`
- `possible_supersede`
- `promoted`
- `rejected`
- `revoked`

## Write Discipline

- raw traces may be appended freely when relevant
- durable knowledge should be versioned
- if the new fact replaces an old one, prefer `SUPERSEDES`
- if the old fact is no longer valid, mark it deprecated rather than erasing history

## Evidence Requirements

Each promotion candidate should carry:

- source or source_ref
- timestamp
- task or workflow context
- confidence or justification
- enough metadata to audit the claim later

## What Not To Promote

Do not promote:

- unsupported guesses
- transient chatter
- unverified one-off observations
- duplicated content with no added value
- sensitive claims without governance support

## Governance Reminder

In this repo, promotion is governed.

- agents may propose
- curators or HITL flows approve
- canonical truth is not rewritten casually
