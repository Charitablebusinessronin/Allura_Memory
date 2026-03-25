FROM oven/bun:1.1.45-slim

WORKDIR /app

COPY package.json ./
RUN bun install

COPY src/mcp/openclaw-gateway.ts ./src/mcp/
COPY src/lib/ ./src/lib/
COPY src/integrations/ ./src/integrations/

EXPOSE 3001

CMD ["bun", "run", "src/mcp/openclaw-gateway.ts"]
