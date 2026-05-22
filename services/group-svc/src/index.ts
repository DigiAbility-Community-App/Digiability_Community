// ─────────────────────────────────────────────────────────────
// group-svc — Group & Care Circle Management
//
// Provides REST API for advanced group management features:
// - Create/update/delete groups and care circles
// - Invitation flows with approval
// - Role-based access control (OWNER, ADMIN, MEMBER)
// - Membership listing and search
//
// Note: Basic group membership is managed within chat-svc via
// ConversationMember. This service handles advanced scenarios
// like invitation workflows, approval queues, and group discovery.
//
// For Phase 1, chat-svc operates independently for group chat.
// This service becomes relevant for advanced group features.
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = parseInt(process.env.PORT ?? "4003", 10);

// Middleware
app.use(cors({ origin: process.env.CLIENT_BASE_URL ?? "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "10kb" }));

// Health Check
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "group-svc",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// ─── Placeholder Routes ─────────────────────────────────────

// POST /api/groups — Create a group/care-circle
app.post("/api/groups", (_req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet — use chat-svc conversation API for basic group creation" });
});

// GET /api/groups — List user's groups
app.get("/api/groups", (_req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet — use chat-svc conversation API" });
});

// GET /api/groups/:groupId — Get group details
app.get("/api/groups/:groupId", (_req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

// POST /api/groups/:groupId/invite — Invite member
app.post("/api/groups/:groupId/invite", (_req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

// POST /api/groups/:groupId/members/:userId/role — Update member role
app.post("/api/groups/:groupId/members/:userId/role", (_req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 group-svc running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

export default app;
