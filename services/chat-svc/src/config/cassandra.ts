// ─────────────────────────────────────────────────────────────
// Cassandra Client Configuration
//
// Two-phase initialization:
//   Phase 1 – bootstrap client (no keyspace) creates the
//             keyspace and all tables idempotently.
//   Phase 2 – main client connects WITH the keyspace so all
//             repository queries using unqualified table names
//             work correctly across the connection pool.
//
// Safe to run concurrently from chat-svc + msg-worker because
// every DDL statement uses IF NOT EXISTS.
// ─────────────────────────────────────────────────────────────

import { Client } from "cassandra-driver";
import { logger } from "./logger";

const CASSANDRA_HOST     = process.env.CASSANDRA_HOST     ?? "localhost";
const CASSANDRA_PORT     = parseInt(process.env.CASSANDRA_PORT ?? "9042", 10);
const CASSANDRA_DC       = process.env.CASSANDRA_DC       ?? "datacenter1";
const CASSANDRA_KEYSPACE = process.env.CASSANDRA_KEYSPACE ?? "digiability_chat";

// ── Main client (used by all repositories) ────────────────────
// Keyspace is set here so unqualified table names resolve correctly.
// This client MUST only be connected after the keyspace exists.
const cassandraClient = new Client({
  contactPoints: [`${CASSANDRA_HOST}:${CASSANDRA_PORT}`],
  localDataCenter: CASSANDRA_DC,
  keyspace: CASSANDRA_KEYSPACE,
  queryOptions: {
    consistency: 1, // LOCAL_ONE — fast writes for dev
    prepare: true,
  },
});

// ── Phase 1: bootstrap keyspace & schema ──────────────────────
async function bootstrapSchema(): Promise<void> {
  const boot = new Client({
    contactPoints: [`${CASSANDRA_HOST}:${CASSANDRA_PORT}`],
    localDataCenter: CASSANDRA_DC,
    // No keyspace — connects even on a blank cluster
  });

  try {
    await boot.connect();
    logger.info("Cassandra bootstrap client connected", { host: CASSANDRA_HOST });

    await boot.execute(`
      CREATE KEYSPACE IF NOT EXISTS ${CASSANDRA_KEYSPACE}
      WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
      AND durable_writes = true
    `);
    logger.info(`Cassandra keyspace ensured: ${CASSANDRA_KEYSPACE}`);

    await boot.execute(`
      CREATE TABLE IF NOT EXISTS ${CASSANDRA_KEYSPACE}.messages (
        conversation_id   UUID,
        message_id        UUID,
        sequence_no       BIGINT,
        sender_id         UUID,
        client_message_id TEXT,
        content           TEXT,
        type              TEXT,
        status            TEXT,
        metadata          TEXT,
        edited_at         TIMESTAMP,
        deleted_at        TIMESTAMP,
        created_at        TIMESTAMP,
        updated_at        TIMESTAMP,
        PRIMARY KEY ((conversation_id), created_at, message_id)
      ) WITH CLUSTERING ORDER BY (created_at DESC, message_id ASC)
        AND default_time_to_live = 0
        AND gc_grace_seconds = 864000
    `);

    await boot.execute(`
      CREATE TABLE IF NOT EXISTS ${CASSANDRA_KEYSPACE}.messages_by_client_id (
        client_message_id TEXT,
        conversation_id   UUID,
        message_id        UUID,
        sequence_no       BIGINT,
        sender_id         UUID,
        content           TEXT,
        type              TEXT,
        created_at        TIMESTAMP,
        PRIMARY KEY (client_message_id)
      )
    `);

    await boot.execute(`
      CREATE TABLE IF NOT EXISTS ${CASSANDRA_KEYSPACE}.conversation_sequence (
        conversation_id  UUID PRIMARY KEY,
        last_sequence_no BIGINT
      )
    `);

    logger.info("Cassandra schema ready (all tables ensured)");
  } finally {
    await boot.shutdown().catch(() => {});
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Connect to Cassandra.
 * Phase 1 creates the keyspace/tables if they don't exist.
 * Phase 2 connects the main pooled client with the keyspace set,
 * so all repository queries with unqualified table names work.
 */
export async function connectCassandra(): Promise<void> {
  try {
    // Phase 1: ensure schema exists
    await bootstrapSchema();

    // Phase 2: connect the main client (keyspace now guaranteed to exist)
    await cassandraClient.connect();
    logger.info("Cassandra main client connected", {
      host: CASSANDRA_HOST,
      keyspace: CASSANDRA_KEYSPACE,
    });
  } catch (err) {
    logger.error("Failed to connect to Cassandra", {
      error: err instanceof Error ? err.message : "unknown",
      host: CASSANDRA_HOST,
    });
    throw err;
  }
}

/**
 * Gracefully disconnect from Cassandra.
 */
export async function disconnectCassandra(): Promise<void> {
  try {
    await cassandraClient.shutdown();
    logger.info("Cassandra disconnected");
  } catch (err) {
    logger.error("Error disconnecting Cassandra", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export default cassandraClient;
