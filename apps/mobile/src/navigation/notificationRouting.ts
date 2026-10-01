import type { NavigationContainerRef } from '@react-navigation/native';
import { useAuthStore } from '@store/authStore';
import { useChatStore } from '@store/chatStore';
import { chatService } from '@services/chatService';

// ─────────────────────────────────────────────────────────
// Notification-tap routing — the app's only deep-link entry point (it has no
// custom URL scheme or App Links in release builds).
//
// A push payload is untrusted input: anything can arrive in `data`. So a tap
//   1. only accepts known types with well-formed UUIDs,
//   2. never navigates while signed out — the target is held until the user
//      is authenticated, then replayed (and dropped on logout),
//   3. only opens a conversation the signed-in user is actually a member of.
//      chat-svc enforces membership too; this just avoids opening a broken
//      screen for someone else's conversation.
// ─────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NotificationTarget =
  | { kind: 'question'; questionId: string }
  | { kind: 'conversation'; conversationId: string };

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function parseNotificationTarget(data: unknown): NotificationTarget | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  // chat-svc pushes carry no type; notif-svc labels them "message".
  const type = typeof d.type === 'string' ? d.type : 'message';

  if (type === 'forum_answer') {
    return isUuid(d.questionId) ? { kind: 'question', questionId: d.questionId } : null;
  }
  if (type === 'message') {
    return isUuid(d.conversationId) ? { kind: 'conversation', conversationId: d.conversationId } : null;
  }
  return null;
}

type Nav = NavigationContainerRef<any>;

let pending: NotificationTarget | null = null;

/** The signed-in navigator ("Main") is mounted and can take a navigate(). */
function mainIsMounted(nav: Nav): boolean {
  return nav.isReady() && (nav.getRootState()?.routeNames ?? []).includes('Main');
}

async function navigateTo(nav: Nav, target: NotificationTarget): Promise<void> {
  if (target.kind === 'question') {
    nav.navigate('Main', { screen: 'QuestionDetails', params: { questionId: target.questionId } });
    return;
  }

  let conversation = useChatStore.getState().conversations[target.conversationId];
  if (!conversation) {
    // Not loaded yet (cold start) — fetch the user's own conversations.
    try {
      useChatStore.getState().setConversations(await chatService.getConversations());
    } catch {
      return;
    }
    conversation = useChatStore.getState().conversations[target.conversationId];
  }
  if (!conversation) return; // not a member

  if (conversation.type === 'DIRECT') {
    const myUserId = useAuthStore.getState().user?.id;
    const other = conversation.participants?.find((p) => p.userId !== myUserId)?.user;
    nav.navigate('Main', {
      screen: 'Chats',
      params: {
        screen: 'Chat',
        params: {
          conversationId: target.conversationId,
          recipientName: other?.name ?? '',
          recipientAvatar: other?.avatarUrl,
        },
      },
    });
    return;
  }

  nav.navigate('Main', {
    screen: 'Chats',
    params: {
      screen: 'GroupChat',
      params: {
        conversationId: target.conversationId,
        groupName: conversation.name ?? '',
        subType: conversation.subType,
      },
    },
  });
}

/** Handle a notification tap. Invalid payloads are ignored. */
export async function routeNotificationTap(nav: Nav | null, data: unknown): Promise<void> {
  const target = parseNotificationTarget(data);
  if (!target) return;

  if (!nav || !useAuthStore.getState().isAuthenticated || !mainIsMounted(nav)) {
    pending = target;
    return;
  }
  await navigateTo(nav, target);
}

/**
 * Replay a tap that arrived while signed out / still restoring the session.
 * Called whenever auth state changes; a no-op until the signed-in UI is up.
 */
export async function flushPendingNotificationRoute(nav: Nav | null): Promise<void> {
  if (!pending) return;
  if (!useAuthStore.getState().isAuthenticated) return;
  if (!nav || !mainIsMounted(nav)) return;
  const target = pending;
  pending = null;
  await navigateTo(nav, target);
}

/** Forget any held target (logout). */
export function clearPendingNotificationRoute(): void {
  pending = null;
}
