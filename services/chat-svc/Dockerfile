# ─────────────────────────────────────────────────────────────
# chat-svc Dockerfile
# Multi-stage build for production
# ─────────────────────────────────────────────────────────────

# ── Build Stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm install

COPY src ./src

# Generate Prisma client
RUN npx prisma generate --schema=./prisma/schema.prisma

# Compile TypeScript
RUN npm run build

# ── Production Stage ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy Prisma schema + generated client
COPY prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled JS
COPY --from=builder /app/dist ./dist

# Run migrations on startup (optional — can be run separately)
# RUN npx prisma migrate deploy --schema=./prisma/schema.prisma

EXPOSE 4002

# Default: run the main server. Workers override this via docker-compose `command`.
CMD ["node", "dist/index.js"]
