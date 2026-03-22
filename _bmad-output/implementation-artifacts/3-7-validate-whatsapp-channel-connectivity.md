# Story 3.7: validate-whatsapp-channel-connectivity

Status: done

## Story

As an operator,
I want the WhatsApp channel connectivity baseline verified and documented,
so that channel routing assumptions for the governed runtime are backed by evidence.

## Acceptance Criteria

1. Given OpenClaw gateway configuration is present, when channel configuration is reviewed, then WhatsApp channel enablement, allowlist policy, and plugin state are confirmed.
2. Given runtime session metadata exists, when active channels are inspected, then WhatsApp provider/surface/channel evidence is captured.
3. Given channel baseline is already connected, when this story closes, then no duplicate implementation work is introduced and only validation evidence is recorded.

## Tasks / Subtasks

- [x] Task 1: Validate gateway channel configuration (AC: 1)
  - [x] Confirm `channels.whatsapp.enabled = true`.
  - [x] Confirm `channels.whatsapp.dmPolicy = allowlist` and allowlist entries are present.
  - [x] Confirm WhatsApp plugin is enabled.
- [x] Task 2: Validate runtime session evidence (AC: 2)
  - [x] Confirm active WhatsApp session key exists.
  - [x] Confirm `provider`, `surface`, and `channel` fields show WhatsApp.
- [x] Task 3: Close as validation-only baseline (AC: 3)
  - [x] Record references and evidence paths.
  - [x] Mark story done without additional implementation scope.

## Dev Notes

- This story documents an existing connected baseline; it does not introduce new channel integration code.
- Scope is limited to operational verification evidence for FR22 runtime/channel assumptions.

### References

- OpenClaw config evidence: `~/.openclaw/openclaw.json:107`
- WhatsApp plugin evidence: `~/.openclaw/openclaw.json:155`
- Active session evidence: `~/.openclaw/agents/main/sessions/sessions.json:1226`
- Session provider/surface evidence: `~/.openclaw/agents/main/sessions/sessions.json:1229`

## Dev Agent Record

### Agent Model Used

openai/gpt-5.3-codex

### Completion Notes List

- [x] Verified WhatsApp channel enabled in gateway config.
- [x] Verified WhatsApp plugin enabled.
- [x] Verified active WhatsApp direct session metadata.
- [x] Closed as evidence-only; no duplicate implementation added.

### File List

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/implementation-artifacts/3-7-validate-whatsapp-channel-connectivity.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
