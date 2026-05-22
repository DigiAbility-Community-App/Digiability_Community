// ─────────────────────────────────────────────────────────────
// Structured Logger
// Production-grade logging with context fields for distributed
// tracing: userId, conversationId, messageId, connId, serverId.
// ─────────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  userId?: string;
  conversationId?: string;
  messageId?: string;
  clientMessageId?: string;
  connId?: string;
  serverId?: string;
  deviceId?: string;
  error?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, ctx?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = ctx && Object.keys(ctx).length > 0
    ? ` ${JSON.stringify(ctx)}`
    : "";
  return `[${timestamp}] [${level.toUpperCase().padEnd(5)}] ${message}${contextStr}`;
}

export const logger = {
  debug(message: string, ctx?: LogContext): void {
    if (shouldLog("debug")) console.debug(formatMessage("debug", message, ctx));
  },

  info(message: string, ctx?: LogContext): void {
    if (shouldLog("info")) console.info(formatMessage("info", message, ctx));
  },

  warn(message: string, ctx?: LogContext): void {
    if (shouldLog("warn")) console.warn(formatMessage("warn", message, ctx));
  },

  error(message: string, ctx?: LogContext): void {
    if (shouldLog("error")) console.error(formatMessage("error", message, ctx));
  },
};
