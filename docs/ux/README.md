# Allura UX Prototypes

Static HTML prototypes for the Allura Memory governed AI memory system.

## Files

| File | Description |
|------|-------------|
| `allura_main.html` | Main memory list + semantic search view. Displays approved memories with type badges (Preference, Constraint, Fact, Rule), soft-delete with 30-day restore, and provenance metadata. |
| `allura_full_app_mockup.html` | Full app mockup covering memory capture, curator flow, approval queue, memory detail, and audit trail. Includes KPI cards (128 Memories, 14 Proposed, 23 Approved), confidence scores, and activity feed. |

## Design Tokens

```css
--coral:   #E8392C   /* primary CTA, badges */
--cobalt:  #3D50D0   /* links, active states */
--forest:  #1A3232   /* primary text, sidebar */
--emerald: #1E7A50   /* success, approved */
--cream:   #F2EDE4   /* page background */
--amber:   #C8801A   /* warnings, proposed */
--slate:   #5A6980   /* muted text */
--mist:    #EAE6DE   /* card backgrounds */
```

## What to implement next

- [ ] Apply design tokens to `globals.css`
- [ ] Port memory list card component from `allura_main.html`
- [ ] Port approval queue + confidence badge from `allura_full_app_mockup.html`
- [ ] Wire approval queue to `POST /api/insights/:id/approve`
- [ ] Add audit trail panel (raw trace + versioned insight lineage)
- [ ] Mobile: inline edit, tags, better empty states (confidence 0.76 insight)
