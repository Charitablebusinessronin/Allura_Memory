/**
 * k6 Smoke Test — Quick validation that Allura endpoints respond
 *
 * Usage:
 *   k6 run k6/smoke-test.js
 *
 * This is a fast test (5 VUs, 10s) for CI validation.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4748';
const GROUP_ID = __ENV.GROUP_ID || 'allura-system';
const API_KEY = __ENV.API_KEY || 'dev-key-local';

export const options = {
  vus: 5,
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    errors: ['rate<0.2'],
  },
};

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/api/health`, { headers });
  check(healthRes, {
    'health responds': (r) => r.status === 200 || r.status === 503,
  }) || errorRate.add(1);

  // 2. Health metrics
  const metricsRes = http.get(`${BASE_URL}/api/health/metrics`, { headers });
  check(metricsRes, {
    'metrics responds': (r) => r.status === 200 || r.status === 503,
  }) || errorRate.add(1);

  // 3. Memory search
  const searchRes = http.post(`${BASE_URL}/api/memory/search`, JSON.stringify({
    query: 'smoke test',
    group_id: GROUP_ID,
    limit: 3,
  }), { headers });
  check(searchRes, {
    'search responds': (r) => r.status === 200,
  }) || errorRate.add(1);

  // 4. Memory add
  const addRes = http.post(`${BASE_URL}/api/memory/add`, JSON.stringify({
    group_id: GROUP_ID,
    user_id: 'k6-smoke-test',
    content: `Smoke test at ${new Date().toISOString()}`,
    metadata: { source: 'k6-smoke', vu: __VU },
  }), { headers });
  check(addRes, {
    'add responds': (r) => r.status === 200 || r.status === 201,
  }) || errorRate.add(1);
}