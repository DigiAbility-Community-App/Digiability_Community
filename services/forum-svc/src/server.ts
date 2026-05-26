import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
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

// 404 Route handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

async function startServer() {
  try {
    // Check DB connection
    await prisma.$connect();
    console.log("✅ Forum database connected successfully");

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
