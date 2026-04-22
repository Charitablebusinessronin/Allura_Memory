FROM oven/bun:1 AS base

WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
RUN bun install --production

# Copy source code
COPY src ./src

# Set environment variables
ENV NODE_ENV=production
ENV BUN_ENV=production

# Expose port (though we'll use stdio for MCP)
EXPOSE 3000

# Entry point
ENTRYPOINT ["bun", "run", "src/index.ts"]