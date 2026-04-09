#!/bin/bash
# Deploy Paperclip Dashboard to Docker

set -e

echo "🚀 Deploying Paperclip Dashboard to Docker..."

# Navigate to paperclip directory
cd "$(dirname "$0")/paperclip"

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t paperclip-dashboard:latest .

# Create network if it doesn't exist
docker network create allura-network 2>/dev/null || true

# Run the container
echo "🏃 Starting Paperclip container..."
docker run -d \
  --name paperclip-dashboard \
  --network allura-network \
  -p 3001:3000 \
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
  paperclip-dashboard:latest

echo "✅ Paperclip Dashboard deployed!"
echo ""
echo "📍 Access: http://localhost:3001"
echo "🔗 Connected to OpenClaw: http://localhost:3200"
echo ""
echo "Test connection:"
echo "  curl http://localhost:3001"
