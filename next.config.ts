import withBundleAnalyzer from "@next/bundle-analyzer"
import { type NextConfig } from "next"

import { env } from "./env.mjs"

const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // RuVix kernel initialization
  experimental: {
    instrumentationHook: true,
  },

  serverRuntimeConfig: {
    ruVixKernelEnabled: true,
  },

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Health check aliases
  rewrites: async () => [
    { source: "/healthz", destination: "/api/health/live" },
    { source: "/api/healthz", destination: "/api/health/live" },
    { source: "/health", destination: "/api/health/live" },
    { source: "/ping", destination: "/api/health/live" },
  ],
}

export default env.ANALYZE ? withBundleAnalyzer({ enabled: env.ANALYZE })(config) : config
