# ─────────────────────────────────────────────────────────────
# forum-svc Dockerfile
# Multi-stage: build → production
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl for Prisma engine generation
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma client (targets alpine / musl / openssl3)
RUN npx prisma generate --schema=./prisma/schema.prisma

# Compile TypeScript
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl (healthcheck) + openssl (Prisma engine requirement)
RUN apk add --no-cache curl openssl

COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled output and Prisma client artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Copy generated Prisma client to the path the compiled JS expects.
# dist/models/prisma.client.js: require('../generated/client') → dist/generated/client
COPY --from=builder /app/src/generated ./dist/generated

# Uploaded forum media (images/audio) lands on local disk here — same
# known limitation as chat-svc's /uploads: ephemeral across container
# restarts/redeploys. Move to S3/R2 before relying on this in production
# with >1 replica or rolling deploys (see CLAUDE.md roadmap notes).
RUN mkdir -p /app/uploads

EXPOSE 4003

CMD ["node", "dist/server.js"]
