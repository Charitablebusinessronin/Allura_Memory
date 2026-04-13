/**
 * CORS Module — Public API
 *
 * Production-grade CORS configuration and middleware for Allura Memory.
 *
 * - Environment-driven allowlist (ALLURA_CORS_ORIGINS)
 * - Regex pattern support for dynamic origin validation
 * - Development mode (no origins configured = allow all)
 * - Preflight caching via Access-Control-Max-Age
 * - Credential support with proper browser handling
 */

export type { CorsConfig } from "./config";
export {
  loadCorsConfig,
  compileOriginValidator,
} from "./config";

export type { CorsResult, CorsResponse } from "./middleware";
export {
  applyCors,
  corsHeaders,
  getCorsConfig,
  resetCorsConfig,
  setCorsConfig,
  isPreflightRequest,
} from "./middleware";