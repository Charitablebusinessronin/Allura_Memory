# Research Brief — Hermes Agent as Team RAM Harness

> [!NOTE]
> **AI-Assisted Documentation**
> Drafted with AI assistance during a research conversation on 2026-05-11. Exploratory only — not a decision, not an ADR. Captures the open questions surfaced before any migration is attempted.

**Status:** Exploratory · **Owner:** Brooks (orchestrator) · **Decision required:** No

## Context

Open-ended question raised: "How do we feel about Hermes and transferring Team RAM into a Hermes agent?" Directional follow-up: "We're gonna use our Ollama models and put Team RAM in it." This brief captures what Hermes is, what porting Team RAM into it actually means, and the open questions that need answers before any commitment is made.

## What Hermes Is

Hermes Agent is an open-source agent **harness** from Nous Research (released February 2026). Same category as OpenClaw, Claude Code, and OpenCode — it is the runtime that wraps a model and gives it tools, permissions, memory, and a workflow loop. Hermes is not a model; it sits in front of whichever model you point it at.

Distinguishing features versus OpenClaw / Claude Code / OpenCode:

| Feature | Hermes | Notes for Allura |
| --- | --- | --- |
| Model surface | Any endpoint — Nous Portal, OpenRouter (200+), NVIDIA NIM, Xiaomi MiMo, GLM/z.ai, Kimi, MiniMax, OpenAI, Ollama, custom | Ollama is on the supported list — fits the directional call |
| Memory loop | Built-in: creates skills from experience, searches its own past conversations, builds a persistent user model across sessions | Overlaps with Allura Brain — see Open Questions |
| Deploy backends | local · Docker · SSH · Singularity · Modal — container hardening, namespace isolation | Wider deploy story than current OpenCode setup |
| Multi-platform reach | Telegram · Discord · Slack · WhatsApp · Signal · Email · CLI from one gateway | New capability — Team RAM personas reachable from messaging clients |
| Orchestrates other harnesses | Can drive OpenCode as a sub-worker per Nous docs | Migration path is gradual, not all-at-once |

The New Stack ran a piece in 2026 titled *"OpenClaw vs. Hermes Agent: the race to build AI assistants that never forget."* Preloop already markets a control plane sitting above OpenClaw, Hermes, Claude Code, Codex CLI, and Cursor — so the ecosystem treats these as peer harnesses.

## The Directional Call

Use **Ollama models** as the model surface and put **Team RAM** inside **Hermes**.

What that sentence implies, made explicit:

1. The current OpenCode / Claude Code split becomes Hermes-as-runtime for Team RAM personas.
2. Routing rules in [`agent-routing.md`](../../../.claude/rules/agent-routing.md) still apply at the *persona* layer — Brooks plans, Woz builds, Pike consults read-only — but the model column changes from OpenAI / Ollama-Cloud mix to Ollama-only.
3. Allura Brain remains the canonical memory surface (per AD-2026-04-28). Hermes' built-in skill-creation loop is either disabled or pointed at Allura.

## What Transfers Cleanly

- **Persona system prompts** in `.opencode/agent/**/*.md` — text portable, drop into Hermes' agent config.
- **Tool allow/deny lists** — Pike read-only, Scout search-only, Hightower no manual prod SSH. Hermes enforces tool permissions in the same shape.
- **Routing rules** — intent-based dispatch (planning → Brooks, build → Woz, perf → Bellard/Carmack) is harness-agnostic.
- **Multi-platform reach is a free win** — Brooks reachable from Telegram or Slack with the same persona prompt.

## What Gets Re-Thought

### 1. Frontmatter model declarations

Today every Team RAM agent declares `primary` and (sometimes) `fallback_model` in its `.opencode/agent/**/*.md` frontmatter. Hermes' model selection is a runtime `hermes model` command, not per-agent frontmatter. Porting requires either:

- a thin wrapper that switches Hermes' active model based on which persona is being invoked, or
- Hermes-side configuration that maps agent identity → model. (Needs confirmation against current Hermes docs — not validated in this brief.)

### 2. Memory loop conflict

Hermes' "the agent that grows with you" hook is its own persistent memory. Allura Brain (PostgreSQL events + Neo4j semantic + RuVector hybrid) is the project's canonical memory. **Two persistent-memory systems running in parallel will diverge** — one must be authoritative. The architectural default per AD-2026-04-28 keeps Allura Brain canonical. Open work: figure out how to disable Hermes' built-in memory or wire it to call `allura-brain__memory_*` tools.

### 3. Curator pipeline + skill-creation overlap

Allura's curator pipeline scores traces, queues proposals, and requires human approval before Neo4j writes. Hermes' skill-creation loop generates skills from experience. These are doing related work at different layers — episodic-to-canonical promotion (Allura) versus runtime-skill synthesis (Hermes). Need to decide whether Hermes skills are ephemeral (per-session) or feed into Allura's promotion pipeline.

## Ollama: Local or Cloud?

This is the first concrete question to resolve. The [model registry](../../../.claude/docs/MODEL_REGISTRY.md) uses `ollama-cloud/` prefixes (deepseek-v4-pro, qwen3-coder-next, nemotron-3-super, kimi-k2.6, glm-5.1) — that is Ollama's hosted offering. Local Ollama runs at `localhost:11434` and is a different latency, cost, and privacy profile.

| Dimension | Ollama Local | Ollama Cloud |
| --- | --- | --- |
| Latency | LAN — fastest | Network round-trip |
| Cost | Hardware-only | Per-token billing |
| Model size ceiling | Bound by local VRAM | Frontier models available |
| Privacy for Allura Brain content | Air-gapped possible | Vendor egress |
| Current registry alignment | Requires new model bindings | Already declared |

If the goal is "no OpenAI dependency," either works. If the goal is "no cloud at all," only local Ollama qualifies — and the model substitution table below changes (smaller models, longer planning latency for Brooks).

## Model Substitution (Replacing OpenAI Routes)

Five Team RAM agents currently route to OpenAI models. Pure-Ollama substitutes, using existing fallbacks where declared:

| Agent | Current Primary | Pure-Ollama Substitute | Source |
| --- | --- | --- | --- |
| Brooks | `openai/gpt-5.5` | `ollama-cloud/deepseek-v4-pro` | Already declared as fallback |
| Hightower | `openai/gpt-5.5` | `ollama-cloud/deepseek-v4-pro` | Already declared as fallback |
| Fowler | `openai/gpt-5.5` | `ollama-cloud/deepseek-v4-pro` *(new — no current fallback)* | Needs ADR |
| Bellard | `openai/gpt-5.4-mini` | `ollama-cloud/glm-5.1` or `kimi-k2.6` *(new)* | Needs ADR |
| Carmack | `openai/gpt-5.4-mini` | `ollama-cloud/glm-5.1` or `kimi-k2.6` *(new)* | Needs ADR |
| Pike | `openai/gpt-5.4-mini` | `ollama-cloud/glm-5.1` *(new)* | Needs ADR |
| Jobs | `ollama-cloud/deepseek-v4-pro` | unchanged | — |
| Woz | `ollama-cloud/qwen3-coder-next` | unchanged | — |
| Knuth | `ollama-cloud/qwen3-coder-next` | unchanged | — |
| Scout | `ollama-cloud/nemotron-3-super` | unchanged | — |

If we go **local Ollama only**, the deepseek-v4-pro / qwen3-coder-next substitutes likely will not fit in consumer-grade VRAM and need to be replaced with smaller distillations.

## Open Questions

1. **Ollama Cloud or local Ollama?** Drives every model substitution downstream.
2. **Does Hermes accept per-agent model bindings**, or does it require a wrapper layer to switch models when persona changes?
3. **Memory authority** — confirm Allura Brain stays canonical; design the integration that disables or redirects Hermes' built-in memory loop.
4. **Skill-creation scope** — are Hermes-generated skills ephemeral, or do they flow into Allura's curator pipeline for promotion?
5. **Migration shape** — all-at-once cutover, or use Hermes' OpenCode-as-sub-worker pattern to migrate one persona at a time (Brooks first as a pilot)?
6. **Multi-platform exposure** — which Team RAM personas (if any) should be reachable from Telegram / Slack? Brooks is an obvious candidate; Woz running autonomously over messaging is more dangerous.

## Recommended Next Steps (If Pursuing)

- Resolve Ollama Local vs Cloud question first — no other decision is portable without it.
- Pilot **one persona** in Hermes (Pike — read-only, low blast radius) before any broader migration.
- Draft a follow-up ADR in `RISKS-AND-DECISIONS.md` once questions 1–3 above have answers.

## References

External (Hermes):
- [Hermes Agent — Nous Research](https://hermes-agent.nousresearch.com/)
- [GitHub — NousResearch/hermes-agent](https://github.com/nousresearch/hermes-agent)
- [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/)
- [The New Stack: OpenClaw vs. Hermes Agent](https://thenewstack.io/persistent-ai-agents-compared/)
- [The Harness Paradigm: Claude Code vs Hermes Agent](https://kenhuangus.substack.com/p/chapter-1-the-harness-paradigm-claude)
- [MindStudio: Hermes as the OpenClaw alternative](https://www.mindstudio.ai/blog/what-is-hermes-agent-openclaw-alternative)
- [Preloop — control plane across harnesses](https://preloop.ai/about)

Internal:
- [`.claude/rules/agent-routing.md`](../../../.claude/rules/agent-routing.md) — Team RAM definitions, current routing
- [`.claude/docs/MODEL_REGISTRY.md`](../../../.claude/docs/MODEL_REGISTRY.md) — canonical model bindings
- [`.claude/rules/mcp-integration.md`](../../../.claude/rules/mcp-integration.md) — AD-2026-04-28: Allura Brain as canonical memory surface
- [`docs/symphony-comparison-analysis.md`](../../symphony-comparison-analysis.md) — companion exploratory brief
