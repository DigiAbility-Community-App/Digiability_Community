# ─────────────────────────────────────────────────────────────
# user-svc Dockerfile
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

EXPOSE 4001

CMD ["node", "dist/index.js"]
