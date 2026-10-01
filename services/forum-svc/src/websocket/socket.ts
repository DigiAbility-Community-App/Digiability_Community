import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AccessTokenPayload } from '../middleware/auth.middleware';
import { isSessionActive, SESSION_REVOKED_CHANNEL } from '../services/session.service';
import { createOptionalSubscriber } from '../config/redis';

let io: Server | null = null;
const userSockets = new Map<string, string[]>(); // Map of userId -> socketIds

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) {
    throw new Error('JWT_PUBLIC_KEY is not set in environment');
  }
  return key.replace(/\\n/g, '\n');
}

export function initSocketServer(server: HttpServer, allowedOrigins: string[]): Server {
  io = new Server(server, {
    cors: {
      // Same allowlist as the REST API — never '*'.
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Socket.io Connection Handshake Authentication Middleware
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, getPublicKey(), {
        algorithms: ['RS256'],
      }) as AccessTokenPayload;
    } catch (err) {
      return next(new Error('Invalid or expired authentication token'));
    }

    // A logged-out token can't open a socket (VAPT M-003).
    if (!payload.sid || !(await isSessionActive(payload.sid))) {
      return next(new Error('Session has been revoked'));
    }

    socket.data = { userId: payload.sub, email: payload.email, sid: payload.sid };
    next();
  });

  // With Redis, drop open sockets the moment their session is revoked.
  // Without it, they end when the client disconnects on logout.
  const subscriber = createOptionalSubscriber();
  if (subscriber) {
    subscriber.subscribe(SESSION_REVOKED_CHANNEL).catch((err) =>
      console.error('[Socket] Could not subscribe to session revocations:', err.message)
    );
    subscriber.on('message', (_channel: string, message: string) => {
      try {
        const { sid } = JSON.parse(message) as { sid?: string };
        if (!sid || !io) return;
        for (const s of io.sockets.sockets.values()) {
          if (s.data?.sid === sid) s.disconnect(true);
        }
      } catch {
        // Ignore malformed events
      }
    });
  }

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`[Socket] User connected: ${userId} (${socket.id})`);

    // Track active connection
    const active = userSockets.get(userId) || [];
    active.push(socket.id);
    userSockets.set(userId, active);

    // Join user-specific room for private notifications
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId} (${socket.id})`);
      const current = userSockets.get(userId) || [];
      const updated = current.filter(id => id !== socket.id);
      if (updated.length > 0) {
        userSockets.set(userId, updated);
      } else {
        userSockets.delete(userId);
      }
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io server has not been initialized yet');
  }
  return io;
}

/**
 * Emit an update to all connected clients when forum data changes.
 */
export function broadcastForumEvent(event: string, payload: any): void {
  if (!io) return;
  console.log(`[Socket] Broadcasting event: ${event}`);
  io.emit(event, payload);
}

/**
 * Send a notification to a specific user.
 */
export function sendNotificationToUser(userId: string, notification: any): void {
  if (!io) return;
  console.log(`[Socket] Sending notification to user ${userId}`);
  io.to(`user:${userId}`).emit('notification', notification);
}
