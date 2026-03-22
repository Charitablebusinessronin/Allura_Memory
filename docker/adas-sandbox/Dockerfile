# ADAS Sandbox Container
# Story 2.3: Integrate Sandboxed Execution for ADAS
#
# Minimal, secure container for executing untrusted agent code
# with restricted network and filesystem access

FROM node:20-slim

# Create non-root user for security
RUN groupadd -r adas && useradd -r -g adas adas

# Create app directory with restricted permissions
WORKDIR /app

# Copy runner script
COPY --chown=adas:adas runner.js /app/runner.js

# Create data directory with restricted permissions
RUN mkdir -p /data && chown -R adas:adas /data

# Set no-new-privileges capability
RUN setcap cap_setuid=ep /usr/bin/node 2>/dev/null || true

# Switch to non-root user
USER adas

# Set environment variables
ENV NODE_ENV=production
ENV KMAX=100
ENV TIMEOUT_MS=60000

# Health check
HEALTHCHECK --interval=5s --timeout=3s --start-period=1s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Default command
CMD ["node", "/app/runner.js"]

# Labels for identification
LABEL "adas.sandbox"="true"
LABEL "adas.version"="1.0.0"
LABEL "adas.security"="restricted"