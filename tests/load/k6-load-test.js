/**
 * k6 Load Test — Allura Memory MCP HTTP Gateway
 *
 * Tests all major endpoints of the canonical HTTP gateway on port 3201.
 * Phase 9 benchmark: memory_add end-to-end latency < 200ms p95 at 100 concurrent agents.
 *
 * Usage:
 *   k6 run tests/load/k6-load-test.js
 *   BASE_URL=http://host:3201 ALLURA_MCP_AUTH_TOKEN=xxx k6 run tests/load/k6-load-test.js
 *
 * Or via runner:
 *   bun run load-test
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'k6/utils';

// ── Custom Metrics ────────────────────────────────────────────────────────────

const memoryAddDuration = new Trend('memory_add_duration', true);
const memorySearchDuration = new Trend('memory_search_duration', true);
const memoryGetDuration = new Trend('memory_get_duration', true);
const memoryListDuration = new Trend('memory_list_duration', true);
const mcpRequestDuration = new Trend('mcp_request_duration', true);
const errorRate = new Rate('errors');
const requestsTotal = new Counter('requests_total');

// ── Test Configuration ────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Smoke test: 1 VU, 1 iteration — validates endpoints are reachable
    smoke: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      tags: { test_type: 'smoke' },
      gracefulStop: '5s',
    },
    // Load test: ramp up to 100 VUs, hold, ramp down
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },   // Ramp up to 20
        { duration: '30s', target: 50 },   // Ramp up to 50
        { duration: '30s', target: 100 },  // Ramp up to 100 (Phase 9 target)
        { duration: '60s', target: 100 },  // Hold at 100 — sustained load
        { duration: '30s', target: 0 },    // Ramp down
      },
      tags: { test_type: 'load' },
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Phase 9 benchmark: memory_add p95 < 200ms
    memory_add_duration: ['p(95)<200', 'avg<100'],
    // memory_search p95 < 500ms
    memory_search_duration: ['p(95)<500'],
    // General HTTP p95 < 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate < 5%
    errors: ['rate<0.05'],
  },
};

// ── Environment ───────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3201';
const AUTH_TOKEN = __ENV.ALLURA_MCP_AUTH_TOKEN || '';
const GROUP_ID = 'allura-roninmemory';

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Generate common request headers.
 */
function getHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  return { ...headers, ...extra };
}

/**
 * Generate a unique memory content string for testing.
 */
function generateMemoryContent(vuId, iter) {
  const timestamp = Date.now();
  return `Load test memory VU=${vuId} iter=${iter} ts=${timestamp} rnd=${randomString(8)}`;
}

/**
 * Generate a unique user ID per VU to avoid collisions.
 */
function getUserId(vuId) {
  return `load-test-vu-${vuId}`;
}

// ── MCP Streamable HTTP Helpers ───────────────────────────────────────────────

/**
 * Send an MCP tool call via the Streamable HTTP transport.
 * The MCP Streamable HTTP spec uses POST /mcp with JSON-RPC 2.0 messages.
 */
function mcpToolCall(toolName, args, requestId = 1) {
  const payload = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = http.post(
    `${BASE_URL}/mcp`,
    JSON.stringify(payload),
    { headers: getHeaders() },
  );

  mcpRequestDuration.add(response.timings.duration);
  return response;
}

/**
 * Initialize an MCP session (POST /mcp with initialize method).
 */
function mcpInitialize(requestId = 0) {
  const payload = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: {
        name: 'k6-load-test',
        version: '1.0.0',
      },
    },
  };

  return http.post(
    `${BASE_URL}/mcp`,
    JSON.stringify(payload),
    { headers: getHeaders() },
  );
}

// ── Legacy JSON-RPC Helpers ───────────────────────────────────────────────────

/**
 * Call a tool via the legacy JSON-RPC endpoint.
 */
function legacyToolCall(toolName, args) {
  const payload = {
    name: toolName,
    arguments: args,
  };

  return http.post(
    `${BASE_URL}/tools/call`,
    JSON.stringify(payload),
    { headers: getHeaders() },
  );
}

// ── Test Functions ────────────────────────────────────────────────────────────

/**
 * Test health endpoint — should always return 200.
 */
function testHealth() {
  const response = http.get(`${BASE_URL}/health`);
  const passed = check(response, {
    'health status is 200': (r) => r.status === 200,
    'health body has status': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      } catch {
        return false;
      }
    },
    'health body has transports': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.transports);
      } catch {
        return false;
      }
    },
  });

  if (!passed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);
  return passed;
}

/**
 * Test readiness probe — checks PostgreSQL and Neo4j.
 */
function testReadiness() {
  const response = http.get(`${BASE_URL}/api/ready`);
  const passed = check(response, {
    'readiness status is 200 or 503': (r) => r.status === 200 || r.status === 503,
    'readiness body has ready field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.ready === 'boolean';
      } catch {
        return false;
      }
    },
  });

  if (!passed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);
  return passed;
}

/**
 * Test liveness probe — simple process heartbeat.
 */
function testLiveness() {
  const response = http.get(`${BASE_URL}/api/live`);
  const passed = check(response, {
    'liveness status is 200': (r) => r.status === 200,
    'liveness body has alive=true': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.alive === true;
      } catch {
        return false;
      }
    },
  });

  if (!passed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);
  return passed;
}

/**
 * Test Prometheus metrics endpoint.
 */
function testMetrics() {
  const response = http.get(`${BASE_URL}/api/metrics`, { headers: getHeaders() });
  const passed = check(response, {
    'metrics status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // If auth is required and we have a token, verify we get metrics
  if (AUTH_TOKEN && response.status === 200) {
    const hasContent = check(response, {
      'metrics has content': (r) => r.body && r.body.length > 0,
    });
    if (!hasContent) errorRate.add(1);
  }

  requestsTotal.add(1);
  return passed;
}

/**
 * Test memory_add via legacy JSON-RPC — the Phase 9 benchmark target.
 * Records custom metric: memory_add_duration.
 */
function testMemoryAdd(vuId, iter) {
  const content = generateMemoryContent(vuId, iter);
  const userId = getUserId(vuId);

  const args = {
    group_id: GROUP_ID,
    user_id: userId,
    content: content,
    metadata: {
      source: 'manual',
      agent_id: `k6-vu-${vuId}`,
    },
  };

  const startTime = Date.now();
  const response = legacyToolCall('memory_add', args);
  const duration = Date.now() - startTime;

  memoryAddDuration.add(duration);

  const passed = check(response, {
    'memory_add status is 200': (r) => r.status === 200,
    'memory_add returns result': (r) => {
      try {
        const body = JSON.parse(r.body);
        // Result may be wrapped in { content: [...] } or returned directly
        return body !== null && body !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!passed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);

  // Extract memory ID for subsequent get/delete operations
  let memoryId = null;
  try {
    const body = JSON.parse(response.body);
    // Handle both direct result and MCP-wrapped result
    if (body.id) {
      memoryId = body.id;
    } else if (body.content && Array.isArray(body.content)) {
      const textContent = body.content.find((c) => c.type === 'text');
      if (textContent) {
        const parsed = JSON.parse(textContent.text);
        memoryId = parsed.id || parsed.memory_id || null;
      }
    }
  } catch {
    // Non-critical — ID extraction is best-effort
  }

  return { passed, memoryId, content };
}

/**
 * Test memory_search via legacy JSON-RPC.
 * Records custom metric: memory_search_duration.
 */
function testMemorySearch(vuId, iter) {
  const userId = getUserId(vuId);

  const args = {
    query: `load test VU=${vuId}`,
    group_id: GROUP_ID,
    user_id: userId,
    limit: 5,
  };

  const startTime = Date.now();
  const response = legacyToolCall('memory_search', args);
  const duration = Date.now() - startTime;

  memorySearchDuration.add(duration);

  const passed = check(response, {
    'memory_search status is 200': (r) => r.status === 200,
    'memory_search returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body !== null && body !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!passed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);
  return passed;
}

/**
 * Test memory_get via legacy JSON-RPC.
 * Records custom metric: memory_get_duration.
 */
function testMemoryGet(memoryId) {
  if (!memoryId) return true; // Skip if no ID available

  const args = {
    id: memoryId,
    group_id: GROUP_ID,
  };

  const startTime = Date.now();
  const response = legacyToolCall('memory_get', args);
  const duration = Date.now() - startTime;

  memoryGetDuration.add(duration);

  const passed = check(response, {
    'memory_get status is 200': (r) => r.status === 200,
  });

  if (!passed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);
  return passed;
}

/**
 * Test memory_list via legacy JSON-RPC.
 * Records custom metric: memory_list_duration.
 */
function testMemoryList(vuId) {
  const userId = getUserId(vuId);

  const args = {
    group_id: GROUP_ID,
    user_id: userId,
    limit: 10,
  };

  const startTime = Date.now();
  const response = legacyToolCall('memory_list', args);
  const duration = Date.now() - startTime;

  memoryListDuration.add(duration);

  const passed = check(response, {
    'memory_list status is 200': (r) => r.status === 200,
  });

  if (!passed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);
  return passed;
}

/**
 * Test MCP Streamable HTTP endpoint (initialize + tool call).
 */
function testMcpStreamableHttp(vuId, iter) {
  // Step 1: Initialize MCP session
  const initResponse = mcpInitialize(iter * 1000 + vuId);
  const initPassed = check(initResponse, {
    'mcp initialize status is 200': (r) => r.status === 200,
  });

  if (!initPassed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);

  // Step 2: Call memory_search via MCP protocol
  const searchArgs = {
    query: `mcp test VU=${vuId}`,
    group_id: GROUP_ID,
    limit: 3,
  };

  const callResponse = mcpToolCall('memory_search', searchArgs, iter * 1000 + vuId + 1);
  const callPassed = check(callResponse, {
    'mcp tool call status is 200': (r) => r.status === 200,
  });

  if (!callPassed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);

  return initPassed && callPassed;
}

/**
 * Test curator proposals endpoint.
 */
function testCuratorProposals() {
  const response = http.get(
    `${BASE_URL}/api/curator/proposals?group_id=${GROUP_ID}`,
    { headers: getHeaders() },
  );

  const passed = check(response, {
    'curator proposals status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  if (!passed) {
    errorRate.add(1);
  }
  requestsTotal.add(1);
  return passed;
}

// ── Main Test Function ────────────────────────────────────────────────────────

export default function () {
  const vuId = __VU;
  const iter = __ITER;

  // ── Phase 1: Health & Probes (every iteration) ────────────────────────────
  testHealth();
  sleep(0.1);

  testLiveness();
  sleep(0.1);

  // Readiness check (includes DB checks — less frequent to avoid overload)
  if (iter % 5 === 0) {
    testReadiness();
  }

  // ── Phase 2: Memory Operations (primary benchmark) ───────────────────────
  // memory_add is the Phase 9 benchmark target: p95 < 200ms at 100 VUs
  const addResult = testMemoryAdd(vuId, iter);
  sleep(0.05);

  // memory_search after add — tests federated search
  testMemorySearch(vuId, iter);
  sleep(0.05);

  // memory_get — if we got an ID back
  testMemoryGet(addResult.memoryId);
  sleep(0.05);

  // memory_list — list user's memories
  testMemoryList(vuId);
  sleep(0.05);

  // ── Phase 3: MCP Streamable HTTP (every 3rd iteration) ───────────────────
  if (iter % 3 === 0) {
    testMcpStreamableHttp(vuId, iter);
  }

  // ── Phase 4: Metrics & Curator (every 10th iteration) ────────────────────
  if (iter % 10 === 0) {
    testMetrics();
    testCuratorProposals();
  }

  // Brief pause between iterations to simulate realistic agent behavior
  sleep(0.5);
}

// ── Setup & Teardown ──────────────────────────────────────────────────────────

export function setup() {
  console.log(`Allura Memory Load Test`);
  console.log(`========================`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth: ${AUTH_TOKEN ? 'Bearer token configured' : 'No auth token (dev mode)'}`);
  console.log(`Group ID: ${GROUP_ID}`);
  console.log(``);

  // Verify server is reachable before starting
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    console.error(`Server health check failed: ${healthResponse.status}`);
    console.error(`Make sure the server is running at ${BASE_URL}`);
    // Don't fail setup — let the test run and report failures
  } else {
    console.log(`Server is healthy. Starting load test...`);
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = ((Date.now() - data.startTime) / 1000).toFixed(1);
  console.log(``);
  console.log(`Load test completed in ${duration}s`);
  console.log(``);
  console.log(`Phase 9 Benchmark Thresholds:`);
  console.log(`  memory_add p95 < 200ms`);
  console.log(`  memory_search p95 < 500ms`);
  console.log(`  General HTTP p95 < 500ms`);
  console.log(`  Error rate < 5%`);
  console.log(``);
  console.log(`Check k6 output above for threshold results.`);
}

// ── Handle Summary ────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const summary = {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
    'tests/load/results/summary.json': JSON.stringify(data, null, 2),
  };

  // Also write a human-readable report
  const report = generateReport(data);
  summary['tests/load/results/load-test-report.txt'] = report;

  return summary;
}

function textSummary(data, options) {
  // Use k6's built-in summary if available, otherwise generate our own
  if (typeof __ENV !== 'undefined') {
    // k6 will handle the default summary output
    return '';
  }
  return JSON.stringify(data, null, 2);
}

function generateReport(data) {
  const lines = [];
  lines.push('Allura Memory Load Test Report');
  lines.push('================================');
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push(`Base URL: ${BASE_URL}`);
  lines.push(`Group ID: ${GROUP_ID}`);
  lines.push('');

  // HTTP metrics
  if (data.metrics && data.metrics.http_req_duration) {
    const httpDur = data.metrics.http_req_duration;
    lines.push('HTTP Request Duration:');
    lines.push(`  avg: ${httpDur.values.avg?.toFixed(2) || 'N/A'}ms`);
    lines.push(`  p95: ${httpDur.values['p(95)']?.toFixed(2) || 'N/A'}ms`);
    lines.push(`  p99: ${httpDur.values['p(99)']?.toFixed(2) || 'N/A'}ms`);
    lines.push('');
  }

  // Custom metrics
  if (data.metrics && data.metrics.memory_add_duration) {
    const addDur = data.metrics.memory_add_duration;
    lines.push('Memory Add Duration (Phase 9 Benchmark):');
    lines.push(`  avg: ${addDur.values.avg?.toFixed(2) || 'N/A'}ms`);
    lines.push(`  p95: ${addDur.values['p(95)']?.toFixed(2) || 'N/A'}ms`);
    lines.push(`  p99: ${addDur.values['p(99)']?.toFixed(2) || 'N/A'}ms`);
    lines.push(`  THRESHOLD: p95 < 200ms`);
    lines.push('');
  }

  if (data.metrics && data.metrics.memory_search_duration) {
    const searchDur = data.metrics.memory_search_duration;
    lines.push('Memory Search Duration:');
    lines.push(`  avg: ${searchDur.values.avg?.toFixed(2) || 'N/A'}ms`);
    lines.push(`  p95: ${searchDur.values['p(95)']?.toFixed(2) || 'N/A'}ms`);
    lines.push('');
  }

  // Threshold results
  if (data.thresholds) {
    lines.push('Threshold Results:');
    for (const [name, result] of Object.entries(data.thresholds)) {
      lines.push(`  ${name}: ${result.ok ? 'PASS' : 'FAIL'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}