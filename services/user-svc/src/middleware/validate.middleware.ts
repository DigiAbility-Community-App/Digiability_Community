import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

// ─────────────────────────────────────────────────────
// Zod Validation Middleware
// ─────────────────────────────────────────────────────

/**
 * Validates req.body against a Zod schema.
 * On failure, returns 422 with structured field errors.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      res.status(422).json({
        success: false,
        message: "Validation failed",
        errors,
      });
      return;
    }

    // Replace req.body with parsed (and transformed) data
    req.body = result.data;
    next();
  };
}
