// ─────────────────────────────────────────────────────────────
// Redis Client Singleton
// Single ioredis instance for commands (GET/SET/XADD/etc.)
// Separate instance for Pub/Sub subscriber (ioredis requirement:
// a client in subscribe mode cannot issue other commands).
// ─────────────────────────────────────────────────────────────

import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

function createRedisClient(label: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      logger.warn(`Redis ${label} reconnect attempt ${times}, delay ${delay}ms`);
      return delay;
    },
    lazyConnect: false,
  });

  client.on("connect", () => logger.info(`Redis ${label} connected`));
  client.on("error", (err) => logger.error(`Redis ${label} error`, { error: err.message }));
  client.on("close", () => logger.warn(`Redis ${label} connection closed`));

  return client;
}

/** General-purpose Redis client for commands, streams, registry */
export const redis = createRedisClient("cmd");

/** Dedicated subscriber client for Pub/Sub (cannot share with command client) */
export const redisSub = createRedisClient("sub");

/** Graceful disconnect of both clients */
export async function disconnectRedis(): Promise<void> {
  await Promise.all([
    redis.quit().catch(() => {}),
    redisSub.quit().catch(() => {}),
  ]);
  logger.info("Redis clients disconnected");
}
