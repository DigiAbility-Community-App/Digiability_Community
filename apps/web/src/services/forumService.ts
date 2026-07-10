// forum-svc runs as its own service (port 4003 locally) — separate from
// user-svc, which `apiClient`'s baseURL points at. Passing an absolute URL
// to an apiClient.get/post call overrides its baseURL for that one request,
// same pattern as CHAT_BASE_URL in chatService.ts.
export const FORUM_BASE_URL = import.meta.env.VITE_FORUM_SVC_URL || 'http://localhost:4003';
