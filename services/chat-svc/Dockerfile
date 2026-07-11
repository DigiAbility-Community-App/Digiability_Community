# ─────────────────────────────────────────────────────────────
# chat-svc Dockerfile
# Multi-stage build for production
#
# Build context is the REPO ROOT (see docker-compose.yml) so the
# shared @digiability/moderation workspace package can be copied in.
# ─────────────────────────────────────────────────────────────

# ── Build Stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

# OpenSSL is required by Prisma query engine on Alpine Linux
RUN apk add --no-cache openssl

# Shared moderation package — chat-svc depends on it via
# "file:../../packages/moderation", so keep the same relative layout.
WORKDIR /app/packages/moderation
COPY packages/moderation/package.json packages/moderation/tsconfig.json ./
RUN npm install --ignore-scripts
COPY packages/moderation/src ./src
RUN npm run build

WORKDIR /app/services/chat-svc

COPY services/chat-svc/package.json ./
COPY services/chat-svc/tsconfig.json ./
COPY services/chat-svc/prisma ./prisma/

RUN npm install

COPY services/chat-svc/src ./src

# Generate Prisma client into src/generated/client
RUN npx prisma generate --schema=./prisma/schema.prisma

# Compile TypeScript (src → dist)
RUN npm run build

# ── Production Stage ─────────────────────────────────────────
FROM node:20-alpine AS production

# curl for healthcheck, openssl for Prisma query engine
RUN apk add --no-cache curl openssl

# Shared moderation package at the path the file: dep expects.
# Full source + tsconfig are needed because npm re-runs the package's
# `prepare` (tsc) when installing a file: dependency — even with
# --ignore-scripts. node_modules from the builder provides typescript.
COPY packages/moderation/package.json packages/moderation/tsconfig.json /app/packages/moderation/
COPY packages/moderation/src /app/packages/moderation/src
COPY --from=builder /app/packages/moderation/dist /app/packages/moderation/dist
COPY --from=builder /app/packages/moderation/node_modules /app/packages/moderation/node_modules

WORKDIR /app/services/chat-svc

# Install only production dependencies. --ignore-scripts skips the
# moderation package's prepare (tsc) — its dist is already compiled —
# and Prisma's postinstall (engines are copied from the builder below).
COPY services/chat-svc/package.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy Prisma schema + native engine binaries
COPY services/chat-svc/prisma ./prisma/
COPY --from=builder /app/services/chat-svc/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/services/chat-svc/node_modules/@prisma ./node_modules/@prisma

# Copy compiled TypeScript output
COPY --from=builder /app/services/chat-svc/dist ./dist

# Copy generated Prisma client to the location compiled JS expects.
# dist/models/prisma.client.js: require('../generated/client')
#   → resolves to dist/generated/client  (NOT src/generated/client)
COPY --from=builder /app/services/chat-svc/src/generated ./dist/generated

EXPOSE 4002

# Default: main HTTP + WebSocket server. Workers override via docker-compose `command`.
CMD ["node", "dist/index.js"]
