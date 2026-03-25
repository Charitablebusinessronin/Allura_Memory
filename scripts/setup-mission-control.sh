#!/bin/bash
# Setup Mission Control for Ronin Memory
# Uses curl to interact with Mission Control API on ports 5420/5002

API_URL="http://localhost:5002"
TOKEN="5KsX6-7qREpWKrxUFpKP9NEFW2RP2ByjVP-xxG0EcsQDzIiqFgFAcfMfMoSfnNUal4E"

echo "🚀 Setting up Mission Control for Ronin Memory..."
echo ""

# Check if API is up
if ! curl -s "$API_URL/healthz" > /dev/null; then
    echo "❌ Mission Control API not responding at $API_URL"
    exit 1
fi

echo "✅ Mission Control API is up"
echo ""

# Get organization
echo "Fetching organization..."
ORG_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/organizations/me" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json")

ORG_ID=$(echo "$ORG_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
ORG_NAME=$(echo "$ORG_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name',''))")

if [ -z "$ORG_ID" ]; then
    echo "❌ No organization found"
    exit 1
fi

echo "✅ Organization: $ORG_NAME ($ORG_ID)"
echo ""

# Get board groups
echo "Fetching board groups..."
BG_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/board-groups?organization_id=$ORG_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json")

# Find research board group
BG_ID=$(echo "$BG_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('items',[]); bg=next((x for x in items if 'Research' in x.get('name','')), None); print(bg['id'] if bg else '')")
BG_NAME=$(echo "$BG_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('items',[]); bg=next((x for x in items if 'Research' in x.get('name','')), None); print(bg['name'] if bg else '')")

if [ -z "$BG_ID" ]; then
    echo "❌ Research Queue & ADAS Discoveries group not found"
    echo "Please create it manually in Mission Control UI"
    exit 1
fi

echo "✅ Board Group: $BG_NAME ($BG_ID)"
echo ""

# Create boards
echo "Creating boards..."

# Research Queue
RQ_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/boards" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Research Queue\",
        \"slug\": \"research-queue\",
        \"description\": \"Pending research tasks and discoveries awaiting processing\",
        \"board_type\": \"goal\",
        \"board_group_id\": \"$BG_ID\",
        \"require_approval_for_done\": true,
        \"max_agents\": 5
    }")

RQ_ID=$(echo "$RQ_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -n "$RQ_ID" ]; then
    echo "  ✅ Research Queue: $RQ_ID"
else
    echo "  ⚠️  Research Queue may already exist or error: $(echo "$RQ_RESPONSE" | head -100)"
fi

# ADAS Discoveries
AD_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/boards" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"ADAS Discoveries\",
        \"slug\": \"adas-discoveries\",
        \"description\": \"Automated Design of Agentic Systems - discovered agent designs\",
        \"board_type\": \"goal\",
        \"board_group_id\": \"$BG_ID\",
        \"require_approval_for_done\": true,
        \"max_agents\": 5
    }")

AD_ID=$(echo "$AD_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -n "$AD_ID" ]; then
    echo "  ✅ ADAS Discoveries: $AD_ID"
else
    echo "  ⚠️  ADAS Discoveries may already exist or error: $(echo "$AD_RESPONSE" | head -100)"
fi

echo ""

# Create gateway
echo "Connecting gateway..."
GW_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/gateways" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Ronin Memory Gateway\",
        \"endpoint_url\": \"http://openclaw-gateway:3002\",
        \"gateway_type\": \"mcp\",
        \"status\": \"active\"
    }")

GW_ID=$(echo "$GW_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -n "$GW_ID" ]; then
    echo "  ✅ Gateway: $GW_ID"
else
    echo "  ⚠️  Gateway may already exist or error: $(echo "$GW_RESPONSE" | head -100)"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Access Mission Control:"
echo "  Frontend: http://localhost:5420"
echo "  API: http://localhost:5002"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:5420"
echo "  2. Login with your token"
echo "  3. Go to Agents → New Agent"
echo "  4. Create agent from agents/ronin-researcher.yaml"
