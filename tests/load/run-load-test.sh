#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Allura Memory Load Test Runner
#
# Runs k6 load tests against the MCP HTTP gateway.
# Phase 9 benchmark: memory_add p95 < 200ms at 100 concurrent agents.
#
# Usage:
#   bun run load-test
#   BASE_URL=http://host:3201 ALLURA_MCP_AUTH_TOKEN=xxx bash tests/load/run-load-test.sh
#
# Prerequisites:
#   - k6 installed (https://k6.io/docs/get-started/install/)
#   - Allura Memory server running (bun run mcp:http)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Configuration ──────────────────────────────────────────────────────────────

BASE_URL="${BASE_URL:-http://localhost:3201}"
AUTH_TOKEN="${ALLURA_MCP_AUTH_TOKEN:-}"
GROUP_ID="${GROUP_ID:-allura-roninmemory}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="${RESULTS_DIR}/report-${TIMESTAMP}.txt"
JSON_RESULTS="${RESULTS_DIR}/summary-${TIMESTAMP}.json"

# ── Banner ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${CYAN}🧪 Allura Memory Load Test Runner${NC}"
echo -e "${BOLD}${CYAN}=================================${NC}"
echo ""

# ── Check k6 ──────────────────────────────────────────────────────────────────

if ! command -v k6 &>/dev/null; then
  echo -e "${RED}❌ k6 not found.${NC}"
  echo ""
  echo "Install k6:"
  echo "  macOS:  brew install k6"
  echo "  Linux:  https://k6.io/docs/get-started/install/linux/"
  echo "  Docker: docker pull grafana/k6:latest"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

K6_VERSION="$(k6 version 2>/dev/null || echo 'unknown')"
echo -e "${GREEN}✓ k6 found: ${K6_VERSION}${NC}"

# ── Check Server ──────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}Checking server at ${BASE_URL}...${NC}"

HEALTH_RESPONSE="$(curl -sf "${BASE_URL}/health" 2>/dev/null || echo 'FAILED')"

if [[ "${HEALTH_RESPONSE}" == "FAILED" ]]; then
  echo -e "${RED}❌ Server not running at ${BASE_URL}${NC}"
  echo ""
  echo "Start the server with:"
  echo "  bun run mcp:http"
  echo ""
  echo "Or set BASE_URL to a running instance:"
  echo "  BASE_URL=http://remote:3201 bash tests/load/run-load-test.sh"
  exit 1
fi

# Parse health response for status
HEALTH_STATUS="$(echo "${HEALTH_RESPONSE}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status","unknown"))' 2>/dev/null || echo 'unknown')"
echo -e "${GREEN}✓ Server is ${HEALTH_STATUS} at ${BASE_URL}${NC}"

# Show server info
TRANSPORTS="$(echo "${HEALTH_RESPONSE}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(", ".join(d.get("transports",[])))  ' 2>/dev/null || echo 'unknown')"
AUTH_ENABLED="$(echo "${HEALTH_RESPONSE}" | python3 -c 'import sys,json; print("yes" if json.load(sys.stdin).get("auth_enabled") else "no")' 2>/dev/null || echo 'unknown')"
echo -e "  Transports: ${TRANSPORTS}"
echo -e "  Auth enabled: ${AUTH_ENABLED}"

# ── Create Results Directory ──────────────────────────────────────────────────

mkdir -p "${RESULTS_DIR}"

# ── Run Load Test ──────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${BLUE}Running load test...${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"
echo ""

# Build k6 command
K6_CMD="k6 run"

# Pass environment variables to k6
K6_CMD="${K6_CMD} --env BASE_URL=${BASE_URL}"

if [[ -n "${AUTH_TOKEN}" ]]; then
  K6_CMD="${K6_CMD} --env ALLURA_MCP_AUTH_TOKEN=${AUTH_TOKEN}"
fi

# Output summary to JSON
K6_CMD="${K6_CMD} --summary-export=${JSON_RESULTS}"

# Output summary as text report
K6_CMD="${K6_CMD} --out json=${RESULTS_DIR}/raw-${TIMESTAMP}.json"

# Run the test script
K6_CMD="${K6_CMD} ${SCRIPT_DIR}/k6-load-test.js"

# Execute
echo -e "${CYAN}Command: ${K6_CMD}${NC}"
echo ""

# Run k6 — capture exit code
set +e
${K6_CMD}
K6_EXIT_CODE=$?
set -e

echo ""

# ── Process Results ───────────────────────────────────────────────────────────

if [[ -f "${JSON_RESULTS}" ]]; then
  echo -e "${BOLD}${BLUE}Processing results...${NC}"
  echo ""

  # Extract key metrics from JSON summary
  if command -v python3 &>/dev/null; then
    python3 - "${JSON_RESULTS}" <<'PYTHON' || true
import json
import sys

with open(sys.argv[1]) as f:
    data = json.load(f)

print("─" * 50)
print("📊 Load Test Results Summary")
print("─" * 50)

# HTTP metrics
http_dur = data.get("metrics", {}).get("http_req_duration", {})
if http_dur:
    values = http_dur.get("values", {})
    print(f"\n🌐 HTTP Request Duration:")
    print(f"   avg:  {values.get('avg', 0):.2f}ms")
    print(f"   p95:  {values.get('p(95)', 0):.2f}ms")
    print(f"   p99:  {values.get('p(99)', 0):.2f}ms")

# Custom metrics
for metric_name, label in [
    ("memory_add_duration", "Memory Add (Phase 9 Benchmark)"),
    ("memory_search_duration", "Memory Search"),
    ("memory_get_duration", "Memory Get"),
    ("memory_list_duration", "Memory List"),
    ("mcp_request_duration", "MCP Streamable HTTP"),
]:
    metric = data.get("metrics", {}).get(metric_name, {})
    if metric:
        values = metric.get("values", {})
        print(f"\n⚡ {label}:")
        print(f"   avg:  {values.get('avg', 0):.2f}ms")
        print(f"   p95:  {values.get('p(95)', 0):.2f}ms")
        print(f"   p99:  {values.get('p(99)', 0):.2f}ms")

# Error rate
errors = data.get("metrics", {}).get("errors", {})
if errors:
    values = errors.get("values", {})
    rate = values.get("rate", 0)
    print(f"\n❌ Error Rate: {rate*100:.2f}%")

# Threshold results
print(f"\n📋 Threshold Results:")
thresholds = data.get("thresholds", {})
all_passed = True
for name, result in thresholds.items():
    passed = result.get("ok", False)
    all_passed = all_passed and passed
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"   {status}  {name}")

print("")
if all_passed:
    print("🎉 All thresholds passed!")
else:
    print("⚠️  Some thresholds failed — review results above.")

# Write report
report_lines = []
report_lines.append(f"Allura Memory Load Test Report")
report_lines.append(f"{'=' * 50}")
report_lines.append(f"Date: {data.get('root_group', {}).get('name', 'unknown')}")
report_lines.append(f"Base URL: {data.get('state', {}).get('testRunDurationMs', 'unknown')}")
report_lines.append("")
for name, result in thresholds.items():
    passed = result.get("ok", False)
    status = "PASS" if passed else "FAIL"
    report_lines.append(f"[{status}] {name}")

with open(sys.argv[1].replace("summary-", "report-").replace(".json", ".txt"), "w") as f:
    f.write("\n".join(report_lines))
PYTHON
  else
    echo -e "${YELLOW}python3 not found — skipping detailed report generation${NC}"
    echo -e "${YELLOW}Raw results available at: ${JSON_RESULTS}${NC}"
  fi
fi

# ── Final Status ──────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${BLUE}─────────────────────────────────────────${NC}"
echo -e "${BOLD}Results saved to:${NC}"
echo -e "  ${RESULTS_DIR}/"
echo -e "  ├── summary-${TIMESTAMP}.json"
echo -e "  └── raw-${TIMESTAMP}.json"
echo ""

if [[ ${K6_EXIT_CODE} -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✅ Load test PASSED — all thresholds met${NC}"
else
  echo -e "${RED}${BOLD}❌ Load test FAILED — threshold violations detected${NC}"
  echo ""
  echo -e "${YELLOW}Review the results above for details.${NC}"
  echo -e "${YELLOW}Common causes:${NC}"
  echo "  - Server under-provisioned (increase CPU/memory)"
  echo "  - Database connection pool exhaustion"
  echo "  - Network latency between client and server"
  echo "  - Insufficient VU ramp-up time"
fi

echo ""
exit ${K6_EXIT_CODE}