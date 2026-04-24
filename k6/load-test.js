/**
 * k6 Load Test — Allura Memory API
 *
 * Tests: memory_add, memory_search, curator pipeline, health/metrics
 * Target: VU=100, duration=60s
 *
 * Usage:
 *   k6 run k6/load-test.js
 *   k6 run --vus 100 --duration 60s k6/load-test.js
 *
 * Reference: docs/allura/SPRINT-PLAN.md (RK-14)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const addLatency = new Trend('memory_add_latency', true);
const searchLatency = new Trend('memory_search_latency', true);
const curatorLatency = new Trend('curator_latency', true);
const metricsLatency = new Trend('health_metrics_latency', true);

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4748';
const GROUP_ID = __ENV.GROUP_ID || 'allura-system';
const API_KEY = __ENV.API_KEY || 'dev-key-local';

export const options = {
  stages: [
    { duration: '10s', target: 20 },   // Ramp up to 20 VUs
    { duration: '20s', target: 50 },    // Ramp up to 50 VUs
    { duration: '20s', target: 100 },   // Ramp up to 100 VUs
    { duration: '10s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(50)<500', 'p(95)<2000', 'p(99)<5000'],
    errors: ['rate<0.1'], // < 10% error rate
    memory_add_latency: ['p(95)<3000'],
    memory_search_latency: ['p(95)<2000'],
    health_metrics_latency: ['p(95)<1000'],
  },
  noConnectionReuse: false,
  userAgent: 'k6-allura-loadtest/1.0',
};

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

// Test data generator
function generateContent(vuId, iter) {
  const topics = ['architecture', 'governance', 'memory', 'pipeline', 'agent', 'curator', 'embedding', 'neo4j', 'postgres', 'skills'];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return `Load test VU${vuId}-iter${iter}: ${topic} insight at ${new Date().toISOString()}`;
}

export default function () {
  const vuId = __VU;
  const iter = __ITER;

  // ---- Scenario 1: memory_add (40% weight) ----
  if (Math.random() < 0.4) {
    const addPayload = JSON.stringify({
      group_id: GROUP_ID,
      user_id: `load-test-vu${vuId}`,
      content: generateContent(vuId, iter),
      metadata: {
        source: 'k6-loadtest',
        vu: vuId,
        iteration: iter,
      },
    });

    const addStart = Date.now();
    const addRes = http.post(`${BASE_URL}/api/memory/add`, addPayload, { headers });
    const addDuration = Date.now() - addStart;
    addLatency.add(addDuration);

    check(addRes, {
      'memory_add status 200': (r) => r.status === 200 || r.status === 201,
    }) || errorRate.add(1);

    if (addRes.status >= 400) {
      errorRate.add(1);
    }

    sleep(0.5);
  }

  // ---- Scenario 2: memory_search (30% weight) ----
  if (Math.random() < 0.3) {
    const searchPayload = JSON.stringify({
      query: `architecture governance memory agent ${vuId}`,
      group_id: GROUP_ID,
      limit: 5,
    });

    const searchStart = Date.now();
    const searchRes = http.post(`${BASE_URL}/api/memory/search`, searchPayload, { headers });
    const searchDuration = Date.now() - searchStart;
    searchLatency.add(searchDuration);

    check(searchRes, {
      'memory_search status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    if (searchRes.status >= 400) {
      errorRate.add(1);
    }

    sleep(0.3);
  }

  // ---- Scenario 3: health/metrics (15% weight) ----
  if (Math.random() < 0.15) {
    const metricsStart = Date.now();
    const metricsRes = http.get(`${BASE_URL}/api/health/metrics`, { headers });
    const metricsDuration = Date.now() - metricsStart;
    metricsLatency.add(metricsDuration);

    check(metricsRes, {
      'health_metrics status 200': (r) => r.status === 200 || r.status === 503,
    }) || errorRate.add(1);

    sleep(0.2);
  }

  // ---- Scenario 4: health (basic) (10% weight) ----
  if (Math.random() < 0.1) {
    const healthRes = http.get(`${BASE_URL}/api/health`, { headers });

    check(healthRes, {
      'health status ok': (r) => r.status === 200 || r.status === 503,
      'health has postgres': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.dependencies && body.dependencies.postgres;
        } catch { return false; }
      },
    }) || errorRate.add(1);

    sleep(0.2);
  }

  // ---- Scenario 5: curator proposals (5% weight) ----
  if (Math.random() < 0.05) {
    const curatorStart = Date.now();
    const proposalsRes = http.get(`${BASE_URL}/api/curator/proposals?group_id=${GROUP_ID}`, { headers });
    const curatorDuration = Date.now() - curatorStart;
    curatorLatency.add(curatorDuration);

    check(proposalsRes, {
      'curator_proposals status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(0.5);
  }

  sleep(Math.random() * 0.5); // Random think time
}

export function handleSummary(data) {
  const fmt = (val) => val !== undefined ? val.toFixed(2) : 'N/A';

  return {
    'stdout': `
╔══════════════════════════════════════════════════════════════════╗
║            Allura Memory — k6 Load Test Results                ║
╠══════════════════════════════════════════════════════════════════╣
║  Total Requests:  ${data.metrics.iterations ? data.metrics.iterations.values : 'N/A'}
║  Total Errors:    ${data.metrics.errors ? data.metrics.errors.values : 0}
║  Error Rate:      ${data.metrics.errors ? fmt(data.metrics.errors.values * 100 / data.metrics.http_reqs.values) : 'N/A'}%
╠══════════════════════════════════════════════════════════════════╣
║  HTTP Duration:                                                ║
║    p50:  ${fmt(data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(50)'] : undefined)}ms
║    p95:  ${fmt(data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : undefined)}ms
║    p99:  ${fmt(data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : undefined)}ms
╠══════════════════════════════════════════════════════════════════╣
║  memory_add:     p95=${fmt(data.metrics.memory_add_latency ? data.metrics.memory_add_latency.values['p(95)'] : undefined)}ms
║  memory_search:  p95=${fmt(data.metrics.memory_search_latency ? data.metrics.memory_search_latency.values['p(95)'] : undefined)}ms
║  health_metrics: p95=${fmt(data.metrics.health_metrics_latency ? data.metrics.health_metrics_latency.values['p(95)'] : undefined)}ms
║  curator:        p95=${fmt(data.metrics.curator_latency ? data.metrics.curator_latency.values['p(95)'] : undefined)}ms
╚══════════════════════════════════════════════════════════════════╝
`,
    'k6/load-test-results.json': JSON.stringify(data, null, 2),
  };
}