import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { existsSync } from "fs";
import prisma from "./models/prisma.client";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import eventRoutes from "./routes/event.routes";
import mentorRoutes from "./routes/mentor.routes";
import reportRoutes from "./routes/report.routes";
import masterRoutes from "./routes/master.routes";
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
app.use("/api/users/profiles", profileRoutes);
app.use("/api/users/profile", profileRoutes);
app.use("/api/users/mentors", mentorRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/master", masterRoutes);

// ─── 404 Handler ───────────────────────────────────────
app.use(notFoundHandler);

// ─── Global Error Handler (must be last) ───────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────

async function startServer() {
  try {
    // Verify DB connection on startup
    await prisma.$connect();
    console.log("✅ Database connected");

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
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export default app;
