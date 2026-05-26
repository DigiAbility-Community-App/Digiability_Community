import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createError } from './error.middleware';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        next(createError(errorMessages, 400));
      } else {
        next(error);
      }
    }
  };
}
