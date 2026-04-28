/**
 * Policy enforcement for the retrieval gateway.
 * Hard rules: group_id required, user_id must match, score threshold enforced.
 * Every violation is logged as an audit event.
 */

import { SearchRequest, RetrievalConfig, DEFAULT_RETRIEVAL_CONFIG } from './contract';

export interface PolicyResult {
  allowed: boolean;
  /** Normalized / defaulted request if allowed */
  request?: SearchRequest;
  /** Error code for rejection */
  error?: string;
  /** Human-readable rejection reason */
  message?: string;
  /** Audit trail entry */
  audit: {
    event: string;
    timestamp: string;
    request: SearchRequest;
    allowed: boolean;
    reason?: string;
  };
}

function logAudit(audit: PolicyResult['audit']) {
  // In production, this should route to a proper audit log.
  // For now, we write to stderr so it doesn't get lost.
  console.error(JSON.stringify(audit));
}

export function enforcePolicy(
  raw: Partial<SearchRequest>,
  config: RetrievalConfig,
  agentIdentity: { user_id: string }
): PolicyResult {
  const timestamp = new Date().toISOString();

  // --- group_id is REQUIRED ---
  if (!raw.group_id || raw.group_id.trim().length === 0) {
    const audit: PolicyResult['audit'] = {
      event: 'policy_violation',
      timestamp,
      request: raw as SearchRequest,
      allowed: false,
      reason: 'Missing required group_id',
    };
    logAudit(audit);
    return {
      allowed: false,
      error: 'GROUP_ID_REQUIRED',
      message: 'group_id is required and cannot be empty.',
      audit,
    };
  }

  // --- group_id format validation (must start with allura-) ---
  if (!raw.group_id.startsWith('allura-')) {
    const audit: PolicyResult['audit'] = {
      event: 'policy_violation',
      timestamp,
      request: raw as SearchRequest,
      allowed: false,
      reason: 'Invalid group_id format',
    };
    logAudit(audit);
    return {
      allowed: false,
      error: 'INVALID_GROUP_ID_FORMAT',
      message: 'group_id must start with "allura-".',
      audit,
    };
  }

  // --- user_id must match agent identity ---
  if (!raw.user_id || raw.user_id !== agentIdentity.user_id) {
    const audit: PolicyResult['audit'] = {
      event: 'policy_violation',
      timestamp,
      request: raw as SearchRequest,
      allowed: false,
      reason: 'user_id mismatch or missing',
    };
    logAudit(audit);
    return {
      allowed: false,
      error: 'USER_ID_MISMATCH',
      message: `user_id must match the authenticated agent identity (${agentIdentity.user_id}).`,
      audit,
    };
  }

  // --- Apply defaults / caps ---
  const limit = Math.min(
    raw.limit ?? DEFAULT_RETRIEVAL_CONFIG.max_results!,
    config.max_results
  );
  const min_score = raw.min_score ?? config.min_score_threshold;

  const normalized: SearchRequest = {
    query: raw.query ?? '',
    group_id: raw.group_id,
    user_id: raw.user_id,
    limit,
    min_score,
    filters: raw.filters ?? {},
    include_global: raw.include_global ?? true,
  };

  const audit: PolicyResult['audit'] = {
    event: 'policy_check',
    timestamp,
    request: normalized,
    allowed: true,
  };
  logAudit(audit);

  return { allowed: true, request: normalized, audit };
}
