#!/usr/bin/env node
// Fails the build if an API route handler has no admin auth check.
//
// middleware.ts excludes /api, so every route under app/api must protect
// itself. Several did not — events/[id] PATCH/DELETE, disability-types writes
// and users/[id]/reports were reachable by anyone, even though each file
// imported requireAdminAuth. This makes that mistake a build error.
//
// A handler passes if its body calls one of AUTH_CALLS. Handlers that are
// public on purpose go in PUBLIC with the reason.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const API_DIR = join(ROOT, "app", "api");

const AUTH_CALLS = /\b(requireAdminAuth|isAdminRequest|getAdminSession)\s*\(/;

// "<route dir relative to app/api> <METHOD>" → why it is public.
const PUBLIC = {
  "auth/login POST": "the login endpoint itself",
  "auth/logout POST": "clears/revokes whatever session the cookie carries",
  "auth/session GET": "reports session state; verifies the cookie itself",
  "auth/session POST": "renews the session; verifies the cookie itself",
  "maintenance GET": "read by the mobile app before login",
  "settings/event-categories GET": "read by the mobile app and web",
  "settings/service-categories GET": "read by the mobile app and web",
};

const METHOD_RE =
  /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g;

function routeFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

const failures = [];
for (const file of routeFiles(API_DIR)) {
  const src = readFileSync(file, "utf8");
  const route = relative(API_DIR, file).split(sep).slice(0, -1).join("/");
  const matches = [...src.matchAll(METHOD_RE)];
  matches.forEach((m, i) => {
    const method = m[1] ?? m[2];
    const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
    const body = src.slice(m.index + m[0].length, end);
    if (!AUTH_CALLS.test(body) && !PUBLIC[`${route} ${method}`]) {
      failures.push(`${method.padEnd(6)} app/api/${route}/route.ts`);
    }
  });
}

if (failures.length > 0) {
  console.error("API handlers with no admin auth check:\n");
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    "\nAdd `const authError = await requireAdminAuth(request); if (authError) return authError;`" +
      "\nor, if it must be public, list it in PUBLIC in scripts/check-api-auth.mjs with the reason."
  );
  process.exit(1);
}
console.log("check:auth — every API handler is authenticated or explicitly public.");
