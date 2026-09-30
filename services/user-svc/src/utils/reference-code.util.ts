import { randomInt } from "crypto";

// ─────────────────────────────────────────────────────
// Reference Codes
//
// Short, human-readable identifiers a person can quote back to us over the
// phone or in an email. The Community Guidelines promise a reporter "a
// reference number", the Terms promise a grievance "ticket reference", and an
// appeal has to name the decision it disputes — all three want the same thing.
//
// Deliberately not the UUID primary key: a UUID is unreadable aloud, and
// exposing it leaks nothing useful but invites people to paste internal ids
// around. This is a separate public-facing handle.
// ─────────────────────────────────────────────────────

// Crockford-style alphabet: no 0/O, 1/I/L, U — the characters people most
// often mishear or mistype when reading a code back to support.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 8;

export type ReferencePrefix = "RPT" | "GRV" | "APL";

/**
 * Generate a reference code such as `RPT-7F3KM2QA`.
 *
 * Uses crypto.randomInt rather than Math.random so codes aren't predictable —
 * a guessable reference would let someone enumerate other people's reports.
 * With a 30-character alphabet over 8 places there are ~6.6e11 possibilities,
 * so collisions are vanishingly unlikely; callers that store it in a UNIQUE
 * column should still retry on a constraint violation rather than assume.
 */
export function generateReferenceCode(prefix: ReferencePrefix): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}

/**
 * Create a record that carries a unique reference code, retrying if the code
 * collides. `create` receives the candidate code and should perform the insert.
 */
export async function withReferenceCode<T>(
  prefix: ReferencePrefix,
  create: (referenceCode: string) => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await create(generateReferenceCode(prefix));
    } catch (err) {
      // P2002 is Prisma's unique-constraint violation. Anything else is a real
      // failure and must not be retried behind the caller's back.
      const code = (err as { code?: string })?.code;
      if (code !== "P2002") throw err;
      lastError = err;
    }
  }
  throw lastError;
}
