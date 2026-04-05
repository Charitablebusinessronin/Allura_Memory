/**
 * Port Configuration for Allura Memory
 * 
 * Uses randomized ports to avoid conflicts with other services.
 * Ports are assigned from specific ranges to prevent collisions.
 */

import { randomInt } from "crypto";

/**
 * Port ranges for different services
 * 
 * - Paperclip (Next.js): 3100-3199
 * - OpenClaw Gateway (MCP): 3200-3299
 * - PostgreSQL: 5432 (standard, configurable)
 * - Neo4j HTTP: 7474 (standard, configurable)
 * - Neo4j Bolt: 7687 (standard, configurable)
 * - Dozzle (logs): 8088 (standard, configurable)
 */
export const PORT_RANGES = {
  paperclip: { min: 3100, max: 3199, default: 3100 },
  openclaw: { min: 3200, max: 3299, default: 3200 },
  postgres: { min: 5400, max: 5499, default: 5432 },
  neo4j_http: { min: 7470, max: 7479, default: 7474 },
  neo4j_bolt: { min: 7680, max: 7689, default: 7687 },
  dozzle: { min: 8080, max: 8089, default: 8088 },
} as const;

/**
 * Generate a random port within a range
 */
function getRandomPort(min: number, max: number): number {
  return randomInt(min, max + 1);
}

/**
 * Get port from environment or generate random
 */
export function getPort(
  serviceName: keyof typeof PORT_RANGES,
  envVar?: string
): number {
  // Check environment variable first
  if (envVar) {
    const envPort = process.env[envVar];
    if (envPort) {
      const port = parseInt(envPort, 10);
      if (!isNaN(port) && port >= 1 && port <= 65535) {
        return port;
      }
    }
  }

  // Check NEXT_PUBLIC_APP_URL for Paperclip
  if (serviceName === "paperclip") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const urlPort = new URL(appUrl).port;
      if (urlPort) {
        return parseInt(urlPort, 10);
      }
    }
  }

  // Use PORT environment variable if set
  const port = process.env.PORT;
  if (port) {
    const portNum = parseInt(port, 10);
    if (!isNaN(portNum) && portNum >= 1 && portNum <= 65535) {
      return portNum;
    }
  }

  // Generate random port from range
  const range = PORT_RANGES[serviceName];
  return getRandomPort(range.min, range.max);
}

/**
 * Port configuration object
 */
export interface PortConfig {
  paperclip: number;
  openclaw: number;
  postgres: number;
  neo4j_http: number;
  neo4j_bolt: number;
  dozzle: number;
}

/**
 * Get all port configurations
 */
export function getPortConfig(randomize: boolean = false): PortConfig {
  return {
    paperclip: randomize 
      ? getRandomPort(PORT_RANGES.paperclip.min, PORT_RANGES.paperclip.max)
      : getPort("paperclip", "PAPERCLIP_PORT"),
    openclaw: randomize
      ? getRandomPort(PORT_RANGES.openclaw.min, PORT_RANGES.openclaw.max)
      : getPort("openclaw", "OPENCLAW_PORT"),
    postgres: getPort("postgres", "POSTGRES_PORT"),
    neo4j_http: getPort("neo4j_http", "NEO4J_HTTP_PORT"),
    neo4j_bolt: getPort("neo4j_bolt", "NEO4J_BOLT_PORT"),
    dozzle: getPort("dozzle", "DOZZLE_PORT"),
  };
}

/**
 * Get URLs for services
 */
export function getServiceUrls(ports?: Partial<PortConfig>): {
  paperclip: string;
  openclaw: string;
  postgres: string;
  neo4j_http: string;
  neo4j_bolt: string;
  dozzle: string;
} {
  const config = ports ? { ...getPortConfig(), ...ports } : getPortConfig();
  
  return {
    paperclip: `http://localhost:${config.paperclip}`,
    openclaw: `http://localhost:${config.openclaw}`,
    postgres: `postgresql://${process.env.POSTGRES_USER || "ronin4life"}:${process.env.POSTGRES_PASSWORD || "password"}@localhost:${config.postgres}/${process.env.POSTGRES_DB || "memory"}`,
    neo4j_http: `http://localhost:${config.neo4j_http}`,
    neo4j_bolt: `bolt://localhost:${config.neo4j_bolt}`,
    dozzle: `http://localhost:${config.dozzle}`,
  };
}

/**
 * Environment variable names for ports
 */
export const PORT_ENV_VARS = {
  paperclip: "PAPERCLIP_PORT",
  openclaw: "OPENCLAW_PORT",
  postgres: "POSTGRES_PORT",
  neo4j_http: "NEO4J_HTTP_PORT",
  neo4j_bolt: "NEO4J_BOLT_PORT",
  dozzle: "DOZZLE_PORT",
} as const;

/**
 * Generate .env entries for ports
 */
export function generateEnvEntries(randomize: boolean = false): string {
  const config = getPortConfig(randomize);
  
  return `
# =============================================================================
# Service Ports (auto-generated)
# =============================================================================
PAPERCLIP_PORT=${config.paperclip}
OPENCLAW_PORT=${config.openclaw}
POSTGRES_PORT=${config.postgres}
NEO4J_HTTP_PORT=${config.neo4j_http}
NEO4J_BOLT_PORT=${config.neo4j_bolt}
DOZZLE_PORT=${config.dozzle}

# Derived URLs
NEXT_PUBLIC_APP_URL=http://localhost:${config.paperclip}
OPENCLAW_GATEWAY_URL=http://localhost:${config.openclaw}
`.trim();
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = require("net").createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

/**
 * Find an available port in a range
 */
export async function findAvailablePort(
  min: number,
  max: number,
  maxAttempts: number = 10
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = getRandomPort(min, max);
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${min}-${max} after ${maxAttempts} attempts`);
}