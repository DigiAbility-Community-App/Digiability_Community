// ─────────────────────────────────────────────────────────────
// Redis Stream Constants
// Central definition of all stream names, consumer groups,
// and Pub/Sub channel patterns used across the system.
// ─────────────────────────────────────────────────────────────

/** Redis Stream names — durable event log for message lifecycle */
export const STREAMS = {
  /** ChatSvc → MsgSvc: raw message accepted into the system */
  MESSAGE_CREATED: "msg:created",

  /** MsgSvc → DeliveryWorker: message persisted to DB with sequenceNo */
  MESSAGE_PERSISTED: "msg:persisted",

  /** DeliveryWorker → NotifSvc: recipient is offline, needs push */
  MESSAGE_NOTIFY: "msg:notify",

  /** Receipt events for async processing */
  RECEIPT_EVENTS: "msg:receipts",
} as const;

/** Consumer group names — each group processes events independently */
export const CONSUMER_GROUPS = {
  MSG_SVC: "msg-svc-group",
  DELIVERY_WORKER: "delivery-worker-group",
  NOTIF_SVC: "notif-svc-group",
  RECEIPT_PROCESSOR: "receipt-processor-group",
  BOT_SERVICE: "bot-service-group",
} as const;

/** Redis key prefixes for the session registry */
export const REGISTRY_KEYS = {
  /** Hash: ws:sessions:{userId} → { connId: JSON(SessionInfo) } */
  USER_SESSIONS: (userId: string) => `ws:sessions:${userId}`,

  /** Set: ws:server:{serverId} → Set of connIds owned by this server */
  SERVER_CONNECTIONS: (serverId: string) => `ws:server:${serverId}`,

  /** String: ws:presence:{userId} → "online" | timestamp of last seen */
  USER_PRESENCE: (userId: string) => `ws:presence:${userId}`,
} as const;

/** Pub/Sub channel patterns for ephemeral cross-server routing */
export const PUBSUB_CHANNELS = {
  /** Deliver a message to connections on a specific server */
  SERVER_DELIVER: (serverId: string) => `ws:deliver:${serverId}`,

  /** Broadcast a receipt update to connections on a specific server */
  SERVER_RECEIPT: (serverId: string) => `ws:receipt:${serverId}`,

  /** Broadcast typing indicators to connections on a specific server */
  SERVER_TYPING: (serverId: string) => `ws:typing:${serverId}`,
} as const;

/** Maximum number of pending entries before consumer is considered lagging */
export const STREAM_MAX_PENDING = 10000;

/** Maximum number of messages to read per XREADGROUP call */
export const STREAM_READ_COUNT = 50;

/** Block timeout for XREADGROUP (ms) — how long to wait for new entries */
export const STREAM_BLOCK_MS = 5000;

/** Maximum message age in stream before trimming (approximate) */
export const STREAM_MAX_LEN = 100000;
