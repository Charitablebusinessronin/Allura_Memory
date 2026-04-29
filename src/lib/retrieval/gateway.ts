/**
 * Retrieval Gateway — the single entry point for memory search.
 * Wraps the existing raw memory_search with:
 *   • typed contract
 *   • lazy startup validation
 *   • policy enforcement
 *   • graceful degradation
 */

import {
  SearchRequest,
  SearchResponse,
  MemoryResult,
  RetrievalConfig,
  DEFAULT_RETRIEVAL_CONFIG,
} from './contract';
import { validateStartup, StartupReport } from './startup-validator';
import { enforcePolicy, PolicyResult } from './policy';
import { isCompatibleVersion, CURRENT_SCHEMA_VERSION } from '../schema-version';

let startupValidated = false;

export interface RetrievalGateway {
  search(req: Partial<SearchRequest>): Promise<SearchResponse>;
  health(): Promise<StartupReport>;
}

export function createRetrievalGateway(
  config: RetrievalConfig,
  agentIdentity: { user_id: string }
): RetrievalGateway {
  async function ensureStartup(): Promise<StartupReport> {
    const report = await validateStartup(config);
    startupValidated = report.healthy;
    return report;
  }

  async function rawMemorySearch(normalized: SearchRequest): Promise<MemoryResult[]> {
    // We delegate to the existing memory_search tool by shelling to the CLI.
    // In a real deployment this would be an internal API call.
    // For now we use a mock-compatible path that the test can override.
    const { execSync } = await import('child_process');
    const payload = JSON.stringify({
      query: normalized.query,
      group_id: normalized.group_id,
      user_id: normalized.user_id,
      limit: normalized.limit,
      min_score: normalized.min_score,
      include_global: normalized.include_global,
    });
    const out = execSync(
      `echo '${payload.replace(/'/g, "'\"")}' | bun run src/tools/memory_search_cli.ts`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    const parsed = JSON.parse(out);
    return (parsed.results ?? []).map((r: any) => ({
      id: r.id ?? '',
      content: r.content ?? '',
      score: r.score ?? 0,
      source: r.source ?? 'merged',
      group_id: r.group_id ?? normalized.group_id,
      user_id: r.user_id ?? normalized.user_id,
      metadata: r.metadata,
      created_at: r.created_at,
      schema_version: r.schema_version ?? CURRENT_SCHEMA_VERSION,
    }));
  }

  return {
    async health() {
      return ensureStartup();
    },

    async search(req) {
      const start = performance.now();
      const warnings: string[] = [];
      let degraded = false;

      // 1. Startup validation (lazy, cached)
      let report: StartupReport;
      try {
        report = await ensureStartup();
      } catch (e: any) {
        const latency_ms = Math.round(performance.now() - start);
        return {
          results: [],
          total: 0,
          degraded: true,
          warnings: [`Startup validation failed: ${e.message}`],
          latency_ms,
          version: config.version,
        };
      }

      if (!report.healthy) {
        degraded = true;
        warnings.push('Startup validation did not pass. Proceeding in degraded mode.');
        warnings.push(...report.checks.filter((c) => c.status !== 'pass').map((c) => `${c.name}: ${c.message}`));
      }

      // 2. Policy enforcement
      const policy = enforcePolicy(req, config, agentIdentity);
      if (!policy.allowed) {
        const latency_ms = Math.round(performance.now() - start);
        return {
          results: [],
          total: 0,
          degraded: true,
          warnings: [policy.message ?? 'Policy rejection'],
          latency_ms,
          version: config.version,
        };
      }
      const normalized = policy.request!;

      // 3. Execute search with graceful degradation
      let results: MemoryResult[] = [];
      try {
        results = await rawMemorySearch(normalized);
      } catch (e: any) {
        degraded = true;
        warnings.push(`Search execution failed: ${e.message}`);
      }

      // 4. Schema version compatibility validation on read
      // Check each result's schema_version — flag incompatible data
      for (const result of results) {
        const sv = result.schema_version ?? CURRENT_SCHEMA_VERSION; // default for legacy data
        const compat = isCompatibleVersion(sv);
        if (!compat.compatible) {
          degraded = true;
          warnings.push(`Memory ${result.id} has incompatible schema version ${sv}: ${compat.reason}`);
        }
        // Update the schema_version to the actual value (or default for legacy)
        result.schema_version = sv;
      }

      const latency_ms = Math.round(performance.now() - start);
      return {
        results,
        total: results.length,
        degraded,
        warnings,
        latency_ms,
        version: config.version,
        schema_version: CURRENT_SCHEMA_VERSION,
      };
    },
  };
}
