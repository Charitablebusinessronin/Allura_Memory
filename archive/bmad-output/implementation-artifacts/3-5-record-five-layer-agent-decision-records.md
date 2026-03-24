# Story 3.5: record-five-layer-agent-decision-records

Status: complete

## Story

As a compliance officer,
I want every session to produce a comprehensive ADR capturing reasoning and counterfactuals,
so that we satisfy audit requirements for SOC 2, GDPR, and ISO 27001.

## Acceptance Criteria

1. Given an agent completes a reasoning step, when the state is updated, then the system logs Action Logging, Decision Context, Reasoning Chain, Counterfactuals, and Human Oversight Trail.
2. Given an ADR is created, when reviewing it, then the log includes specific model, prompt, and tool versions used for reproducibility.
3. Given audit requirements exist, when an auditor requests records, then the system can reconstruct the decision process from ADR data.

## Tasks / Subtasks

- [x] Task 1: Design ADR schema (AC: 1)
  - [x] Define five layers: Action, Context, Reasoning, Counterfactuals, Oversight.
  - [x] Design ADR data structure for each layer.
  - [x] Define ADR lifecycle: created -> completed -> archived.
- [x] Task 2: Implement ADR capture (AC: 1)
  - [x] Add `src/lib/adr/capture.ts` for recording decision records.
  - [x] Capture action: what was done, inputs, outputs.
  - [x] Capture context: state, goals, constraints at decision time.
  - [x] Capture reasoning: why this action was chosen.
- [x] Task 3: Implement reasoning and counterfactual capture (AC: 1)
  - [x] Add `src/lib/adr/reasoning.ts` for thought process recording.
  - [x] Capture alternatives considered.
  - [x] Capture why alternatives were rejected (counterfactuals).
  - [x] Link to model outputs and reasoning chains.
- [x] Task 4: Implement human oversight trail (AC: 1, 2)
  - [x] Add `src/lib/adr/oversight.ts` for human interaction recording.
  - [x] Capture approvals, rejections, modifications by humans.
  - [x] Record model and tool versions for reproducibility.
  - [x] Link to Mission Control actions.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test all five layers are captured correctly.
  - [x] Test ADR can reconstruct decision process.
  - [x] Test version information is accurate.
  - [x] Test audit trail is complete and tamper-evident.

## Dev Notes

- NFR4 requires five audit layers for critical decisions.
- NFR5 requires SOC 2, GDPR, ISO 27001 compliance.
- ADRs must be tamper-evident (append-only, signed).
- Reproducibility requires exact model versions, prompts, and tool versions.
- Consider ADR storage in PostgreSQL with cryptographic hashing.

### Project Structure Notes

- Create `src/lib/adr/` directory for Agent Decision Records.
- Integration with Ralph loop (Story 3.4) captures decisions at each step.
- ADRs may be large - consider compression or offloading to object storage.

### References

- NFR4: Five audit layers: `epics.md:78`
- NFR5: Compliance: `epics.md:80`
- FR21: ADRs: `epics.md:60`
- Epic 3 context: `_bmad-output/planning-artifacts/epics.md:390`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL), Story 3.4 (Ralph Loop)
- PostgreSQL container: `knowledge-postgres`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] ADR schema designed
- [x] ADR capture implemented
- [x] Reasoning and counterfactual capture working
- [x] Human oversight trail functional
- [x] All tests passing

### File List

- `src/lib/adr/types.ts` - ADR type definitions with five layers
- `src/lib/adr/types.test.ts` - Types tests (28 tests)
- `src/lib/adr/capture.ts` - ADR recording and storage
- `src/lib/adr/capture.test.ts` - Capture tests (16 tests)
- `src/lib/adr/reasoning.ts` - Reasoning and counterfactuals recording
- `src/lib/adr/reasoning.test.ts` - Reasoning tests (31 tests)
- `src/lib/adr/oversight.ts` - Human oversight recording and reconstruction
- `src/lib/adr/oversight.test.ts` - Oversight tests (27 tests)
- `src/lib/adr/index.ts` - Public API and FiveLayerADRBuilder

## Implementation Summary

### Five-Layer Architecture

**Layer 1: Action Logging (`ActionLayer`)**
- Records what was done: action type, inputs, outputs, tool calls
- Includes duration metrics for performance analysis
- Supports parent action linking for hierarchical decisions

**Layer 2: Decision Context (`ContextLayer`)**
- Records why it was done: session state, goals, constraints
- Captures available options and selected choice
- Includes environmental factors (system load, dependencies)

**Layer 3: Reasoning Chain (`ReasoningLayer`)**
- Records how the decision was made: thought steps, evidence
- Links to model outputs and reasoning chains
- Captures confidence levels and reasoning type

**Layer 4: Counterfactuals (`CounterfactualsLayer`)**
- Records what else could have been done: alternatives, rejections
- Risk assessment with probability, impact, and mitigation
- Learning notes for continuous improvement

**Layer 5: Human Oversight (`OversightLayer`)**
- Records who reviewed: human interactions, approvals, modifications
- Version trail for complete change history
- Compliance flags for SOC 2, GDPR, ISO 27001

### Key Features

1. **Tamper-Evident Design**: SHA-256 checksums on every layer, with overall checksum verification
2. **Reproducibility**: Model, prompt, and tool versions captured; raw model output stored
3. **Audit Reconstruction**: ADRReconstructor creates complete decision timeline with evidence chain
4. **Compliance Verification**: Automatic SOC 2, GDPR, ISO 27001 compliance checking

### Test Coverage

- 102 tests across 4 test files
- All acceptance criteria verified:
  - AC1: Five-layer capture verified in capture tests
  - AC2: Reproducibility verified in types and reasoning tests  
  - AC3: Audit reconstruction verified in oversight tests