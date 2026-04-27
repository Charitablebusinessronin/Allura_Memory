#!/usr/bin/env python3
"""
Fix Tailwind v4 className template literals by replacing dynamic token
interpolations with static CSS variable references.

Tailwind's JIT extractor cannot resolve JS expressions at build time, so
`text-[${tokens.color.primary.default}]` produces no CSS. Replacing with
`text-[var(--allura-blue)]` gives Tailwind a static pattern to match.
"""

import re
import sys
from pathlib import Path

TOKEN_MAP = {
    # color
    "tokens.color.primary.default":        "var(--allura-blue)",
    "tokens.color.primary.hover":          "var(--allura-blue-hover)",
    "tokens.color.secondary.default":      "var(--allura-orange)",
    "tokens.color.secondary.hover":        "var(--allura-orange-hover)",
    "tokens.color.success.default":        "var(--allura-green)",
    "tokens.color.success.hover":          "var(--allura-green-hover)",
    "tokens.color.surface.default":        "var(--allura-white)",
    "tokens.color.surface.subtle":         "var(--allura-cream)",
    "tokens.color.surface.muted":          "var(--allura-muted)",
    "tokens.color.border.subtle":          "var(--allura-border-1)",
    "tokens.color.border.default":         "var(--allura-border-2)",
    "tokens.color.text.primary":           "var(--allura-charcoal)",
    "tokens.color.text.secondary":         "var(--allura-text-2)",
    "tokens.color.text.muted":             "var(--allura-text-3)",
    "tokens.color.text.inverse":           "var(--allura-white)",
    "tokens.color.accent.gold":            "var(--allura-gold)",
    "tokens.color.accent.goldHover":       "var(--allura-gold-hover)",
    "tokens.color.accent.cream":           "var(--allura-cream)",
    "tokens.color.graph.agent":            "var(--allura-blue)",
    "tokens.color.graph.project":          "var(--allura-gold)",
    "tokens.color.graph.outcome":          "var(--allura-green)",
    "tokens.color.graph.event":            "var(--allura-charcoal)",
    "tokens.color.graph.insight":          "var(--allura-orange)",
    "tokens.color.graph.memory":           "var(--allura-text-3)",
    "tokens.color.graph.edge":             "var(--allura-text-3)",
    "tokens.color.graph.edgeHover":        "var(--allura-blue)",
    # spacing
    "tokens.spacing.xs":                 "var(--allura-xs)",
    "tokens.spacing.sm":                 "var(--allura-sm)",
    "tokens.spacing.md":                 "var(--allura-md)",
    "tokens.spacing.lg":                 "var(--allura-lg)",
    "tokens.spacing.xl":                 "var(--allura-xl)",
    "tokens.spacing.2xl":                "var(--allura-xxl)",
    "tokens.spacing.3xl":                "var(--allura-xxxl)",
    # borderRadius
    "tokens.borderRadius.sm":             "var(--allura-r-sm)",
    "tokens.borderRadius.md":             "var(--allura-r-md)",
    "tokens.borderRadius.lg":             "var(--allura-r-lg)",
    "tokens.borderRadius.full":            "var(--allura-r-full)",
    # shadow
    "tokens.shadow.sm":                   "var(--allura-sh-sm)",
    "tokens.shadow.md":                   "var(--allura-sh-md)",
    "tokens.shadow.lg":                   "var(--allura-sh-lg)",
    # typography
    "tokens.typography.fontFamily.sans":  "var(--font-family-brand)",
}

# Pattern: prefix[${tokens.path}]  →  prefix[var(--css-var)]
# Handles: text-[${...}], hover:bg-[${...}], focus-visible:ring-[${...}], etc.
RE_TOKEN = re.compile(
    r'((?:[\w:-]+)?)\[\$\{(' + '|'.join(re.escape(k) for k in TOKEN_MAP) + r')\}\]'
)

def replacer(match: re.Match) -> str:
    prefix = match.group(1)   # e.g. "text-", "hover:bg-", ""
    token_key = match.group(2)
    css_var = TOKEN_MAP[token_key]
    return f"{prefix}[{css_var}]"

def fix_file(path: Path) -> tuple[int, int]:
    text = path.read_text(encoding="utf-8")
    new_text, count = RE_TOKEN.subn(replacer, text)
    if count:
        path.write_text(new_text, encoding="utf-8")
    return count, len(RE_TOKEN.findall(text))

def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: fix-tailwind-tokens.py <file|dir>...")
        return 1

    total_replaced = 0
    total_remaining = 0

    for arg in sys.argv[1:]:
        p = Path(arg)
        if p.is_file():
            replaced, remaining = fix_file(p)
            total_replaced += replaced
            total_remaining += remaining
            print(f"  {p}: {replaced} replaced, {remaining} remaining")
        elif p.is_dir():
            for f in p.rglob("*.tsx"):
                replaced, remaining = fix_file(f)
                total_replaced += replaced
                total_remaining += remaining
                if replaced or remaining:
                    print(f"  {f}: {replaced} replaced, {remaining} remaining")
        else:
            print(f"  Skip: {p} (not found)")

    print(f"\nTotal: {total_replaced} replacements, {total_remaining} unmatched tokens")
    return 0 if total_remaining == 0 else 1

if __name__ == "__main__":
    raise SystemExit(main())
