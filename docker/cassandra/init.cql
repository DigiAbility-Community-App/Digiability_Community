-- ─────────────────────────────────────────────────────────────
-- Cassandra Initialization Script
-- Creates keyspace and tables for the chat message store.
-- Run manually after Cassandra starts:
--   docker exec -i digiability_cassandra cqlsh < docker/cassandra/init.cql
-- ─────────────────────────────────────────────────────────────

CREATE KEYSPACE IF NOT EXISTS digiability_chat
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE digiability_chat;

-- ─────────────────────────────────────────────────────────────
-- Messages table
-- Partitioned by conversation_id, clustered by created_at DESC
-- Gives efficient time-ordered message retrieval per conversation
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  conversation_id UUID,
  message_id      UUID,
  sequence_no     BIGINT,
  sender_id       UUID,
  client_message_id TEXT,
  content         TEXT,
  type            TEXT,          -- TEXT, IMAGE, FILE, AUDIO, VIDEO, SYSTEM
  status          TEXT,          -- CREATED, PERSISTED, DELETED
  metadata        TEXT,          -- JSON string
  edited_at       TIMESTAMP,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP,
  PRIMARY KEY ((conversation_id), created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at DESC, message_id ASC)
  AND default_time_to_live = 0
  AND gc_grace_seconds = 864000;

-- ─────────────────────────────────────────────────────────────
-- Lookup table for idempotent writes (dedupe by client_message_id)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages_by_client_id (
  client_message_id TEXT,
  conversation_id   UUID,
  message_id        UUID,
  sequence_no       BIGINT,
  sender_id         UUID,
  content           TEXT,
  type              TEXT,
  created_at        TIMESTAMP,
  PRIMARY KEY (client_message_id)
);

-- ─────────────────────────────────────────────────────────────
-- Sequence counter table for per-conversation ordering
-- Uses lightweight transactions (LWT) for atomic increments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_sequence (
  conversation_id UUID PRIMARY KEY,
  last_sequence_no BIGINT
);
