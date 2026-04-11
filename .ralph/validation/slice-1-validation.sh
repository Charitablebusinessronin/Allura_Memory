#!/bin/bash
# Validation Slice 1 - Canonical API Proof
# Tests POST /api/memory in auto and soc2 modes

set -e

API_BASE="http://localhost:3100"
RESULTS_FILE=".ralph/validation/slice-1-results.md"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "# Validation Slice 1 Results" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "**Date:** $TIMESTAMP" >> "$RESULTS_FILE"
echo "**Slice:** Canonical API Proof" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Test 1: POST /api/memory in auto mode
echo "## Test V1-1: POST /api/memory (auto mode)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

echo "### Request:" >> "$RESULTS_FILE"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "allura-validation-test",
    "user_id": "test-user-001",
    "content": "Validation test memory at '"$TIMESTAMP"'",
    "metadata": {"test": "slice-1", "mode": "auto"}
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo '```json' >> "$RESULTS_FILE"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY" >> "$RESULTS_FILE"
echo '```' >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

echo "- **HTTP Status:** $HTTP_CODE" >> "$RESULTS_FILE"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "- **Status:** ✅ PASS" >> "$RESULTS_FILE"
  MEMORY_ID=$(echo "$BODY" | jq -r '.id // .memory_id // empty' 2>/dev/null)
  if [ -n "$MEMORY_ID" ]; then
    echo "- **Memory ID:** $MEMORY_ID" >> "$RESULTS_FILE"
  fi
else
  echo "- **Status:** ❌ FAIL" >> "$RESULTS_FILE"
fi

echo "" >> "$RESULTS_FILE"

# Test 2: POST with different content
echo "## Test V1-1b: POST /api/memory (second insert)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "allura-validation-test",
    "user_id": "test-user-001",
    "content": "Second validation memory '"$TIMESTAMP"'",
    "metadata": {"test": "slice-1", "sequence": 2}
  }')

HTTP_CODE2=$(echo "$RESPONSE2" | tail -1)
BODY2=$(echo "$RESPONSE2" | head -n -1)

echo '```json' >> "$RESULTS_FILE"
echo "$BODY2" | jq '.' 2>/dev/null || echo "$BODY2" >> "$RESULTS_FILE"
echo '```' >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

echo "- **HTTP Status:** $HTTP_CODE2" >> "$RESULTS_FILE"

if [ "$HTTP_CODE2" = "200" ] || [ "$HTTP_CODE2" = "201" ]; then
  echo "- **Status:** ✅ PASS" >> "$RESULTS_FILE"
else
  echo "- **Status:** ❌ FAIL" >> "$RESULTS_FILE"
fi

echo "" >> "$RESULTS_FILE"

# Test 3: GET /api/memory (list)
echo "## Test V1-2: GET /api/memory (list)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

RESPONSE3=$(curl -s -w "\n%{http_code}" "$API_BASE/api/memory?group_id=allura-validation-test&user_id=test-user-001")

HTTP_CODE3=$(echo "$RESPONSE3" | tail -1)
BODY3=$(echo "$RESPONSE3" | head -n -1)

echo '```json' >> "$RESULTS_FILE"
echo "$BODY3" | jq '.' 2>/dev/null || echo "$BODY3" >> "$RESULTS_FILE"
echo '```' >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

echo "- **HTTP Status:** $HTTP_CODE3" >> "$RESULTS_FILE"

if [ "$HTTP_CODE3" = "200" ]; then
  echo "- **Status:** ✅ PASS" >> "$RESULTS_FILE"
  COUNT=$(echo "$BODY3" | jq '.memories | length // 0' 2>/dev/null || echo "0")
  echo "- **Memories Returned:** $COUNT" >> "$RESULTS_FILE"
else
  echo "- **Status:** ❌ FAIL" >> "$RESULTS_FILE"
fi

echo "" >> "$RESULTS_FILE"

# Test 4: Error handling - missing group_id
echo "## Test V1-3: Error Handling (missing group_id)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

RESPONSE4=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-001",
    "content": "This should fail"
  }')

HTTP_CODE4=$(echo "$RESPONSE4" | tail -1)
BODY4=$(echo "$RESPONSE4" | head -n -1)

echo '```json' >> "$RESULTS_FILE"
echo "$BODY4" | jq '.' 2>/dev/null || echo "$BODY4" >> "$RESULTS_FILE"
echo '```' >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

echo "- **HTTP Status:** $HTTP_CODE4" >> "$RESULTS_FILE"

if [ "$HTTP_CODE4" = "400" ]; then
  echo "- **Status:** ✅ PASS (correctly rejected)" >> "$RESULTS_FILE"
else
  echo "- **Status:** ❌ FAIL (should return 400)" >> "$RESULTS_FILE"
fi

echo "" >> "$RESULTS_FILE"

# Summary
echo "---" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "## Summary" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "| Test | Status | HTTP Code |" >> "$RESULTS_FILE"
echo "|------|--------|-----------|" >> "$RESULTS_FILE"
echo "| V1-1 POST memory (auto) | $([ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] && echo '✅ PASS' || echo '❌ FAIL') | $HTTP_CODE |" >> "$RESULTS_FILE"
echo "| V1-1b POST memory (2nd) | $([ "$HTTP_CODE2" = "200" ] || [ "$HTTP_CODE2" = "201" ] && echo '✅ PASS' || echo '❌ FAIL') | $HTTP_CODE2 |" >> "$RESULTS_FILE"
echo "| V1-2 GET list | $([ "$HTTP_CODE3" = "200" ] && echo '✅ PASS' || echo '❌ FAIL') | $HTTP_CODE3 |" >> "$RESULTS_FILE"
echo "| V1-3 Error handling | $([ "$HTTP_CODE4" = "400" ] && echo '✅ PASS' || echo '❌ FAIL') | $HTTP_CODE4 |" >> "$RESULTS_FILE"

echo "" >> "$RESULTS_FILE"
echo "**Validation completed at:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$RESULTS_FILE"

# Exit with success if all tests passed
if [ "$HTTP_CODE" = "200" ] && [ "$HTTP_CODE2" = "200" ] && [ "$HTTP_CODE3" = "200" ] && [ "$HTTP_CODE4" = "400" ]; then
  echo ""
  echo "✅ ALL TESTS PASSED"
  exit 0
else
  echo ""
  echo "❌ SOME TESTS FAILED"
  exit 1
fi