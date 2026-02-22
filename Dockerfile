FROM node:22-alpine AS base

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and public assets
COPY src/ src/
COPY agent-registration.json ./

# Runtime
ENV NODE_ENV=production
ENV PORT=4020
EXPOSE 4020

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:4020/health || exit 1

USER node
CMD ["node", "src/index.js"]
