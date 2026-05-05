#!/bin/bash
# Deploy Allura Dashboard to Docker

set -e

echo "🚀 Deploying Allura Dashboard to Docker..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t allura-dashboard:latest .

# Create network if it doesn't exist
docker network create allura-network 2>/dev/null || true

# Run the container
echo "🏃 Starting Allura Dashboard container..."
docker run -d \
  --name allura-dashboard \
  --network allura-network \
  -p 3100:3100 \
  -e OPENCLAW_URL=http://host.docker.internal:3200 \
  -e POSTGRES_HOST=knowledge-postgres \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=memory \
  -e POSTGRES_USER=ronin4life \
  -e POSTGRES_PASSWORD=test1234 \
  -e NEO4J_URI=bolt://knowledge-neo4j:7687 \
  -e NEO4J_USER=neo4j \
  -e NEO4J_PASSWORD=test1234 \
  --restart unless-stopped \
  allura-dashboard:latest

echo "✅ Allura Dashboard deployed!"
echo ""
echo "📍 Access: http://localhost:3100"
echo "🔗 Connected to OpenClaw: http://localhost:3200"
echo ""
echo "Test connection:"
echo "  curl http://localhost:3100"