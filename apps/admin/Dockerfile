# ─────────────────────────────────────────────────────────────
# admin Dockerfile — manual build only, not wired into CI.
# Multi-stage: build → production. Self-contained context (this app has
# no @digiability/* workspace dependency), same plain `npm install`
# pattern as services/user-svc/Dockerfile — no root-context /
# shared-package complexity needed here.
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

# Next.js has many more source directories than a typical backend
# service (app/, components/, lib/, middleware.ts, tailwind/postcss
# configs, ...) — copy everything and let .dockerignore exclude
# node_modules/.next/.env*, rather than enumerating each one by hand.
COPY . .

# lib/db.ts creates the pg Pool eagerly at module scope, and Next's build-time
# "collecting page data" step imports every route module — including this one
# — to check its config, so `next build` fails without SOME DATABASE_URL.
# pg.Pool doesn't actually connect until a query runs, so this placeholder
# never touches a real database; the real value comes from the k8s secret
# at container start, when server.js re-imports everything fresh.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nextjs

# `output: "standalone"` traces only the server bundle + the node_modules
# it actually needs into .next/standalone — it does NOT include
# public/ or .next/static (Next expects those copied in separately).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Admin credentials (data/credentials.json, read by
# app/api/auth/login/route.ts) are NOT baked into the image any more — the
# file is gitignored and no longer in the repo. In the cluster it is mounted
# from the k8s Secret `admin-credentials` at /app/data/credentials.json
# (subPath mount). Without that mount, login seeds the file once from
# ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD, but a file written inside the
# container is lost on restart. The directory must exist and be writable by
# the app user either way.
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
