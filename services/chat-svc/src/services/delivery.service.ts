// ─────────────────────────────────────────────────────────────
// Delivery Service
//
// Handles the last-mile delivery of messages to local WebSocket
// connections. Subscribes to Pub/Sub channels for cross-server
// message routing.
//
// Flow:
// 1. DeliveryWorker (stream consumer) resolves recipient sessions
// 2. For local sessions: calls connectionManager.sendToUser directly
// 3. For remote sessions: publishes to Pub/Sub channel of target server
// 4. This service subscribes to our server's Pub/Sub channel
// 5. On Pub/Sub message: forwards to local connections
//
// If the WS send fails (connection died), the delivery is NOT retried
// here. The message remains PENDING in the DB and will be picked up
// by the client's sync.request on reconnect.
// ─────────────────────────────────────────────────────────────

import { redisSub } from "../config/redis";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { connectionManager } from "../websocket/connection-manager";
import { registryService } from "./registry.service";
import { PUBSUB_CHANNELS } from "../streams/constants";
import { WS_EVENTS, WsEnvelope } from "../types/ws-events";
import { DeliveryPayload, ReceiptBroadcastPayload } from "../types/message.types";

class DeliveryService {
  private isSubscribed = false;

  /**
   * Start listening for cross-server delivery messages.
   * Called once on server startup.
   */
  async startSubscription(): Promise<void> {
    if (this.isSubscribed) return;

    const deliverChannel = PUBSUB_CHANNELS.SERVER_DELIVER(env.SERVER_ID);
    const receiptChannel = PUBSUB_CHANNELS.SERVER_RECEIPT(env.SERVER_ID);
    const typingChannel = PUBSUB_CHANNELS.SERVER_TYPING(env.SERVER_ID);

    await redisSub.subscribe(deliverChannel, receiptChannel, typingChannel);

    redisSub.on("message", (channel: string, message: string) => {
      try {
        if (channel === deliverChannel) {
          this.handleDeliveryMessage(message);
        } else if (channel === receiptChannel) {
          this.handleReceiptMessage(message);
        } else if (channel === typingChannel) {
          this.handleTypingMessage(message);
        }
      } catch (err) {
        logger.error("Pub/Sub message handling failed", {
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    });

    this.isSubscribed = true;
    logger.info("Delivery service subscribed to Pub/Sub", {
      serverId: env.SERVER_ID,
    });
  }

  /**
   * Deliver a message to a specific user's local connections.
   * Called directly by the delivery worker for local routing,
   * or via Pub/Sub for cross-server routing.
   */
  deliverToLocalUser(
    targetUserId: string,
    envelope: WsEnvelope
  ): { sent: number; failed: string[] } {
    const conns = connectionManager.getByUser(targetUserId);
    let sent = 0;
    const failedConnIds: string[] = [];

    for (const conn of conns) {
      const success = connectionManager.sendToConnection(conn.connId, envelope);
      if (success) {
        sent++;
      } else {
        failedConnIds.push(conn.connId);
      }
    }

    // Clean up failed connections from registry
    for (const connId of failedConnIds) {
      connectionManager.remove(connId);
      registryService.removeStaleSession(targetUserId, connId).catch(() => {});
    }

    return { sent, failed: failedConnIds };
  }

  /**
   * Handle a delivery message received via Pub/Sub from another server.
   */
  private handleDeliveryMessage(raw: string): void {
    const payload: DeliveryPayload = JSON.parse(raw);
    const { targetUserId, message } = payload;

    console.log('[TRACE] 📬 deliveryService: Received Pub/Sub message for user', targetUserId, 'msgId:', message.messageId);

    const envelope: WsEnvelope = {
      event: WS_EVENTS.MESSAGE_NEW,
      data: {
        messageId: message.messageId,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        metadata: message.metadata,
        sequenceNo: Number(message.sequenceNo),
        createdAt: message.createdAt,
      },
      timestamp: Date.now(),
    };

    const result = this.deliverToLocalUser(targetUserId, envelope);

    console.log('[TRACE] 📬 deliveryService: Delivery result', { userId: targetUserId, sent: result.sent, failed: result.failed.length });

    logger.debug("Pub/Sub delivery completed", {
      userId: targetUserId,
      messageId: message.messageId,
      sent: String(result.sent),
      failed: String(result.failed.length),
    });
  }

  /**
   * Handle a receipt broadcast received via Pub/Sub.
   */
  private handleReceiptMessage(raw: string): void {
    const payload: ReceiptBroadcastPayload = JSON.parse(raw);

    const envelope: WsEnvelope = {
      event: payload.type === "delivered"
        ? WS_EVENTS.MESSAGE_DELIVERED_RECEIPT
        : WS_EVENTS.MESSAGE_READ_RECEIPT,
      data: {
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        userId: payload.userId,
        timestamp: payload.timestamp,
      },
      timestamp: Date.now(),
    };

    this.deliverToLocalUser(payload.targetUserId, envelope);
  }

  /**
   * Handle a typing indicator received via Pub/Sub.
   */
  private handleTypingMessage(raw: string): void {
    const payload = JSON.parse(raw) as {
      event: string;
      conversationId: string;
      userId: string;
      targetUserIds: string[];
    };

    const envelope: WsEnvelope = {
      event: payload.event,
      data: {
        conversationId: payload.conversationId,
        userId: payload.userId,
      },
      timestamp: Date.now(),
    };

    // Deliver to all local target users
    for (const targetId of payload.targetUserIds) {
      this.deliverToLocalUser(targetId, envelope);
    }
  }

  /**
   * Stop Pub/Sub subscription (for shutdown).
   */
  async stopSubscription(): Promise<void> {
    if (!this.isSubscribed) return;

    try {
      await redisSub.unsubscribe();
      this.isSubscribed = false;
      logger.info("Delivery service unsubscribed from Pub/Sub");
    } catch {
      // Best effort on shutdown
    }
  }
}

export const deliveryService = new DeliveryService();
