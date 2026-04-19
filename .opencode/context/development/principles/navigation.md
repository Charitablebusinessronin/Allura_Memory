<!-- Context: development/principles | Priority: critical | Version: 2.0 | Updated: 2026-04-19 -->

# Development Principles Navigation

**Purpose**: Universal development principles (language-agnostic)

**Status**: ✅ Active - Brooksian principles applied

---

## Core Principles

| Principle | Source | Application |
|-------------|--------|-------------|
| **Conceptual Integrity** | Brooks | Single architect owns design |
| **No Silver Bullet** | Brooks | Distinguish essential vs accidental complexity |
| **Brooks's Law** | Brooks | Communication overhead grows as n(n-1)/2 |
| **Surgical Team** | Brooks | Specialized roles, not interchangeable |
| **Separation of Concerns** | Dijkstra | Architecture defines what, implementation defines how |

---

## Available Guides

| File | Topic | Priority | Load When |
|------|-------|----------|-----------|
| `clean-code.md` | Clean code practices | ⭐⭐⭐⭐ | Writing any code |
| `api-design.md` | API design principles | ⭐⭐⭐⭐ | Designing APIs |

---

## Loading Strategy

**For general development**:
1. Load `clean-code.md` (high)
2. Also load: `../../core/standards/code-quality.md` (critical)

**For API development**:
1. Load `api-design.md` (high)
2. Also load: `../../core/standards/code-quality.md` (critical)
3. Reference: `../backend/navigation.md`

---

## Scope Hierarchy

| Location | Scope | Examples |
|----------|-------|----------|
| `core/standards/` | **Universal** (all projects) | Code quality, testing, docs, security |
| `development/principles/` | **Development-specific** | Clean code, API design, error handling |
| `development/{backend,frontend}/` | **Tech-specific** | Framework patterns, libraries |

---

## Related

- **Core Standards** → `../../core/standards/navigation.md`
- **Backend** → `../backend/navigation.md`
- **Frontend** → `../frontend/navigation.md`
- **Data** → `../data/navigation.md`
