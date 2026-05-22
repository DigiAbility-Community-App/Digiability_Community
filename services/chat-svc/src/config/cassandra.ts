// ─────────────────────────────────────────────────────────────
// Cassandra Client Configuration
//
// Connects to Apache Cassandra for message storage.
// Uses the cassandra-driver package for Node.js.
// ─────────────────────────────────────────────────────────────

import { Client } from "cassandra-driver";
import { logger } from "./logger";

const CASSANDRA_HOST = process.env.CASSANDRA_HOST ?? "localhost";
const CASSANDRA_PORT = parseInt(process.env.CASSANDRA_PORT ?? "9042", 10);
const CASSANDRA_DC = process.env.CASSANDRA_DC ?? "dc1";
const CASSANDRA_KEYSPACE = process.env.CASSANDRA_KEYSPACE ?? "digiability_chat";

const cassandraClient = new Client({
  contactPoints: [`${CASSANDRA_HOST}:${CASSANDRA_PORT}`],
  localDataCenter: CASSANDRA_DC,
  keyspace: CASSANDRA_KEYSPACE,
  queryOptions: {
    consistency: 1, // LOCAL_ONE — fast writes for dev
    prepare: true,
  },
});

/**
 * Connect to Cassandra cluster.
 * Should be called during server startup.
 */
export async function connectCassandra(): Promise<void> {
  try {
    await cassandraClient.connect();
    logger.info("Cassandra connected", {
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
