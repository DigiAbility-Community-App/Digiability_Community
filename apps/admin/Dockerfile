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
# public/ or .next/static (Next expects those copied in separately),
# and it does NOT include arbitrary app files like data/.
#
# data/credentials.json is read at runtime via
# path.join(process.cwd(), "data", "credentials.json")
# (app/api/auth/login/route.ts) — without this explicit COPY, login
# would silently fall back to the hardcoded default password baked into
# the route code, defeating the whole point of rotating it.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
