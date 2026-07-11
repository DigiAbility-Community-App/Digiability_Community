// ─────────────────────────────────────────────────────────────
// chat-svc — Main Server Entrypoint
//
// Bootstraps:
// 1. Express HTTP server (REST API for conversations, messages, presence)
// 2. WebSocket server (attached to same HTTP server)
// 3. Redis connections (commands + Pub/Sub subscriber)
// 4. Prisma database connection
// 5. Redis Stream consumer groups
// 6. Delivery service Pub/Sub subscription
//
// Graceful shutdown sequence:
// 1. Stop accepting new connections
// 2. Close all WebSocket connections (send close frame)
// 3. Unregister all sessions from Redis registry
// 4. Stop Pub/Sub subscription
// 5. Disconnect Redis + Prisma
// 6. Exit
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import { createServer } from "http";

// Patch BigInt for JSON serialization (Prisma uses BigInt for sequence numbers)
// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { disconnectRedis } from "./config/redis";
import prisma from "./models/prisma.client";
import { startMsgWorker } from "./workers/msg-svc.worker";
import { startDeliveryWorker } from "./workers/delivery.worker";
import { ensureConsumerGroups } from "./streams/producer";
import { attachWebSocketGateway } from "./websocket/gateway";
import { connectionManager } from "./websocket/connection-manager";
import { registryService } from "./services/registry.service";
import { deliveryService } from "./services/delivery.service";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";
import presenceRoutes from "./routes/presence.routes";
import inviteRoutes from "./routes/invite.routes";
import internalRoutes from "./routes/internal.routes";
import { keywordCache } from "./moderation/keyword-cache";

// ─── Express Application ──────────────────────────────────────

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Global Middleware
app.use(
  cors({
    origin: env.CLIENT_BASE_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "chat-svc",
    status: "healthy",
    serverId: env.SERVER_ID,
    connections: connectionManager.connectionCount,
    users: connectionManager.userCount,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/presence", presenceRoutes);
app.use("/api/invites", inviteRoutes);
app.use("/api/internal", internalRoutes);

// 404 + Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Server Startup ───────────────────────────────────────────

const httpServer = createServer(app);

// Holds worker stop functions for graceful shutdown
let stopMsgWorker: (() => Promise<void>) | null = null;
let stopDeliveryWorker: (() => Promise<void>) | null = null;

async function startServer(): Promise<void> {
  try {
    // 1. Connect to PostgreSQL
    await prisma.$connect();
    logger.info("PostgreSQL connected");

    // 2. Ensure Redis Stream consumer groups exist
    await ensureConsumerGroups();
    logger.info("Stream consumer groups ready");

    // 3. Attach WebSocket gateway to HTTP server
    attachWebSocketGateway(httpServer);
    logger.info("WebSocket gateway attached");

    // 4. Start Pub/Sub subscription for cross-server delivery
    await deliveryService.startSubscription();
    logger.info("Delivery service Pub/Sub subscription active");

    // 5. Start keyword cache (hot-reloaded via Redis pub/sub on admin changes)
    await keywordCache.init().catch((err) =>
      logger.warn("Keyword cache init failed (non-fatal)", { error: err.message })
    );

    // 6. Start embedded workers (no separate containers needed)
    stopMsgWorker = await startMsgWorker();
    logger.info("Message persistence worker started");

    stopDeliveryWorker = await startDeliveryWorker();
    logger.info("Delivery routing worker started");

    // 7. Start HTTP + WS server
    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 chat-svc running on http://localhost:${env.PORT}`);
      logger.info(`📋 Health check: http://localhost:${env.PORT}/health`);
      logger.info(`🔌 WebSocket:    ws://localhost:${env.PORT}/ws`);
      logger.info(`💬 Chat API:     http://localhost:${env.PORT}/api/conversations`);
      logger.info(`📨 Messages API: http://localhost:${env.PORT}/api/messages`);
      logger.info(`👤 Presence API: http://localhost:${env.PORT}/api/presence`);
      logger.info(`🏷️  Server ID:    ${env.SERVER_ID}`);
      logger.info(`🌍 Environment:  ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error instanceof Error ? error.message : "unknown",
    });
    process.exit(1);
  }
}

// ─── Graceful Shutdown ──────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — starting graceful shutdown`);

  // 1. Stop accepting new HTTP/WS connections
  httpServer.close(() => {
    logger.info("HTTP server closed");
  });

  // 2. Close all WebSocket connections
  const connCount = connectionManager.connectionCount;
  logger.info(`Closing ${connCount} WebSocket connections`);
  connectionManager.closeAll(1001, "Server shutting down");

  // 3. Clean up Redis registry entries for this server
  await registryService.cleanupServer().catch(() => {});

  // 4. Stop delivery Pub/Sub subscription
  await deliveryService.stopSubscription().catch(() => {});

  // 5. Stop embedded workers
  await stopMsgWorker?.().catch(() => {});
  await stopDeliveryWorker?.().catch(() => {});

  // 6. Disconnect Redis
  await disconnectRedis().catch(() => {});

  // 7. Disconnect Prisma
  await prisma.$disconnect().catch(() => {});

  logger.info("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught exception — shutting down", { error: err.message });
  gracefulShutdown("uncaughtException");
});

// Start the server
startServer();

export default app;
