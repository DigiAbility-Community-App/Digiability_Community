import { randomInt } from 'crypto';

// ─────────────────────────────────────────────────────
// Reference Codes
//
// Short public handle for a report, so a reporter can quote it back to us.
// Mirrors services/user-svc/src/utils/reference-code.util.ts — the two services
// share no code by design (they communicate over HTTP/Redis only), so the
// alphabet and length are duplicated deliberately and must stay in step.
// ─────────────────────────────────────────────────────

// No 0/O, 1/I/L or U — the characters most often misheard when read aloud.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;

export function generateReferenceCode(prefix = 'RPT'): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}
