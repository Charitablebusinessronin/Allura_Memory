# ADAS Requirements Traceability Matrix

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (Claude).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.

<!-- This matrix traces Business Requirements and Functional Requirements across the ADAS design documentation. -->

---

## Table of Contents

- [1. Business Requirements → Functional Requirements](#1-business-requirements--functional-requirements)
- [2. Functional Requirements Detail](#2-functional-requirements-detail)
  - [Agent Design (F1–F3)](#agent-design-f1f3)
  - [Evaluation (F4–F8)](#evaluation-f4f8)
  - [Search Loop (F9–F13)](#search-loop-f9f13)
  - [Sandbox (F14–F16)](#sandbox-f14f16)
  - [Governance (F17–F19)](#governance-f17f19)
  - [Ollama Integration (F20–F22)](#ollama-integration-f20f22)
- [3. Use Case Index](#3-use-case-index)

---

## 1. Business Requirements → Functional Requirements

| ID | Business Requirement | Functional Requirements | Use Cases |
|----|----------------------|------------------------|-----------|
| B1 | Design AI agents automatically via evolutionary search | [F1](#f1), [F2](#f2), [F3](#f3), [F9](#f9), [F10](#f10), [F11](#f11), [F12](#f12), [F13](#f13) | ADAS-UC1, ADAS-UC2, ADAS-UC3 |
| B2 | Use real LLM inference (Ollama) — no mocked responses | [F20](#f20), [F21](#f21), [F22](#f22) | ADAS-UC4 |
| B3 | Govern agent promotion via HITL — human reviews proposals | [F17](#f17), [F18](#f18), [F19](#f19) | ADAS-UC5, ADAS-UC6 |
| B4 | Provide CLI entry point for standalone ADAS runs | CLI (see [BLUEPRINT.md](BLUEPRINT.md) §8) | ADAS-UC7 |
| B5 | Persist all evaluation events to PostgreSQL | [F6](#f6) | ADAS-UC8 |
| B6 | Support two-tier model selection | [AD-01](RISKS-AND-DECISIONS.md#ad-01-two-tier-model-selection-stable-vs-experimental) | ADAS-UC9 |

---

## 2. Functional Requirements Detail

### Agent Design (F1–F3)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f1"></a>F1 | Generate random `AgentDesign` from a `SearchSpace` — random model, strategy, and prompt | `generateRandomDesign()` · [BLUEPRINT.md](BLUEPRINT.md#agentdesign) |
| <a name="f2"></a>F2 | Mutate an `AgentDesign` — change prompt, swap model (within tier), change reasoning strategy | `mutateDesign()` · [BLUEPRINT.md](BLUEPRINT.md#searchloop) · [mutation operators](src/lib/adas/mutations.ts) |
| <a name="f3"></a>F3 | Crossover two `AgentDesign` instances — combine configs to produce a child design | `crossoverDesigns()` · [BLUEPRINT.md](BLUEPRINT.md#searchloop) · [crossover logic](src/lib/adas/mutations.ts) |

### Evaluation (F4–F8)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f4"></a>F4 | Evaluate candidate against `DomainConfig` ground truth — run forward function, compare output to expected | `EvaluationHarness.evaluateCandidate()` · [BLUEPRINT.md](BLUEPRINT.md#evaluationharness) |
| <a name="f5"></a>F5 | Compute composite score: `accuracyWeight * accuracy + costWeight * normCost + latencyWeight * normLatency` | `computeCompositeScore()` · [BLUEPRINT.md](BLUEPRINT.md#evaluationharness) · [metrics.ts](src/lib/adas/metrics.ts) |
| <a name="f6"></a>F6 | Log every evaluation event to PostgreSQL (`adas_trace_events` table) | `insertTraceEvent()` · [BLUEPRINT.md](BLUEPRINT.md#adas_trace_events) · [evaluation-harness.ts](src/lib/adas/evaluation-harness.ts) |
| <a name="f7"></a>F7 | Support multiple domains: `math`, `reasoning`, `code` — configurable via CLI | [BLUEPRINT.md](BLUEPRINT.md#domainconfig) · [cli.ts](src/lib/adas/cli.ts) |
| <a name="f8"></a>F8 | Rank candidates by composite score — descending order | `rankCandidates()` · [BLUEPRINT.md](BLUEPRINT.md#evaluationharness) · [metrics.ts](src/lib/adas/metrics.ts) |

### Search Loop (F9–F13)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f9"></a>F9 | Initialize population of random designs from `SearchSpace` | `SearchLoop.runSearch()` · [BLUEPRINT.md](BLUEPRINT.md#searchloop) · [search-loop.ts](src/lib/adas/search-loop.ts) |
| <a name="f10"></a>F10 | Run evolutionary iterations — evaluate, rank, mutate, crossover until max iterations | `SearchLoop.runSearch()` loop · [BLUEPRINT.md](BLUEPRINT.md#searchloop) |
| <a name="f11"></a>F11 | Track best design across all iterations | `SearchLoop.runSearch()` best tracking · [BLUEPRINT.md](BLUEPRINT.md#searchloop) |
| <a name="f12"></a>F12 | Support configurable population size, elite count, mutation rate, crossover rate | `SearchConfig` · [BLUEPRINT.md](BLUEPRINT.md#searchloop) · [cli.ts](src/lib/adas/cli.ts) |
| <a name="f13"></a>F13 | Early stopping when `successThreshold` met (top candidate score >= threshold) | `SearchLoop.runSearch()` early exit · [BLUEPRINT.md](BLUEPRINT.md#searchloop) |

### Sandbox (F14–F16)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f14"></a>F14 | Execute agent code in isolated process — resource limits (CPU, memory) | `Sandbox.executeInProcess()` · [BLUEPRINT.md](BLUEPRINT.md#sandbox) · [sandbox.ts](src/lib/adas/sandbox.ts) |
| <a name="f15"></a>F15 | Execute agent code in Docker container — read-only filesystem, no network | `Sandbox.executeInDocker()` · [BLUEPRINT.md](BLUEPRINT.md#sandbox) · [sandbox.ts](src/lib/adas/sandbox.ts) |
| <a name="f16"></a>F16 | Capture stdout/stderr, return structured output or error | `Sandbox.executeInProcess/Docker()` return value · [BLUEPRINT.md](BLUEPRINT.md#sandbox) |

### Governance (F17–F19)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f17"></a>F17 | Generate `PromotionProposal` when candidate score >= promotion threshold | `PromotionDetector.detect()` · [BLUEPRINT.md](BLUEPRINT.md#promotionproposal--hitl-governance) · [promotion-detector.ts](src/lib/adas/promotion-detector.ts) |
| <a name="f18"></a>F18 | Human reviewer approves/rejects/modifies proposal | `PromotionProposal` workflow · [BLUEPRINT.md](BLUEPRINT.md#promotionproposal--hitl-governance) · [promotion-proposal.ts](src/lib/adas/promotion-proposal.ts) |
| <a name="f19"></a>F19 | Only `approved` designs may be promoted to active agent status | `PromotionProposal.humanDecision` gate · [BLUEPRINT.md](BLUEPRINT.md#promotionproposal--hitl-governance) · [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md#ad-03-hitl-governance-for-agent-promotion) |

### Ollama Integration (F20–F22)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f20"></a>F20 | Route cloud models (`:cloud` suffix) to `OLLAMA_CLOUD_URL` with Bearer auth | `OllamaClient.complete()` routing · [BLUEPRINT.md](BLUEPRINT.md#ollama-integration) · [client.ts](src/lib/ollama/client.ts) · [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md#ad-02-ollama-cloud-vs-local-routing-by-model-name-suffix) |
| <a name="f21"></a>F21 | Route local models to `OLLAMA_BASE_URL` without auth | `OllamaClient.complete()` routing · [BLUEPRINT.md](BLUEPRINT.md#ollama-integration) · [client.ts](src/lib/ollama/client.ts) |
| <a name="f22"></a>F22 | Track token usage and latency per Ollama call | `OllamaCompletion.usage` + `durationMs` · [BLUEPRINT.md](BLUEPRINT.md#ollama-integration) · [client.ts](src/lib/ollama/client.ts) |

---

## 3. Use Case Index

### ADAS Use Cases

| ID | Name | Design Doc | Requirements |
|----|------|------------|--------------|
| ADAS-UC1 | Run evolutionary search | [BLUEPRINT.md](BLUEPRINT.md) | F1, F2, F3, F9, F10 |
| ADAS-UC2 | Evaluate agent candidate | [BLUEPRINT.md](BLUEPRINT.md) | F4, F5, F6, F7, F8 |
| ADAS-UC3 | Mutate and evolve designs | [BLUEPRINT.md](BLUEPRINT.md) | F2, F3, F12 |
| ADAS-UC4 | Execute agent via Ollama | [BLUEPRINT.md](BLUEPRINT.md) | F20, F21, F22 |
| ADAS-UC5 | Submit promotion proposal | [BLUEPRINT.md](BLUEPRINT.md) | F17 |
| ADAS-UC6 | Review and decide proposal | [BLUEPRINT.md](BLUEPRINT.md) | F18, F19 |
| ADAS-UC7 | Run ADAS via CLI | [BLUEPRINT.md](BLUEPRINT.md) | B4 |
| ADAS-UC8 | Audit evaluation history | [BLUEPRINT.md](BLUEPRINT.md) | F6 |
| ADAS-UC9 | Select model tier | [BLUEPRINT.md](BLUEPRINT.md) | B6, AD-01 |

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — core design
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) — decisions and risks
