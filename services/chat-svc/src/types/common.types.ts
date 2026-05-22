// ─────────────────────────────────────────────────────────────
// Common Type Definitions
// ─────────────────────────────────────────────────────────────

/** Authenticated user info extracted from JWT */
export interface AuthenticatedUser {
  sub: string;       // userId
  email: string;
  iat?: number;
  exp?: number;
}

/** WebSocket connection metadata stored in Redis registry */
export interface SessionInfo {
  connId: string;
  serverId: string;
  deviceId: string;
  userId: string;
  connectedAt: string;   // ISO 8601
  lastPing: string;      // ISO 8601
}

/** Pagination parameters for REST endpoints */
export interface PaginationParams {
  cursor?: string;
  limit: number;
}

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

/** Request with authenticated user */
import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
