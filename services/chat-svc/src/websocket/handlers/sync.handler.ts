// ─────────────────────────────────────────────────────────────
// Sync Handler
//
// Handles `sync.request` — the reconnect/catch-up flow.
// When a device reconnects after being offline, it sends the
// last known sequenceNo for each conversation. The server
// returns all messages after that point.
//
// Pagination: if there are too many missed messages, the
// response includes `hasMore: true` and a `nextCursor` so
// the client can fetch in batches.
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { logger } from "../../config/logger";
import { syncRequestSchema } from "../../utils/validation.util";
import { messageRepository } from "../../repositories/message.repository";
import { WS_EVENTS, WS_ERROR_CODES, WsEnvelope, SyncResponsePayload, MessageNewPayload } from "../../types/ws-events";

const SYNC_BATCH_SIZE = 100;

export async function handleSyncRequest(
  ws: WebSocket,
  connId: string,
  userId: string,
  data: unknown,
  requestId?: string
): Promise<void> {
  const parsed = syncRequestSchema.safeParse(data);
  if (!parsed.success) {
    sendError(ws, WS_ERROR_CODES.INVALID_PAYLOAD, "Invalid sync request", requestId);
    return;
  }

  const { conversations } = parsed.data;

  try {
    // Process each conversation sync request
    for (const conv of conversations) {
      const { conversationId, lastSequenceNo } = conv;

      // Verify membership before returning messages
      const isMember = await messageRepository.isUserInConversation(conversationId, userId);
      if (!isMember) {
        logger.warn("Sync request for non-member conversation", {
          conversationId,
          userId,
          connId,
        });
        continue; // Skip, don't error — client might have stale state
      }

      // Fetch messages after the client's last known sequence
      const messages = await messageRepository.getMessagesAfterSequence(
        conversationId,
        BigInt(lastSequenceNo),
        SYNC_BATCH_SIZE + 1 // Fetch one extra to detect hasMore
      );

      const hasMore = messages.length > SYNC_BATCH_SIZE;
      const batch = hasMore ? messages.slice(0, SYNC_BATCH_SIZE) : messages;

      // Exclude messages this user deleted "for me" so a reconnect sync
      // doesn't resurrect them. hasMore/nextCursor stay on the fetched
      // boundary so the client keeps paging from the right sequence.
      const hiddenIds = await messageRepository.getHiddenMessageIds(
        userId,
        batch.map((m) => m.id)
      );
      const visibleBatch = hiddenIds.size === 0
        ? batch
        : batch.filter((m) => !hiddenIds.has(m.id));

      const messagePayloads: MessageNewPayload[] = visibleBatch.map((msg) => ({
        messageId: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        content: msg.deletedAt ? "" : msg.content,
        type: msg.type,
        metadata: msg.metadata ?? undefined,
        sequenceNo: Number(msg.sequenceNo),
        createdAt: msg.createdAt.toISOString(),
      }));

      const syncResponse: SyncResponsePayload = {
        conversationId,
        messages: messagePayloads,
        hasMore,
        nextCursor: hasMore
          ? Number(batch[batch.length - 1].sequenceNo)
          : undefined,
      };

      sendEvent(ws, {
        event: WS_EVENTS.SYNC_RESPONSE,
        requestId,
        data: syncResponse,
        timestamp: Date.now(),
      });
    }

    logger.info("Sync completed", {
      userId,
      connId,
      conversationCount: String(conversations.length),
    });
  } catch (err) {
    logger.error("Sync request failed", {
      userId,
      connId,
      error: err instanceof Error ? err.message : "unknown",
    });
    sendError(ws, WS_ERROR_CODES.INTERNAL_ERROR, "Sync failed — please retry", requestId);
  }
}

function sendEvent(ws: WebSocket, envelope: WsEnvelope): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(envelope));
  }
}

function sendError(ws: WebSocket, code: string, message: string, requestId?: string): void {
  sendEvent(ws, {
    event: WS_EVENTS.ERROR,
    requestId,
    data: { code, message, requestId },
    timestamp: Date.now(),
  });
}
