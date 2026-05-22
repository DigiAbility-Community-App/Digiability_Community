// ─────────────────────────────────────────────────────────────
// Presence Service
//
// Provides user presence information (online/offline/last_seen).
// Reads from the Redis registry + presence keys.
// ─────────────────────────────────────────────────────────────

import { registryService } from "./registry.service";
import { logger } from "../config/logger";

export interface UserPresence {
  userId: string;
  status: "online" | "offline";
  lastSeen?: string;
  activeDevices: number;
}

class PresenceService {
  /**
   * Get presence info for a single user.
   */
  async getPresence(userId: string): Promise<UserPresence> {
    const [presence, sessions] = await Promise.all([
      registryService.getPresence(userId),
      registryService.getUserSessions(userId),
    ]);

    return {
      userId,
      status: presence.status,
      lastSeen: presence.lastSeen,
      activeDevices: sessions.length,
    };
  }

  /**
   * Get presence info for multiple users.
   * Used to populate a contact/conversation list.
   */
  async getMultiplePresence(userIds: string[]): Promise<UserPresence[]> {
    const results: UserPresence[] = [];

    // Batch lookups in parallel
    const promises = userIds.map(async (userId) => {
      try {
        return await this.getPresence(userId);
      } catch {
        return {
          userId,
          status: "offline" as const,
          activeDevices: 0,
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Get all active sessions for a user.
   * Used for admin/debug purposes.
   */
  async getActiveSessions(userId: string) {
    return registryService.getUserSessions(userId);
  }
}

export const presenceService = new PresenceService();
