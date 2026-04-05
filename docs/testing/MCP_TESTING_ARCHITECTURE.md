# MCP Testing Architecture

> **Complete testing strategy using MCP Docker servers for browser automation and Next.js integration**

## Overview

This document defines the complete 4-layer testing architecture for the Allura Memory system, leveraging MCP Docker servers for visual and behavioral testing without local Playwright installation.

## Testing Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Visual/Behavioral Tests (MCP Playwright)            │
│ - Browser automation via MCP_DOCKER                          │
│ - Screenshots for AI-powered comparison                      │
│ - Console error detection                                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Integration Tests (E2E)                            │
│ - Docker-based full stack testing                            │
│ - Database integration (PostgreSQL + Neo4j)                  │
│ - API endpoint validation                                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Component/Unit Tests (Vitest)                      │
│ - 116+ tests across kernel, agents, utilities                │
│ - Fast feedback loop (< 1s per test file)                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Static Analysis                                      │
│ - TypeScript type checking                                   │
│ - ESLint for code quality                                    │
│ - Import/order validation                                      │
└─────────────────────────────────────────────────────────────┘
```

## MCP Testing Tools Available

### Browser Automation (Playwright MCP Server)

| Tool | Purpose | Example Use Case |
|------|---------|------------------|
| `browser_navigate` | Visit pages | Load dashboard at `/dashboard/paperclip` |
| `browser_click` | Interact with UI | Click "Approvals" tab |
| `browser_type` | Fill forms | Enter search query |
| `browser_take_screenshot` | Visual regression | Capture dashboard state |
| `browser_evaluate` | Run JS assertions | Check React component state |
| `browser_wait_for` | Wait for elements | Wait for "Pending Approvals" to appear |
| `browser_console_messages` | Error detection | Verify no console errors |
| `browser_get_page_content` | Content extraction | Verify text content |

### Next.js Integration (Next DevTools MCP)

| Tool | Purpose | Example Use Case |
|------|---------|------------------|
| `nextjs_runtime` | Query Next.js internals | Check build info |
| `nextjs_docs` | Documentation lookup | Verify API usage |

## Quick Start Commands

### Run All Tests

```bash
# Layer 1: Static Analysis
bun run typecheck
bun run lint

# Layer 2: Unit Tests (116+ tests)
bun test

# Layer 3: E2E Integration
bun run test:e2e

# Layer 4: MCP Browser Tests (via MCP_DOCKER)
bun run test:mcp:browser
```

### Run Specific Test Categories

```bash
# Kernel tests only
bun vitest run src/kernel/

# Agent tests only
bun vitest run src/agents/

# Session stability tests
bun vitest run src/lib/session/

# MCP integration tests
bun vitest run tests/mcp/
```

### Single Test Commands

```bash
# Single file
bun vitest run src/lib/postgres/connection.test.ts

# Single test by name
bun vitest run -t "should build connection config"

# Watch mode for development
bun run test:watch
```

## MCP Browser Test Workflow

### 1. Navigate and Screenshot

```typescript
// Navigate to dashboard
await browser_navigate({ url: "http://localhost:3000/dashboard/paperclip" });

// Take baseline screenshot
await browser_take_screenshot({
  filename: "dashboard-baseline.png",
  fullPage: true
});
```

### 2. Interact and Verify

```typescript
// Click Approvals tab
await browser_click({ ref: "approval-tab" });

// Wait for content to load
await browser_wait_for({ text: "Pending Approvals" });

// Take comparison screenshot
await browser_take_screenshot({
  filename: "approvals-tab.png",
  fullPage: true
});
```

### 3. Error Detection

```typescript
// Check console for errors
const errors = await browser_console_messages({ level: "error" });
expect(errors).toHaveLength(0);

// Check for warnings too
const warnings = await browser_console_messages({ level: "warning" });
console.log("Warnings:", warnings);
```

### 4. Responsive Testing

```typescript
// Test mobile viewport
await browser_evaluate({
  script: "window.resizeTo(375, 667)"
});

await browser_take_screenshot({
  filename: "dashboard-mobile.png",
  fullPage: true
});
```

## Test File Organization

```
tests/
├── mcp/
│   ├── browser/
│   │   ├── dashboard.test.ts      # Dashboard visual tests
│   │   ├── approvals.test.ts      # Approval workflow tests
│   │   ├── responsive.test.ts     # Mobile/tablet tests
│   │   └── accessibility.test.ts  # A11y checks
│   ├── integration/
│   │   └── nextjs-runtime.test.ts # Next.js integration
│   └── fixtures/
│       └── screenshots/             # Baseline screenshots
├── unit/                          # Traditional unit tests
└── e2e/                          # Docker-based E2E tests
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: MCP Testing Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install dependencies
        run: bun install
        
      - name: Type check
        run: bun run typecheck
        
      - name: Lint
        run: bun run lint
        
      - name: Unit tests
        run: bun test
        
      - name: E2E tests
        run: bun run test:e2e
        
      - name: MCP browser tests
        run: bun run test:mcp:browser
```

## Environment Requirements

### Local Development

```bash
# Required environment variables
cp .env.example .env.local

# Key variables for testing
NEXT_PUBLIC_APP_URL=http://localhost:3000
POSTGRES_URL=postgresql://...
NEO4J_URI=bolt://localhost:7687
```

### MCP Docker Configuration

Ensure MCP Docker servers are running:

```bash
# Check MCP Docker status
mcp_docker_status

# Required servers for testing:
# - playwright (browser automation)
# - next-devtools-mcp (Next.js integration)
```

## Debugging Failed Tests

### Browser Test Debugging

```bash
# Run with verbose output
DEBUG=mcp:* bun run test:mcp:browser

# Keep browser open after test
KEEP_BROWSER_OPEN=true bun run test:mcp:browser

# Screenshot on failure (automatic)
# Screenshots saved to: tests/mcp/fixtures/screenshots/failed/
```

### Common Issues

| Issue | Solution |
|-------|----------|
| CSS import errors | Check `globals.css` imports match installed packages |
| MCP server not found | Verify MCP Docker is running: `mcp_docker_status` |
| Screenshot mismatches | Update baselines: `bun run test:mcp:browser --update` |
| Timeout errors | Increase timeout in vitest.config.ts |

## Success Criteria

All tests must pass before merging:

- [ ] TypeScript compilation (`bun run typecheck`)
- [ ] ESLint validation (`bun run lint`)
- [ ] Unit tests (116+ tests, `bun test`)
- [ ] E2E integration tests (`bun run test:e2e`)
- [ ] MCP browser tests (`bun run test:mcp:browser`)
- [ ] No console errors in browser tests
- [ ] Visual regression within 5% threshold

## References

- [MCP Docker Documentation](https://github.com/mcp-docker/mcp-docker)
- [Playwright MCP Server](https://github.com/microsoft/playwright-mcp)
- [Next.js DevTools MCP](https://github.com/vercel/next-devtools-mcp)
- [Vitest Documentation](https://vitest.dev/)
