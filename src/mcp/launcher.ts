#!/usr/bin/env bun
/**
 * MCP Server Launcher - Resolves TypeScript path aliases
 * 
 * This wrapper ensures proper module resolution for @/* aliases
 * when running the MCP server directly with Bun.
 */

import { plugin, type BunPlugin } from "bun"

// Define path resolution plugin
const pathAliasPlugin: BunPlugin = {
  name: "path-alias-resolver",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const path = args.path.replace(/^@\//, `${import.meta.dir}/../`)
      return { path, namespace: "file" }
    })
  },
}

plugin(pathAliasPlugin)

await import("./memory-server-canonical")
