# 🎨 UX Spec — OpenClaw Gateway

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.


> **Type:** Self-hosted human communication gateway UI  
> **Runs On:** Ubuntu (local only — the only component outside Docker)  
> **Users:** You — the operator. Single-tenant, personal dashboard.  
> **Pattern:** Compact command-surface. Message routing hub.  
> **Palette:** Dark-mode first (terminal-adjacent feel)  
> **Fonts:** Satoshi body + monospace for all message payloads and routing logs

---

## What OpenClaw Does

OpenClaw bridges human communication channels (WhatsApp, Telegram, Discord) to the Allura Agent Runtime. Every inbound message passes through kernel-level policy checks before routing to an agent. Every outbound response is policy-checked before delivery.

```javascript
Human (WhatsApp / Telegram / Discord)
         ↓  inbound
    OpenClaw UI (Ubuntu)
         ↓  policy check (RuVix kernel)
    Agent Runtime (Docker)
         ↓  response
    OpenClaw UI
         ↓  policy check + delivery
Human
```

---

## Layout Shell

```javascript
┌─────────────────────────────────────────────┐
│  🔌 OpenClaw          [status] [settings]  │
├────────────┬──────────────────────────────┤
│  CHANNELS   │  MESSAGE THREAD                     │
│            │                                     │
│  WhatsApp   │  [inbound] → [routing tag]           │
│  Telegram   │  [agent reply] ← [confidence]       │
│  Discord    │  [inbound] → [BLOCKED by policy]    │
│            │                                     │
│  ROUTING    │  [ Type a message... ]  [Send]       │
│  POLICY     │                                     │
└────────────┴──────────────────────────────┘
┌─────────────────────────────────────────────┐
│  ROUTING LOG (live tail — monospace)             │
└─────────────────────────────────────────────┘
```

Two-column at > 768px. Channels collapse to top tab bar on mobile.

---

## Page Map

| Route | Page | Primary Action |
|-------|------|----------------|
| `/` | Live Message Hub | Send / monitor messages |
| `/channels` | Channel Manager | Connect / disconnect channels |
| `/routing` | Routing Rules | Set workspace to channel mappings |
| `/policy` | Policy Rules | View / edit RuVix kernel policies |
| `/log` | Event Log | Live tail of all routed messages |
| `/settings` | Settings | API keys, webhook URLs, timeouts |

---

## Left Panel: Channel List

```javascript
CHANNELS
──────────────
● WhatsApp       🟢 Connected
  +1 (704) xxx-xxxx
  Last: 2m ago

● Telegram       🟢 Connected
  @roninbot
  Last: 14m ago

● Discord        🔴 Disconnected
  [Connect]

ROUTING
──────────────
WhatsApp → faithmeats-agent
Telegram → personal-agent
Discord  → [unset]

POLICY STATUS
──────────────
✅ groupId enforced
✅ GLBA filter active
⚠ Nonprofit filter: OFF
```

Status dot: 8px circle. Success color = connected. Error color = disconnected.

Policy warnings use warning color + text label.

---

## Center Panel: Message Thread

### Message Bubble Types

```javascript
┌──────────────────────────────────────────┐
│ INBOUND  [WhatsApp]  [Faith Meats workspace]     │
│ "What is the HACCP status for batch #FMB-042?"   │
│ 09:14 AM   Routed to: SENTINEL                   │
└──────────────────────────────────────────┘

               ┌──────────────────────────────┐
               │ OUTBOUND  [SENTINEL reply]          │
               │ "Batch #FMB-042: Temp 38F. OK"      │
               │ 09:14:03   Confidence: 0.97         │
               └──────────────────────────────┘

┌──────────────────────────────────────────┐
│ BLOCKED  [Telegram]  [Audits workspace]          │
│ "Send me the full GLBA audit file"               │
│ 09:22 AM   Policy: GLBA export blocked           │
│ Requires human approval in Paperclip             │
└──────────────────────────────────────────┘
```

**Inbound:** surface color, left-aligned, routing tag pill.

**Outbound:** surface-2 color, right-aligned, confidence score in xs text.

**Blocked:** warning-highlight background, warning border-left (critical alert state — not decoration).

---

## Bottom Panel: Routing Log (Live Tail)

```javascript
[LIVE] ────────────────────────────── [Pause] [Clear]
09:14:03  INBOUND   whatsapp → faithmeats-agent   OK
09:14:03  POLICY    group_id=allura-faith-meats    pass
09:14:03  ROUTE     faithmeats-agent → SENTINEL    OK
09:14:04  OUTBOUND  SENTINEL → whatsapp            delivered
09:22:11  INBOUND   telegram → audits-agent        BLOCKED
09:22:11  POLICY    GLBA export denied              blocked
```

Font: monospace, xs size, muted text color.

Status: OK = success color, BLOCKED = error color, pass = muted.

---

## Page: Routing Rules

```javascript
ROUTING RULES
──────────────
┌─────────────┬─────────────┬─────────────┬────────┐
│ Channel     │ Pattern     │ Route To    │ Action  │
├─────────────┼─────────────┼─────────────┼────────┤
│ WhatsApp    │ *           │ faithmeats  │ [Edit]  │
│ Telegram    │ /haccp *    │ SENTINEL    │ [Edit]  │
│ Telegram    │ *           │ personal    │ [Edit]  │
│ Discord     │ —          │ [unset]     │ [Set]   │
└─────────────┴─────────────┴─────────────┴────────┘
[+ Add Rule]
```

Rules evaluate top-to-bottom. Drag to reorder.

---

## Component Map

| Component | Variants | Notes |
|-----------|----------|-------|
| `MessageBubble` | inbound, outbound, blocked | Blocked = warning highlight |
| `ChannelStatus` | connected, disconnected, warning | Status dot + label |
| `RoutingTag` | per workspace color | Pill on inbound message |
| `PolicyBadge` | pass, blocked, warning | Inline on each message |
| `LogLine` | ok, warn, error | Monospace, live tail |
| `RoutingRule` | draggable row | Inline edit on click |
| `ConfidenceScore` | 0.0 to 1.0 | xs text, tabular-nums |

---

## Empty & Error States

| State | Message |
|-------|---------|
| No channels connected | "No channels connected. Add WhatsApp, Telegram, or Discord to get started." |
| No messages today | "No messages routed today." |
| Channel disconnected mid-session | "WhatsApp disconnected. Messages queued. [Reconnect]" |
| Policy violation | "Blocked: [policy name]. Logged to Audit." |
