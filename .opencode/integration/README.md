# @allura/opencode-plugin

Allura Memory Engine plugin for OpenCode. One-click install for persistent AI memory with curator-gated knowledge promotion.

## Installation

```bash
npm install @allura/opencode-plugin
```

That's it. OpenCode will automatically discover and load the plugin.

## What It Does

Gives OpenCode native access to **three memory tools**:

- **memory_retrieve(query)** — Search your episodic (raw) and semantic (approved) memories
- **memory_write(event, metadata)** — Log observations and events
- **memory_propose_insight(title, statement)** — Propose insights for curator approval

## Usage

Just ask OpenCode:

```
What coding patterns do I use?
```

OpenCode will:
1. Call `memory_retrieve("coding patterns")`
2. Get back your remembered facts
3. Include them in the response

Or manually log:

```
/memory write "Just discovered I prefer functional composition"
```

## Configuration

**No configuration needed by default.** The plugin connects to `http://localhost:3100/mcp`.

To use a remote server:

```bash
export ALLURA_MCP_URL=https://allura.example.com/mcp
export ALLURA_API_KEY=your_api_key
opencode
```

## Architecture

The plugin is thin (~50 lines). It just registers the Allura MCP server with OpenCode. The real work happens in the server:

- **PostgreSQL** — Raw traces (episodic memory)
- **Neo4j** — Approved facts (semantic memory)
- **Curator workflow** — Human approval for promotion

## Troubleshooting

**"Failed to load Allura plugin"**

Make sure the Allura MCP server is running:

```bash
# In another terminal
cd /path/to/allura
bun run api
```

Then restart OpenCode.

**"Memory server returned an error"**

Check your API key if using remote:

```bash
export ALLURA_API_KEY=...
opencode
```

## Documentation

- **PERSONAL-OS.md** — Full architecture guide
- **CLAUDE-CODE-INTEGRATION.md** — How memory tools work
- **INTEGRATION-PLAN.md** — Plugin implementation details

## License

MIT
