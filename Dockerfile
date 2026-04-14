# syntax=docker/dockerfile:1
# Bun-only build — npm/npx are banned (zero-trust supply chain policy)

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3100
HEALTHCHECK --interval=20s --timeout=5s --retries=10 \
  CMD wget -qO- http://localhost:3100/api/health/live >/dev/null || exit 1

CMD ["bun", "run", "start"]
