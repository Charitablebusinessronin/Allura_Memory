# Notes: Using the Allura Memory Dashboard Prompt

## Quick Start Checklist

Before pasting the prompt into Claude Design:

- [ ] Have the Allura logo files ready (primary PNG, icon-only, transparent versions)
- [ ] Know your Figma file key: `PAQpnxQZENNwbhmk5qxOjR`
- [ ] Decide: HTML prototype or Figma spec? (HTML = faster to share, Figma = easier to hand off)
- [ ] Have sample memory data ready (see Sample Data section below)

---

## Claude Design Tips

### Getting the Best Results
1. **Start broad, then refine.** Ask Claude to generate the full dashboard first, then use inline comments to tweak specific cards or colors.
2. **Use the adjustment knobs.** After first draft, ask Claude to add sliders for spacing, color intensity, or card density.
3. **Import from codebase.** If you have existing Allura components, point Claude at the repo so it auto-applies your design system.
4. **Export early.** Export to HTML after each major screen — you can open it in a browser immediately.

### Prompt Add-Ons (Paste These After the Main Prompt)

**For a warmer feel:**
```
Add subtle warmth to the background — not pure gray, but a very light cream tint (#FAF9F7). Use soft shadows (0 2px 8px rgba(26,43,74,0.06)) instead of hard borders.
```

**For more personality:**
```
Add micro-interactions: cards gently lift on hover (transform: translateY(-2px)), confidence bars animate on load, and the search bar expands slightly when focused.
```

**For realism:**
```
Use realistic sample data. Memories should sound like things an AI system would actually remember: "User prefers async standups over meetings," "Deploy script fails on Node 18 — use Node 20 instead," "Client mentioned budget freeze until Q3."
```

---

## Sample Data (Copy-Paste Ready)

### Memory Cards (Mix of statuses/confidences)

| Status | Confidence | Memory Text | Agent | Time |
|--------|-----------|-------------|-------|------|
| Active | 92% | "User prefers async standups over live meetings. Mentioned focus time." | Scout | 2h ago |
| Active | 87% | "Deploy script fails on Node 18. Use Node 20 for all future deploys." | Scout | 5h ago |
| Active | 45% | "Client might want dark mode. Not confirmed — check in next call." | Scout | 1d ago |
| Active | 78% | "Brand color palette approved: Deep Navy, Coral, Trust Green. Locked in Figma." | Scout | 2d ago |
| Pending | 63% | "Team discussed moving from PostgreSQL to Neo4j for graph queries." | Scout | 3d ago |
| Forgotten | 91% | "Old logo files in /assets/v1/. Do not use for new materials." | Scout | 5d ago |
| Deprecated | 55% | "Previous API endpoint /v1/memories deprecated. Use /v2/memories." | Scout | 1w ago |
| Active | 96% | "User's preferred name is 'Sam' — not 'Samantha' on external comms." | Scout | 1w ago |
| Active | 34% | "Mentioned interest in AI governance tools. Vague — needs follow-up." | Scout | 2w ago |
| Active | 81% | "Critical: never deploy on Fridays. Team agreement since March incident." | Scout | 2w ago |

### Curator Queue Insights

| Summary | Confidence | Traces | Source |
|-----------|-----------|--------|--------|
| "Users want export to PDF feature" | 89% | 4 | 3 user interviews + 1 support ticket |
| "Mobile app needs offline mode" | 76% | 2 | 2 user feedback sessions |
| "Dark mode requested by enterprise clients" | 94% | 5 | 4 sales calls + 1 churn survey |
| "Graph view is confusing without labels" | 82% | 3 | 2 usability tests + 1 analytics drop-off |
| "Search needs filters by date and agent" | 71% | 2 | 2 feature requests |

### Graph Nodes (20-node demo set)

**People (5):** User-Sam, Product-Manager-Alex, Engineer-Jordan, Designer-Casey, Client-Taylor  
**Topics (8):** Brand-Colors, API-v2, Deploy-Scripts, User-Preferences, Mobile-App, Dark-Mode, Export-PDF, Graph-UI  
**Decisions (4):** Use-Node-20, Lock-Brand-Palette, No-Friday-Deploys, Prefer-Async-Standups  
**Traces (3):** Interview-2026-04-10, Support-Ticket-4482, Analytics-Session-March

**Edges:**
- User-Sam → Prefer-Async-Standups (derived_from)
- Prefer-Async-Standups → approved_by → Product-Manager-Alex
- API-v2 → supersedes → API-v1
- Brand-Colors → approved_by → Designer-Casey
- Deploy-Scripts → derived_from → Support-Ticket-4482

---

## Common Pitfalls to Avoid

1. **Don't let Claude use default blues.** The Allura palette uses Clarity Blue (#5B8DB8) — not Tailwind's default blue-500. Explicitly call out hex codes.

2. **Avoid "AI" as a benefit.** The voice says "AI-powered" is a must-not. Memories should focus on outcomes, not technology.

3. **Watch for jargon creep.** Claude might generate labels like "Provenance Traces" or "Semantic Index." Correct to "View Source" and "Search memories."

4. **Confidence bars need context.** A red bar at 34% without explanation looks broken. Always pair with "Needs Review" label and a tooltip.

5. **Mobile drawer stacking.** On <768px, the drawer must become a bottom sheet, not a side panel. Test this explicitly.

6. **Graph node contrast.** Deep Navy (#1A2B4A) nodes on Pure White (#F5F5F5) background need sufficient contrast. Add a subtle stroke or shadow.

---

## Iteration Prompts (Use After First Draft)

### Round 2: Polish
```
Refine the memory cards: add a subtle left-border color matching status (green for Active, gray for Forgotten). Increase card padding to 24px. Make confidence bars thinner (4px height) with rounded ends.
```

### Round 3: Interactions
```
Add hover states: cards lift slightly, "View Source" link turns Clarity Blue with underline, "Forget" button shows a confirmation tooltip. Add a "Restore" action on Forgotten tab cards.
```

### Round 4: Edge Cases
```
Show me the empty state for the Memories tab. Then show the low-confidence warning state. Then show the "No traces available" state in the provenance drawer. Use the same visual language throughout.
```

### Round 5: Mobile
```
Convert this to mobile width (375px). Stack the search bar below the title. Make tabs scroll horizontally. Convert the provenance drawer to a bottom sheet that slides up from 60% of screen height.
```

---

## Export Options

| Format | Best For | How To |
|--------|----------|--------|
| **Standalone HTML** | Quick sharing, user testing | Ask Claude to "export as a single HTML file" |
| **Figma** | Designer handoff, pixel-perfect | Ask Claude to "create a Figma-ready spec" then paste into Figma |
| **PPTX** | Stakeholder presentation | Ask Claude to "convert to a pitch deck" |
| **PDF** | Documentation, approval | Export HTML to PDF via browser print |

---

## Voice Check (Before Finalizing)

Run this quick audit on all text in the mockup:

- [ ] No sentence over 20 words
- [ ] No passive voice ("Source can be viewed" → "View source")
- [ ] No jargon ("semantic memory index" → "what your system remembers")
- [ ] No exclamation points
- [ ] No all-caps except the tagline "MEMORY THAT SHOWS ITS WORK"
- [ ] All labels use 6th-grade vocabulary

**Quick test:** Paste any label into https://hemingwayapp.com/ — it should score Grade 6 or lower.

---

## File Locations

- **Prompt JSON:** `clients/allura-memory/prompts/allura-memory-dashboard-prompt.json`
- **Design Brief MD:** `clients/allura-memory/prompts/allura-memory-dashboard-design-brief.md`
- **Brand Kit:** `clients/allura-memory/04_brand-kit-builder_brand-kit.md`
- **Brand Truth:** `clients/allura-memory/06_allura-memory_brand-truth.json`
- **Color Palette:** `clients/allura-memory/assets/colors/color-palette.json`
- **Logo Assets:** `clients/allura-memory/assets/logos/allura-logo/`

---

## Next Steps After Mockup

1. **Review with stakeholders** — Export HTML and share the link
2. **Hand off to engineering** — Use Claude Code with the HTML file as reference
3. **Log to Allura Brain** — Store the approved design as a DESIGN_DECISION event
4. **Create Figma components** — Convert approved cards into reusable components
5. **Schedule QA** — Test empty states, low confidence, mobile stacking

---

*Last updated: 2026-04-25*  
*Prompt version: 1.0*
