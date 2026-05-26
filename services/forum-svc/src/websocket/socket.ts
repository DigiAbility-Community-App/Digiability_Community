import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AccessTokenPayload } from '../middleware/auth.middleware';

let io: Server | null = null;
const userSockets = new Map<string, string[]>(); // Map of userId -> socketIds

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) {
    throw new Error('JWT_PUBLIC_KEY is not set in environment');
  }
  return key.replace(/\\n/g, '\n');
}

export function initSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust in production as needed
      methods: ['GET', 'POST'],
    },
  });

  // Socket.io Connection Handshake Authentication Middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, getPublicKey(), {
        algorithms: ['RS256'],
      }) as AccessTokenPayload;
      
      socket.data = { userId: payload.sub, email: payload.email };
      next();
    } catch (err) {
      next(new Error('Invalid or expired authentication token'));
    }
  });

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
