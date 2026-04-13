/**
 * @allura/sdk — Auth helpers
 *
 * Bearer token management for Allura Memory authentication.
 */

// ── Token Resolution ────────────────────────────────────────────────────────

/**
 * Resolve an auth token from multiple sources.
 *
 * Priority:
 * 1. Explicit token passed to AlluraClient
 * 2. ALLURA_AUTH_TOKEN environment variable
 * 3. ALLURA_MCP_AUTH_TOKEN environment variable
 * 4. No auth (development mode — server will accept requests without token)
 *
 * @param explicitToken - Token passed directly to the client
 * @returns The resolved token, or undefined if no auth is configured
 */
export function resolveAuthToken(explicitToken?: string): string | undefined {
  if (explicitToken) {
    return explicitToken;
  }

  // Check environment variables (only in Node.js/Bun runtimes)
  if (typeof process !== "undefined" && process.env) {
    const envToken =
      process.env.ALLURA_AUTH_TOKEN || process.env.ALLURA_MCP_AUTH_TOKEN;
    if (envToken) {
      return envToken;
    }
  }

  return undefined;
}

/**
 * Validate that an auth token is present when required.
 *
 * @param token - The resolved token
 * @param required - Whether auth is required
 * @throws {Error} if auth is required but no token is available
 */
export function requireAuthToken(token: string | undefined, required: boolean): void {
  if (required && !token) {
    throw new Error(
      "Authentication required: No Bearer token provided. " +
        "Set ALLURA_AUTH_TOKEN or pass authToken to AlluraClient."
    );
  }
}

/**
 * Create an Authorization header value from a token.
 *
 * @param token - The auth token
 * @returns "Bearer <token>" header value, or undefined if no token
 */
export function createAuthHeader(token?: string): string | undefined {
  if (!token) return undefined;
  return `Bearer ${token}`;
}