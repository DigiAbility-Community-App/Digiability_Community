import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { existsSync } from "fs";
import prisma from "./models/prisma.client";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import eventRoutes from "./routes/event.routes";
import mentorRoutes from "./routes/mentor.routes";
import reportRoutes from "./routes/report.routes";
import masterRoutes from "./routes/master.routes";
import moderationRoutes from "./routes/moderation.routes";
import privacyRoutes from "./routes/privacy.routes";
import { initKeywordCache } from "./services/keyword.service";
import { startModerationWorker } from "./workers/moderation.worker";
import { startRetentionWorker } from "./workers/retention.worker";
import type { Worker } from "bullmq";
import { globalApiLimiter } from "./middleware/rateLimit.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

// ─────────────────────────────────────────────────────
// Express Application — user-svc (Auth & User Management)
// ─────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT ?? "4001", 10);

function getDatabaseTarget() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  try {
    const normalized = databaseUrl.replace(/^postgresql:\/\//, "http://");
    const parsed = new URL(normalized);

    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "").split("?")[0],
    };
  } catch {
    return null;
  }
}

function getDatabaseHelpMessage() {
  const target = getDatabaseTarget();
  const isRunningInContainer = existsSync("/.dockerenv");

  if (!target) {
    return "Check that DATABASE_URL is set to a valid PostgreSQL connection string.";
  }

  if ((target.host === "localhost" || target.host === "127.0.0.1") && isRunningInContainer) {
    return [
      `DATABASE_URL is targeting ${target.host}:${target.port} from inside a container.`,
      "If user-svc runs in Docker Compose, use the Postgres service host `postgres` instead.",
    ].join(" ");
  }

  if (target.host === "postgres" && !isRunningInContainer) {
    return [
      "DATABASE_URL is targeting the Docker-only host `postgres` from your local machine.",
      "If user-svc runs locally, switch the host to `localhost` and keep Postgres running on port 5432.",
    ].join(" ");
  }

  if (target.host === "localhost" || target.host === "127.0.0.1") {
    return [
      `DATABASE_URL is targeting ${target.host}:${target.port}/${target.database}.`,
      "Make sure Postgres is running locally, or start the repo infrastructure with `npm run docker:up` from the monorepo root.",
    ].join(" ");
  }

  return `Verify that PostgreSQL is reachable at ${target.host}:${target.port}/${target.database}.`;
}

// ─── Security Headers ──────────────────────────────────
app.use(
  helmet({
    // This is a JSON API — no HTML served, so relax CSP to API-appropriate defaults
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Not needed for API
  })
);

// ─── Global Middleware ─────────────────────────────────
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? process.env.CLIENT_BASE_URL ?? "http://localhost:3000"
      : true,   // Allow all origins in development (mobile devices, emulators)
    credentials: true,          // Required for cross-origin cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["x-refresh-token", "set-cookie"],
  })
);
app.use(express.json({ limit: "10kb" }));     // Guard against large payloads
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Global Rate Limiter ───────────────────────────────
app.use(globalApiLimiter);

// ─── Health Check ──────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "user-svc",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/auth/privacy", privacyRoutes);
app.use("/api/users/profiles", profileRoutes);
app.use("/api/users/profile", profileRoutes);
app.use("/api/users/mentors", mentorRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/master", masterRoutes);
app.use("/api/moderation", moderationRoutes);

// ─── 404 Handler ───────────────────────────────────────
app.use(notFoundHandler);

// ─── Global Error Handler (must be last) ───────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────

let _moderationWorker: Worker | null = null;

async function startServer() {
  try {
    // Verify DB connection on startup
    await prisma.$connect();
    console.log("✅ Database connected");

    // Load banned-keyword list into Redis cache for consumers
    await initKeywordCache().catch((err) =>
      console.warn("⚠️  Keyword cache init failed (non-fatal):", err?.message)
    );

    // Start async AI classification worker (Tier C)
    try {
      _moderationWorker = startModerationWorker();
    } catch (err) {
      console.warn("⚠️  Moderation worker failed to start (non-fatal):", (err as Error).message);
    }

    // Start data retention enforcement worker (DPDP §8(7))
    startRetentionWorker().catch((err) =>
      console.warn("⚠️  Retention worker failed to start (non-fatal):", err?.message)
    );

    app.listen(PORT, () => {
      console.log(`🚀 user-svc running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth API:     http://localhost:${PORT}/api/auth`);
      console.log(`🌍 Environment:  ${process.env.NODE_ENV ?? "development"}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    console.error(`💡 Database setup hint: ${getDatabaseHelpMessage()}`);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ──────────────────────────────────
async function gracefulShutdown() {
  await _moderationWorker?.close().catch(() => {});
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => { console.log("SIGTERM received."); gracefulShutdown(); });
process.on("SIGINT",  () => { console.log("SIGINT received.");  gracefulShutdown(); });

startServer();

export default app;
