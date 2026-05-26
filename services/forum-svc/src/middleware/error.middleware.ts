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
    ...(isProduction ? {} : { stack: err.stack }),
  });
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
