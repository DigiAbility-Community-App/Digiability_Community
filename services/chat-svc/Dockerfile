# ─────────────────────────────────────────────────────────────
# chat-svc Dockerfile
# Multi-stage build for production
# ─────────────────────────────────────────────────────────────

# ── Build Stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL is required by Prisma query engine on Alpine Linux
RUN apk add --no-cache openssl

COPY package.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm install

COPY src ./src

# Generate Prisma client into src/generated/client
RUN npx prisma generate --schema=./prisma/schema.prisma

# Compile TypeScript (src → dist)
RUN npm run build

# ── Production Stage ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# curl for healthcheck, openssl for Prisma query engine
RUN apk add --no-cache curl openssl

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy Prisma schema + native engine binaries
COPY prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled TypeScript output
COPY --from=builder /app/dist ./dist

# Copy generated Prisma client to the location compiled JS expects.
# dist/models/prisma.client.js: require('../generated/client')
#   → resolves to /app/dist/generated/client  (NOT /app/src/generated/client)
COPY --from=builder /app/src/generated ./dist/generated

EXPOSE 4002

# Default: main HTTP + WebSocket server. Workers override via docker-compose `command`.
CMD ["node", "dist/index.js"]
