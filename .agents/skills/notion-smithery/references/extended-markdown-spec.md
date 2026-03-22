# Notion-Flavored Markdown Reference

This reference covers the enhanced Markdown syntax supported by Notion's MCP tools for creating and updating page content.

## Core Syntax

### Headings and Text

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
~~Strikethrough text~
`Inline code`
```

### Lists

```markdown
- Unordered item
- Another item

1. Ordered item
2. Second item

- [ ] Checkbox unchecked
- [x] Checkbox checked
```

### Links and Media

```markdown
[Link text](https://example.com)
![Image alt](https://example.com/image.png)
```

## Advanced Blocks

### Toggle Blocks

```markdown
<details>
<summary>Toggle title</summary>

Hidden content inside the toggle.
Can include multiple paragraphs.

- Bulleted lists
- Work inside toggles

</details>
```

### Callout Blocks

```markdown
> 💡 This is a callout
> With multiple lines
```

Common icons: 💡, ⚠️, ❗, 📝, 💭

### Code Blocks

```markdown
```language
code here
```

Supported languages: javascript, python, typescript, bash, html, css, json, sql, and more.
```

### Blockquotes

```markdown
> Regular blockquote
> Can span multiple lines
>
> Empty line adds spacing
```

## Columns and Layout

### Two Columns

```markdown
::: columns
::: column
Left column content
:::
::: column
Right column content
:::
:::
```

### Numbered Columns

```markdown
::: columns-3
Content for 3-column layout
:::
```

## Tables

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

## Embeds and Special Blocks

### Page Links

```markdown
<page url="https://notion.so/workspace/Page-Title-1234567890">
Embedded page content or reference
</page>
```

### Database Links

```markdown
<database url="https://notion.so/workspace/Database-1234567890?v=abc123">
Linked database reference
</database>
```

### Data Sources

```markdown
<data-source url="collection://12345678-90ab-cdef-1234-567890abcdef">
Data source within a database
</data-source>
```

### Discussion Links

```markdown
<page-discussions>
Discussion references appear when fetching with include_discussions: true
Use discussion:// URLs with get_comments tool
</page-discussions>
```

## Color and Formatting

### Text Color

```markdown
{color="blue"}Blue text
{color="red"}Red text{color}
```

Available colors: default, gray, brown, orange, yellow, green, blue, purple, pink, red

### Background Color

```markdown
{background="yellow"}Highlighted text{background}
```

## Templates

When creating pages from templates:

1. Fetch the database to see available templates in `<templates>` section
2. Pass `template_id` to create-pages
3. Don't include `content` when using a template
4. Properties can still be set to override template defaults

```json
{
  "parent": {"data_source_id": "collection-uuid"},
  "pages": [
    {
      "template_id": "a5da15f6-b853-455d-8827-f906fb52db2b",
      "properties": {"Task Name": "New Task"}
    }
  ]
}
```

## Preserving Child Content

When using `replace_content`, preserve child pages and databases:

```markdown
# New Page Title

New content here.

<page url="https://notion.so/workspace/Child-Page-123">
</page>

<database url="https://notion.so/workspace/Database-456">
</database>
```

**Important**: If validation fails with "content would be deleted", set `allow_deleting_content: true` ONLY after confirming with the user. ALWAYS show the list of pages to be deleted and ask for confirmation first.

## Common Mistakes

1. **Don't include page title in content** — The `title` property appears automatically at the top
2. **Don't use database URL as page_id** — Use `data_source_id` for database parents
3. **Don't combine collection:// prefix with database ID** — Use one or the other
4. **Always preserve child pages** — Include `<page>` and `<database>` tags when replacing content
5. **Use exact property names** — Property names in database pages are case-sensitive; always fetch schema first