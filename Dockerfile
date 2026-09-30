FROM node:22-alpine AS base

WORKDIR /app
RUN apk add --no-cache su-exec

# Install deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and public assets
COPY src/ src/
COPY agent-registration.json ./
COPY scripts/ scripts/

# Runtime
ENV NODE_ENV=production
ENV PORT=4020
EXPOSE 4020

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:4020/health || exit 1

COPY docker-entrypoint.sh /usr/local/bin/x402-entrypoint
RUN chmod 755 /usr/local/bin/x402-entrypoint
ENTRYPOINT ["x402-entrypoint"]
CMD ["node", "src/index.js"]
