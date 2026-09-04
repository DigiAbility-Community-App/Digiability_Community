// ─────────────────────────────────────────────────────────────
// Formats a message's chat-list preview text. For media messages,
// `content` is the uploaded file's path/URL — show a friendly label
// instead, matching what chat-svc now stores server-side so the
// optimistic local update doesn't flicker/mismatch once confirmed.
// ─────────────────────────────────────────────────────────────

export function formatMessagePreview(type: string, content: string): string {
  switch (type) {
    case 'IMAGE': return '📷 Photo';
    case 'VIDEO': return '🎥 Video';
    case 'AUDIO': return '🎤 Voice message';
    case 'FILE': return '📎 File';
    default: return content;
  }
}
