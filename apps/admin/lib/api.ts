// ─────────────────────────────────────────────────────────────
// Thin fetch wrapper for admin-panel client components.
//
// Every admin API route rejects an expired/missing session with
// `{success:false, message:"Unauthorized"}` at 401 (requireAdminAuth in
// lib/auth.ts) — the admin-session cookie lives 24h, and until now nothing
// on the client handled that: pages displayed the raw "Unauthorized" string
// inline as if it were an ordinary validation error, with no indication the
// session had ended or how to fix it. apiFetch() flags a 401 distinctly so
// callers can redirect to /login instead of showing it as a form error.
// ─────────────────────────────────────────────────────────────

export interface ApiResult<T = any> {
  ok: boolean;
  /** True only on a 401 — session expired or missing. */
  sessionExpired: boolean;
  data: T;
}

export async function apiFetch<T = any>(
  input: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, sessionExpired: res.status === 401, data };
}
