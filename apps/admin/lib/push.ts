import Expo, { ExpoPushMessage } from "expo-server-sdk";
import { dbPool } from "@/lib/db";

const expo = new Expo();

/**
 * Send a push notification directly to a set of users' registered devices.
 *
 * Bypasses notif-svc's `/internal/notify` on purpose: that endpoint is
 * deliberately unauthenticated and cluster-internal-only, and this admin
 * panel runs on Vercel outside the cluster network — it can't reach it in
 * production anyway. `device_tokens` lives in the same `public` schema
 * this panel already queries directly, so sending here avoids exposing
 * an unauthenticated internal endpoint publicly just to make it reachable.
 */
export async function sendBroadcastPush(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<number> {
  if (userIds.length === 0) return 0;

  const result = await dbPool.query<{ token: string }>(
    'SELECT token FROM device_tokens WHERE "userId" = ANY($1::text[])',
    [userIds]
  );

  const messages: ExpoPushMessage[] = result.rows
    .map((r) => r.token)
    .filter((t) => Expo.isExpoPushToken(t))
    .map((to) => ({ to, title, body, data, sound: "default" }));

  if (messages.length === 0) return 0;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("[admin] Broadcast push send error:", err);
    }
  }

  return messages.length;
}
