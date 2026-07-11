import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { keywordCache } from "./moderation/keyword-cache";
import prisma from "./models/prisma.client";
import forumRoutes from "./routes/forum.routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

import { createServer } from "http";
import { initSocketServer } from "./websocket/socket";

const app = express();
const PORT = parseInt(process.env.PORT ?? "4003", 10);
const server = createServer(app);

// Initialize Socket.io server
initSocketServer(server);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration - Allow all in development for easy emulator/mobile access
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
const uploadsPath = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsPath));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "forum-svc",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Mount forum routes
app.use("/api/forum", forumRoutes);

// ─── Internal: User content anonymisation (DPDP §13 erasure) ───────────────
// Called by user-svc after account deletion — fire-and-forget, so no auth
// cascade needed. Protected by shared internal secret.
// Anonymises authorId references; does NOT delete posts (threads preserved).
app.delete("/api/internal/users/:userId/content", async (req, res) => {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || req.headers["x-internal-secret"] !== secret) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  try {
    // Soft-anonymise: author name resolves to "Deleted User" via FK to user row
    // that was already anonymised by user-svc. No data change needed here beyond
    // confirming soft-delete on any user-owned content that stores redundant PII.
    // ForumQuestion and ForumAnswer reference authorId (FK) — the name
    // is fetched from the User row at query time, so anonymisation of the User
    // row in user-svc is sufficient. We do a soft-delete on any open bookmarks
    // and votes to stop them appearing in aggregates.
    await prisma.bookmark.deleteMany({ where: { userId } });
    await prisma.forumVote.deleteMany({ where: { userId } });

    res.status(200).json({ success: true, message: "User forum data anonymised." });
  } catch (err) {
    console.error("[internal] user content anonymisation failed:", err);
    res.status(500).json({ success: false, message: "Internal error" });
  }
});

// 404 Route handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

async function startServer() {
  try {
    // Check DB connection
    await prisma.$connect();
    console.log("✅ Forum database connected successfully");

    // Load keyword cache and subscribe to invalidation pub/sub
    await keywordCache.init().catch((err: Error) =>
      console.warn("⚠️  Keyword cache init failed (non-fatal):", err?.message)
    );

    server.listen(PORT, () => {
      console.log(`🚀 forum-svc running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`📂 Uploads directory: ${uploadsPath}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
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
