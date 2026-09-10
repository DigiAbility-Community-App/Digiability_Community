import { Request, Response, NextFunction } from "express";
import {
  getPasswordPolicy,
  validatePasswordAgainstPolicy,
} from "../services/passwordPolicy.service";

/**
 * Enforces the admin-configured password policy on req.body.password.
 *
 * Runs *after* validate(schema) — the Zod schema owns the structural check
 * (a password is present and is a string of sane length) while the live policy
 * owns the actual rules, so an admin changing the policy in Settings takes
 * effect without a redeploy. Emits the same 422 shape as validate() so a
 * policy failure is indistinguishable from a schema failure to a client.
 */
export function enforcePasswordPolicy() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const password = req.body?.password;

    // Nothing to check — the Zod schema already rejected a missing password.
    if (typeof password !== "string") {
      next();
      return;
    }

    try {
      const policy = await getPasswordPolicy();
      const errors = validatePasswordAgainstPolicy(password, policy);

      if (errors.length > 0) {
        res.status(422).json({
          success: false,
          message: "Validation failed",
          errors,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
