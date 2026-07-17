# ─────────────────────────────────────────────────────────────
# forum-svc Dockerfile
# Multi-stage build for production
#
# Build context is the REPO ROOT (see docker-compose.yml) so the
# shared @digiability/moderation workspace package can be copied in.
# ─────────────────────────────────────────────────────────────

# ── Build Stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

# OpenSSL is required by Prisma query engine on Alpine Linux
RUN apk add --no-cache openssl

# Shared moderation package — forum-svc depends on it via
# "file:../../packages/moderation", so keep the same relative layout.
WORKDIR /app/packages/moderation
COPY packages/moderation/package.json packages/moderation/tsconfig.json ./
RUN npm install --ignore-scripts
COPY packages/moderation/src ./src
RUN npm run build

WORKDIR /app/services/forum-svc

COPY services/forum-svc/package.json ./
COPY services/forum-svc/tsconfig.json ./
COPY services/forum-svc/prisma ./prisma/

RUN npm install

COPY services/forum-svc/src ./src

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

WORKDIR /app/services/forum-svc

# Install only production dependencies. --ignore-scripts skips the
# moderation package's prepare (tsc) — its dist is already compiled —
# and Prisma's postinstall (engines are copied from the builder below).
COPY services/forum-svc/package.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy Prisma schema + native engine binaries
COPY services/forum-svc/prisma ./prisma/
COPY --from=builder /app/services/forum-svc/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/services/forum-svc/node_modules/@prisma ./node_modules/@prisma

# Copy compiled TypeScript output
COPY --from=builder /app/services/forum-svc/dist ./dist

# Copy generated Prisma client to the path the compiled JS expects.
# dist/models/prisma.client.js: require('../generated/client') → dist/generated/client
COPY --from=builder /app/services/forum-svc/src/generated ./dist/generated

# Uploaded forum media (images/audio) lands on local disk here — same
# known limitation as chat-svc's /uploads: ephemeral across container
# restarts/redeploys. Move to S3/R2 before relying on this in production
# with >1 replica or rolling deploys (see CLAUDE.md roadmap notes).
# server.ts resolves uploads relative to dist → <workdir>/uploads
RUN mkdir -p uploads

EXPOSE 4003

CMD ["node", "dist/server.js"]
