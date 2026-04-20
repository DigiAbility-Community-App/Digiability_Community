import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import prisma from "./models/prisma.client";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

// ─────────────────────────────────────────────────────
// Express Application — user-svc (Auth & User Management)
// ─────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT ?? "4001", 10);

// ─── Global Middleware ─────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_BASE_URL ?? "http://localhost:3000",
    credentials: true,          // Required for cross-origin cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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
