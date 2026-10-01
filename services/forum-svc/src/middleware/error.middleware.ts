import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function createError(message: string, statusCode = 500): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === "production";

  console.error(`[Error] ${req.method} ${req.path} — ${err.message}`, {
    statusCode,
    stack: isProduction ? undefined : err.stack,
  });

  res.status(statusCode).json({
    success: false,
    message: err.isOperational
      ? err.message
      : "An unexpected error occurred. Please try again later.",
    // Only in explicit development — an unset NODE_ENV must not leak stacks.
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}

const GENERIC_ERROR_MESSAGE = "An unexpected error occurred. Please try again later.";

/**
 * For route handlers that catch their own errors instead of passing them to
 * errorHandler. Client errors (createError, or any 4xx) keep their message;
 * anything else is logged and replaced with a generic one, so database or
 * library internals never reach the client.
 */
export function sendRouteError(
  res: Response,
  error: unknown,
  fallbackMessage = GENERIC_ERROR_MESSAGE
): void {
  const err = (error ?? {}) as AppError;
  const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  if (err.isOperational || isClientError) {
    res.status(statusCode).json({ success: false, message: err.message || fallbackMessage });
    return;
  }

  console.error("[Error] unhandled route error:", err.message, err.stack);
  res.status(statusCode).json({ success: false, message: fallbackMessage });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
