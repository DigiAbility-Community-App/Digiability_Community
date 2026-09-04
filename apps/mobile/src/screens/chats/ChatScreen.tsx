import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Animated,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useFocusEffect } from "@react-navigation/native";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore, ChatMessage } from "@store/chatStore";
import { chatService } from "@services/chatService";
import { sendSocketMessage } from "@services/socketService";
import * as Speech from "expo-speech";
import { generateUUID } from "../../utils/uuid";
import { useChatMedia } from "@hooks/useChatMedia";
import { MessageMedia, hasCaption } from "../../components/chat/MessageMedia";
import { MediaViewer } from "../../components/chat/MediaViewer";
import { AltTextModal } from "../../components/chat/AltTextModal";
import { ReportModal } from "../../components/chat/ReportModal";
import { ActionSheet, ActionSheetOption } from "../../components/chat/ActionSheet";
import { ConfirmDialog } from "../../components/chat/ConfirmDialog";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Send, ArrowLeft, MoreVertical, Paperclip, Mic, Image as ImageIcon, Smile, Check, CheckCheck, Plus, Square, Trash2, Volume2, Flag, Ban, CircleCheck, TriangleAlert, AlertCircle, User, CornerUpLeft, X } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { LinkifiedText } from "../../components/shared/LinkifiedText";
import { istDateKey, formatDateLabel } from "../../utils/dateHelpers";

// ─────────────────────────────────────────────────────────
// 1:1 Chat Screen — Direct Message Thread
//
// Full chat UI with:
// - Message bubbles (sent/received)
// - Delivery/read receipts (✓ ✓✓)
// - Typing indicator
// - Message composer with attachments
// - Date separators
// - User presence status
//
// Uses demo messages for the demo build.
// ─────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<ChatsStackParamList, "Chat">;
  route: RouteProp<ChatsStackParamList, "Chat">;
};

// Format a presence "last seen" ISO timestamp into a short relative string.
function formatLastSeen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

const ChatScreen = ({ navigation, route }: Props) => {
  const { conversationId, recipientName, recipientAvatar, isOnline } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, highContrast } = useTheme();
  const user = useAuthStore((s) => s.user);
  const storeMessages = useChatStore((s) => s.messages[conversationId] || []);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const typingUserIds = useChatStore((s) => s.typing[conversationId]);
  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const presenceMap = useChatStore((s) => s.presence);
  const clearUnreadCount = useChatStore((s) => s.clearUnreadCount);

  // Track whether this screen is currently focused (visible to the user).
  // We only send read receipts when the screen is focused so that navigating
  // away does NOT incorrectly mark messages as seen.
  const isFocusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      // Mark messages read immediately on focus
      clearUnreadCount(conversationId);
      const msgs = useChatStore.getState().messages[conversationId] || [];
      const lastFromOther = [...msgs].reverse().find((m) => m.senderId !== user?.id);
      if (lastFromOther?.id) {
        sendSocketMessage("message.read", { messageId: lastFromOther.id, conversationId });
      }
      return () => {
        // Screen is losing focus — stop marking new arrivals as read
        isFocusedRef.current = false;
      };
    }, [conversationId, user?.id])
  );

  // When new messages arrive while this screen is already focused, mark them
  // read immediately. Without focus the useEffect is a no-op.
  useEffect(() => {
    if (!isFocusedRef.current) return;
    const msgs = useChatStore.getState().messages[conversationId] || [];
    const lastFromOther = [...msgs].reverse().find((m) => m.senderId !== user?.id);
    if (lastFromOther?.id) {
      clearUnreadCount(conversationId);
      sendSocketMessage("message.read", { messageId: lastFromOther.id, conversationId });
    }
  }, [storeMessages.length]);

  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [mediaViewer, setMediaViewer] = useState<{ src: string; alt: string; isVideo: boolean } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Stop any active speech when the screen loses focus (e.g. user navigates away)
  // This prevents speech from looping or continuing in the background.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const openMediaViewer = useCallback((src: string, alt: string, isVideo: boolean) => {
    setMediaViewer({ src, alt, isVideo });
  }, []);
  const closeMediaViewer = useCallback(() => {
    setMediaViewer(null);
  }, []);

  // Peer presence — resolve the other DM participant, then read live presence.
  const peerId = useMemo(
    () => conversation?.participants?.find((p) => p.userId !== user?.id)?.userId,
    [conversation, user?.id]
  );
  const peerPresence = peerId ? presenceMap[peerId] : undefined;
  const updatePresence = useChatStore((s) => s.updatePresence);

  // Presence isn't pushed over WS — fetch it when the chat opens and refresh
  // periodically so the header shows Online / last-seen.
  useEffect(() => {
    if (!peerId) return;
    let active = true;
    const fetchPresence = async () => {
      const p = await chatService.getPresence(peerId);
      if (active && p) updatePresence(peerId, p.status, p.lastSeen);
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [peerId, updatePresence]);

  // Someone (not me) is typing in this conversation.
  const someoneTyping = (typingUserIds || []).some((id) => id !== user?.id);

  // Voice notes + image sharing.
  const media = useChatMedia(conversationId, user?.id);

  // Emit typing.start while the user types; auto-stop after idle.
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingActiveRef = useRef(false);
  const emitTypingStop = useCallback(() => {
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      sendSocketMessage("typing.stop", { conversationId });
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
  }, [conversationId]);
  const handleTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
      if (text.length > 0) {
        if (!isTypingActiveRef.current) {
          isTypingActiveRef.current = true;
          sendSocketMessage("typing.start", { conversationId });
        }
        if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
        typingStopTimer.current = setTimeout(emitTypingStop, 2500);
      } else {
        emitTypingStop();
      }
    },
    [conversationId, emitTypingStop]
  );
  useEffect(() => () => emitTypingStop(), [emitTypingStop]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const flatListRef = useRef<FlatList>(null);

  // Deduplicate messages — prefer server-confirmed messages over optimistic ones
  const dedupedMessages = useMemo(() => {
    const seen = new Map<string, ChatMessage>();
    const seenClientIds = new Map<string, string>(); // clientMessageId → best id

    for (const msg of storeMessages) {
      // Track by clientMessageId to collapse optimistic + confirmed copies
      if (msg.clientMessageId) {
        const existingKey = seenClientIds.get(msg.clientMessageId);
        if (existingKey) {
          // Keep the one with the server id (id !== clientMessageId)
          const existing = seen.get(existingKey);
          if (existing && existing.id === existing.clientMessageId && msg.id !== msg.clientMessageId) {
            // Current msg is server-confirmed, replace the optimistic one
            seen.delete(existingKey);
            seen.set(msg.id, msg);
            seenClientIds.set(msg.clientMessageId, msg.id);
          }
          continue; // Skip duplicate
        }
        seenClientIds.set(msg.clientMessageId, msg.id);
      }

      if (!seen.has(msg.id)) {
        seen.set(msg.id, msg);
      }
    }

    return Array.from(seen.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [storeMessages]);

  const listData = useMemo(() => [...dedupedMessages].reverse(), [dedupedMessages]);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = (await chatService.getMessages(conversationId)) as ChatMessage[];
        // Merge REST history with any messages already in the store
        // (from WebSocket / optimistic sends) to avoid losing them.
        const existing = useChatStore.getState().messages[conversationId] || [];
        const existingIds = new Set(existing.map(m => m.id));
        const existingClientIds = new Set(existing.map(m => m.clientMessageId));
        
        // Add only truly new messages from REST that we don't already have
        const merged: ChatMessage[] = [...existing];
        for (const msg of data) {
          if (!existingIds.has(msg.id) && !existingClientIds.has(msg.clientMessageId)) {
            merged.push(msg);
          }
        }
        
        // Sort by createdAt
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(conversationId, merged);
      } catch (err) {
        console.error("Failed to load messages", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadMessages();
  }, [conversationId]);

  const isSendingRef = React.useRef(false);

  const handleSend = useCallback(() => {
    if (!messageText.trim() || !user) return;
    if (isSendingRef.current) return; // prevent double-tap
    isSendingRef.current = true;

    const content = messageText.trim();
    const clientMessageId = generateUUID();

    const metadataObj: any = {};
    if (replyingTo) {
      metadataObj.replyTo = {
        id: replyingTo.id,
        content: replyingTo.content,
        senderName: replyingTo.senderId === user.id ? "You" : recipientName
      };
    }
    const metadata = Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : undefined;

    const newMsg: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      conversationId,
      senderId: user.id,
      content,
      type: "TEXT",
      status: "sent",
      createdAt: new Date().toISOString(),
      metadata,
    };

    addMessage(newMsg);
    setMessageText("");
    emitTypingStop();

    setReplyingTo(null);

    const sent = sendSocketMessage("message.send", {
      conversationId,
      content,
      type: "TEXT",
      clientMessageId,
      senderName: user?.name,
      metadata,
    });
    if (!sent) {
      // Never leave the optimistic bubble looking delivered when nothing
      // left the device — the failed status drives the themed dialog below.
      useChatStore.getState().failMessage(clientMessageId, "You appear to be offline. The message wasn't sent.");
    }

    // Re-enable after a brief debounce
    setTimeout(() => { isSendingRef.current = false; }, 300);
  }, [messageText, conversationId, user]);

  // Send button doubles as a voice-note mic when the input is empty.
  const onSendOrMic = useCallback(() => {
    if (messageText.trim()) {
      handleSend();
      return;
    }
    if (media.isRecording) media.stopAndSendRecording();
    else media.startRecording();
  }, [messageText, handleSend, media]);

  // ── Block / Report / Delete (stylish modals) ──────────────
  const [messageMenu, setMessageMenu] = useState<ChatMessage | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [reportReasonOpen, setReportReasonOpen] = useState(false);
  // Set when reporting a specific message (long-press → "Report message"),
  // so the report carries messageId context instead of just the user.
  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message?: string;
    icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    confirmLabel: string;
    destructive?: boolean;
    hideCancel?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Surface a themed dialog the moment a message we sent gets rejected
  // (blocked, moderation, ...) — failMessage() in the store sets
  // status:'failed' + failureReason, this just watches for it. The
  // acknowledged flag lives in the store (not a local ref) so it survives
  // leaving and re-entering this screen — a ref resets on every remount and
  // would otherwise re-show the dialog for the same message each time.
  useEffect(() => {
    const latestFailed = [...storeMessages].reverse().find(
      (m) => m.status === "failed" && !m.failureAcknowledged
    );
    if (latestFailed) {
      useChatStore.getState().acknowledgeMessageFailure(latestFailed.clientMessageId);
      setConfirmState({
        title: "Message Not Sent",
        message: latestFailed.failureReason || "Your message could not be delivered.",
        confirmLabel: "OK",
        destructive: true,
        hideCancel: true,
        onConfirm: () => setConfirmState(null),
      });
    }
  }, [storeMessages]);

  const submitReport = useCallback(
    (reason: string, details?: string) => {
      if (!peerId) return;
      const messageId = reportTargetMessageId ?? undefined;
      const finalReason = details ? `${reason} — ${details}` : reason;
      chatService
        .reportUser({ reportedUserId: peerId, conversationId, messageId, reason: finalReason })
        .then(() =>
          setConfirmState({
            title: "Report submitted",
            message: "Thank you. Our team will review this.",
            icon: CircleCheck,
            confirmLabel: "Done",
            hideCancel: true,
            onConfirm: () => {},
          })
        )
        .catch(() =>
          setConfirmState({
            title: "Couldn't submit",
            message: "Something went wrong. Please try again.",
            icon: TriangleAlert,
            confirmLabel: "OK",
            hideCancel: true,
            onConfirm: () => {},
          })
        )
        .finally(() => setReportTargetMessageId(null));
    },
    [peerId, conversationId, reportTargetMessageId]
  );

  const askBlock = useCallback(() => {
    if (!peerId) return;
    setConfirmState({
      title: `Block ${recipientName}?`,
      message: "They won't be able to message you, and you won't be able to message them.",
      icon: Ban,
      confirmLabel: "Block",
      destructive: true,
      onConfirm: () => {
        chatService
          .blockUser(peerId)
          .then(() =>
            setConfirmState({
              title: "Blocked",
              message: `You have blocked ${recipientName}.`,
              icon: CircleCheck,
              confirmLabel: "Done",
              hideCancel: true,
              onConfirm: () => {},
            })
          )
          .catch(() => {});
      },
    });
  }, [peerId, recipientName]);

  const askDelete = useCallback(
    (item: ChatMessage, deleteFor: "me" | "everyone") => {
      setConfirmState({
        title: deleteFor === "everyone" ? "Delete for everyone?" : "Delete for me?",
        message: "This action can't be undone.",
        icon: Trash2,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: () => {
          sendSocketMessage("message.delete", { messageId: item.id, conversationId, deleteFor });
          removeMessage(conversationId, item.id);
        },
      });
    },
    [conversationId, removeMessage]
  );

  const handleHeaderMenu = useCallback(() => {
    if (!peerId) return;
    setHeaderMenuOpen(true);
  }, [peerId]);

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "sending":
        return <AccessibleText variant="caption" style={styles.statusIcon}>...</AccessibleText>;
      case "sent":
        return <Check size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />;
      case "delivered":
        return <CheckCheck size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />;
      case "read":
        return <CheckCheck size={14} color="#38bdf8" style={{ marginLeft: 4 }} />;
      case "failed":
        return <AlertCircle size={14} color="#EF4444" style={{ marginLeft: 4 }} />;
      default:
        return null;
    }
  };

  // ── Message long-press → stylish action sheet ───────────────
  const handleMessageLongPress = (item: ChatMessage) => {
    if (!item.id || item.status === "sending") return;
    setMessageMenu(item);
  };

  // Options for the message action sheet, derived from the current target.
  const messageMenuOptions: ActionSheetOption[] = (() => {
    if (!messageMenu) return [];
    const item = messageMenu;
    const isMine = item.senderId === user?.id;
    // Super Admin / platform Admin can delete any message for everyone
    const isSuperAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
    const opts: ActionSheetOption[] = [];
    opts.push({ label: "Reply", icon: CornerUpLeft, onPress: () => setReplyingTo(item) });
    if (item.type === "TEXT" && item.content?.trim()) {
      if (speakingId === item.id) {
        opts.push({ label: "Stop reading aloud", icon: Volume2, onPress: () => {
          Speech.stop();
          setSpeakingId(null);
        }});
      } else {
        opts.push({ label: "Read aloud", icon: Volume2, onPress: () => {
          Speech.stop();
          setSpeakingId(item.id);
          Speech.speak(item.content, {
            language: "en-IN",
            onDone: () => setSpeakingId(null),
            onStopped: () => setSpeakingId(null),
            onError: () => setSpeakingId(null),
          });
        }});
      }
    }
    // Don't allow reporting messages sent by platform admins/super admins
    const senderIsAdmin = (
      item.senderId === "admin" ||
      item.senderId === "system" ||
      item.senderId === "digiability-admin" ||
      item.type === "SYSTEM"
    );
    let meta: any = null;
    try { meta = item.metadata ? (typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata) : null; } catch {}
    const senderIsPlatformAdmin = senderIsAdmin || meta?.isAdmin === true || meta?.senderName === "DigiAbility Admin";
    if (!isMine && !senderIsPlatformAdmin) {
      opts.push({
        label: "Report message",
        icon: Flag,
        destructive: true,
        onPress: () => {
          setReportTargetMessageId(item.id);
          setReportReasonOpen(true);
        },
      });
    }
    opts.push({ label: "Delete for me", icon: Trash2, destructive: true, onPress: () => askDelete(item, "me") });
    if (isMine || isSuperAdmin) {
      opts.push({ label: "Delete for everyone", icon: Trash2, destructive: true, onPress: () => askDelete(item, "everyone") });
    }
    return opts;
  })();

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.senderId === user?.id;
    const timeString = item.createdAt 
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : "";

    // The list is inverted (newest first).
    // The previous message chronologically is at index + 1 (the one "above" visually).
    // Show date separator below the message (visually above) if date key changes.
    const msgDateKey = item.createdAt ? istDateKey(new Date(item.createdAt)) : "";
    const prevMsg = listData[index + 1];
    const prevMsgDateKey = prevMsg?.createdAt ? istDateKey(new Date(prevMsg.createdAt)) : "";
    
    // We show a separator if there is no previous message (it's the first message ever),
    // or if the previous message has a different date.
    const showDateSep = msgDateKey && (!prevMsg || msgDateKey !== prevMsgDateKey);

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateLine, { backgroundColor: dateLineColor }]} />
            <AccessibleText
              variant="caption"
              style={[styles.dateText, { color: colors.primary, backgroundColor: colors.surface }, cardBorder]}
            >
              {formatDateLabel(msgDateKey)}
            </AccessibleText>
            <View style={[styles.dateLine, { backgroundColor: dateLineColor }]} />
          </View>
        )}
        <SwipeableMessageRow onReply={() => setReplyingTo(item)} colors={colors}>
          <View
            style={[
              styles.messageBubbleContainer,
              isMine ? styles.myBubbleContainer : styles.theirBubbleContainer,
            ]}
          >
          <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => handleMessageLongPress(item as ChatMessage)}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityLabel={isMine ? "Your message" : `Message from ${recipientName}`}
          accessibilityHint="Double tap and hold for message options"
          style={[
            styles.messageBubble,
            isMine ? styles.myBubble : styles.theirBubble,
            isMine
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.card, shadowColor: colors.primary },
            !isMine && cardBorder,
            (item.type === "IMAGE" || item.type === "VIDEO") && styles.mediaBubble,
          ]}
        >
          {(() => {
            const meta = item.metadata ? JSON.parse(item.metadata) : null;
            if (meta?.replyTo) {
              return (
                <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: isMine ? '#fff' : colors.primary }}>
                  <AccessibleText variant="caption" style={{ color: isMine ? '#fff' : colors.primary, fontWeight: 'bold', marginBottom: 2 }}>
                    {meta.replyTo.senderName}
                  </AccessibleText>
                  <AccessibleText variant="caption" numberOfLines={1} style={{ color: isMine ? 'rgba(255,255,255,0.9)' : colors.text }}>
                    {meta.replyTo.content}
                  </AccessibleText>
                </View>
              );
            }
            return null;
          })()}
          {item.deletedAt ? (
            <View style={styles.textBubbleContainer}>
              <AccessibleText
                variant="body"
                style={[
                  styles.messageText,
                  { color: isMine ? "rgba(255,255,255,0.7)" : colors.subtext, fontStyle: "italic" },
                ]}
              >
                This message was removed
              </AccessibleText>
              <View style={styles.messageFooter}>
                <AccessibleText
                  variant="caption"
                  style={[styles.messageTime, { color: isMine ? "rgba(255,255,255,0.7)" : colors.subtext }]}
                >
                  {timeString}
                </AccessibleText>
              </View>
            </View>
          ) : (item.type === "IMAGE" || item.type === "VIDEO") ? (
            <View style={styles.mediaBubbleInner}>
              <MessageMedia message={item} isMine={isMine} onOpenViewer={openMediaViewer} onLongPress={() => handleMessageLongPress(item)} />
              {hasCaption(item) ? (
                // With a caption the overlay would sit on top of the last
                // line of text — put the time in normal flow underneath.
                <View style={styles.mediaCaptionFooter}>
                  <AccessibleText variant="caption" style={[styles.messageTime, { color: isMine ? "rgba(255,255,255,0.7)" : colors.subtext }]}>
                    {timeString}
                  </AccessibleText>
                  {isMine && renderStatusIcon(item.status)}
                </View>
              ) : (
                <View style={styles.mediaTimeOverlay}>
                  <AccessibleText style={[styles.mediaTimeText, { color: "#fff" }]}>
                    {timeString}
                  </AccessibleText>
                  {isMine && renderStatusIcon(item.status)}
                </View>
              )}
            </View>
          ) : item.type === "AUDIO" ? (
            <View>
              <MessageMedia message={item} isMine={isMine} onOpenViewer={openMediaViewer} onLongPress={() => handleMessageLongPress(item)} />
              <View style={styles.messageFooter}>
                <AccessibleText variant="caption" style={[styles.messageTime, { color: isMine ? "rgba(255,255,255,0.65)" : colors.subtext }]}>
                  {timeString}
                </AccessibleText>
                {isMine && renderStatusIcon(item.status)}
              </View>
            </View>
          ) : (
            <View style={styles.textBubbleContainer}>
              <LinkifiedText
                variant="body"
                text={item.content}
                style={[
                  styles.messageText,
                  { color: isMine ? colors.white : colors.text },
                ]}
                linkStyle={{ color: isMine ? "rgba(255,255,255,0.9)" : colors.primary }}
              />
              <View style={styles.messageFooter}>
                <AccessibleText
                  variant="caption"
                  numberOfLines={1}
                  style={[
                    styles.messageTime,
                    { color: isMine ? "rgba(255,255,255,0.7)" : colors.subtext },
                  ]}
                >
                  {timeString}
                </AccessibleText>
                {isMine && renderStatusIcon(item.status)}
              </View>
            </View>
          )}
        </TouchableOpacity>
        </View>
        </SwipeableMessageRow>
      </View>
    );
  };

  // ── Theme-derived, high-contrast-aware colors ───────────────
  // Standard card outline so white cards/bubbles stay visible against a
  // (also white, under high contrast) screen background.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };
  // Date-separator divider — a light tint of primary normally, solid-ish
  // black under high contrast so it doesn't disappear against the bg.
  const dateLineColor = highContrast ? "rgba(0,0,0,0.3)" : "rgba(138,56,245,0.15)";
  // Typing-indicator dots — swap the soft lavender for black under HC.
  const typingDotColor = highContrast ? "#000000" : "#C4B5FD";

  return (
    <ScreenWrapper withBottomSafeArea={false}>
      {/* ── Header — paddingTop uses insets so it clears the translucent status bar */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.primary }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the conversation list"
        >
          <ArrowLeft size={24} color={colors.white} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          <View style={styles.headerAvatarContainer}>
            <View style={styles.headerAvatar}>
              {recipientAvatar ? (
                <AccessibleText style={styles.headerAvatarEmoji}>{recipientAvatar}</AccessibleText>
              ) : (
                <User size={22} color={colors.white} strokeWidth={2} />
              )}
            </View>
            {(peerPresence?.status === "online" || (!peerPresence && isOnline)) && (
              <View style={[styles.headerOnlineDot, { borderColor: colors.primary }]} />
            )}
          </View>

          <View style={styles.headerInfo}>
            <AccessibleText
              variant="title"
              style={[styles.headerName, { color: colors.white }]}
              numberOfLines={1}
            >
              {recipientName}
            </AccessibleText>
            <AccessibleText
              variant="caption"
              style={[styles.headerStatus, { color: "rgba(255,255,255,0.7)" }]}
            >
              {someoneTyping
                ? "typing…"
                : peerPresence?.status === "online"
                ? "Online"
                : peerPresence?.lastSeen
                ? `Last seen ${formatLastSeen(peerPresence.lastSeen)}`
                : isOnline
                ? "Online"
                : "Offline"}
            </AccessibleText>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleHeaderMenu}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <MoreVertical size={20} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages List ────────────────────────────────── */}
      <View style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? (keyboardHeight > 0 ? keyboardHeight + 10 : 0) : 0 }}>
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
            {/* iOS wrapper */}
            <FlatList
              ref={flatListRef}
              data={listData}
              inverted
              keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 10 }]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                someoneTyping ? (
                  <View style={styles.typingContainer}>
                    <View style={[styles.typingBubble, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
                      <View style={styles.typingDots}>
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot1]} />
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot2]} />
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot3]} />
                      </View>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* ── Composer ───────────────────────────────────────── */}
            {media.isRecording && (
              <View style={[styles.recordingBar, { backgroundColor: colors.card }, cardBorder]}>
                <AccessibleText variant="body" style={[styles.recordingText, { color: colors.error }]}>
                  ● Recording… tap ⏹ to send
                </AccessibleText>
                <TouchableOpacity
                  onPress={media.cancelRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel recording"
                >
                  <AccessibleText variant="body" style={[styles.recordingCancel, { color: colors.subtext }]}>
                    Cancel
                  </AccessibleText>
                </TouchableOpacity>
              </View>
            )}
            {replyingTo && (
              <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: colors.primary }}>
                <View style={{ flex: 1 }}>
                  <AccessibleText variant="caption" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 4 }}>
                    Replying to {replyingTo.senderId === user?.id ? "Yourself" : recipientName}
                  </AccessibleText>
                  <AccessibleText variant="caption" numberOfLines={1} style={{ color: colors.subtext }}>
                    {replyingTo.content}
                  </AccessibleText>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
                  <X size={20} color={colors.subtext} />
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={[styles.composerCard, { backgroundColor: colors.card, shadowColor: colors.secondary }, cardBorder]}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={media.pickMedia}
                  disabled={media.isUploading}
                  accessibilityRole="button"
                  accessibilityLabel="Attach image"
                  accessibilityHint="Opens your photo library to attach an image"
                >
                  {media.isUploading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <ImageIcon size={24} color={colors.primary} strokeWidth={2} />}
                </TouchableOpacity>

                <View style={[styles.inputPill, { backgroundColor: colors.surface }, cardBorder]}>
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.subtext}
                    value={messageText}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={5000}
                    accessibilityLabel="Message input"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.micBtn,
                    media.isRecording && [styles.micBtnRecording, { backgroundColor: colors.error }],
                  ]}
                  onPress={() => (media.isRecording ? media.stopAndSendRecording() : media.startRecording())}
                  accessibilityRole="button"
                  accessibilityLabel={media.isRecording ? "Stop and send voice note" : "Record voice note"}
                >
                  {media.isRecording
                    ? <Square size={16} color={colors.white} fill={colors.white} />
                    : <Mic size={20} color={colors.white} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendCircle, { backgroundColor: colors.primary }, !messageText.trim() && styles.sendCircleDisabled]}
                  onPress={handleSend}
                  disabled={!messageText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  accessibilityHint="Sends the typed message"
                >
                  <Send size={19} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          /* Android wrapper */
          <>
            <FlatList
              ref={flatListRef}
              data={listData}
              inverted
              keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 10 }]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                someoneTyping ? (
                  <View style={styles.typingContainer}>
                    <View style={[styles.typingBubble, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
                      <View style={styles.typingDots}>
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot1]} />
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot2]} />
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot3]} />
                      </View>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* ── Composer ───────────────────────────────────────── */}
            {media.isRecording && (
              <View style={[styles.recordingBar, { backgroundColor: colors.card }, cardBorder]}>
                <AccessibleText variant="body" style={[styles.recordingText, { color: colors.error }]}>
                  ● Recording… tap ⏹ to send
                </AccessibleText>
                <TouchableOpacity
                  onPress={media.cancelRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel recording"
                >
                  <AccessibleText variant="body" style={[styles.recordingCancel, { color: colors.subtext }]}>
                    Cancel
                  </AccessibleText>
                </TouchableOpacity>
              </View>
            )}
            {replyingTo && (
              <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: colors.primary }}>
                <View style={{ flex: 1 }}>
                  <AccessibleText variant="caption" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 4 }}>
                    Replying to {replyingTo.senderId === user?.id ? "Yourself" : recipientName}
                  </AccessibleText>
                  <AccessibleText variant="caption" numberOfLines={1} style={{ color: colors.subtext }}>
                    {replyingTo.content}
                  </AccessibleText>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
                  <X size={20} color={colors.subtext} />
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={[styles.composerCard, { backgroundColor: colors.card, shadowColor: colors.secondary }, cardBorder]}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={media.pickMedia}
                  disabled={media.isUploading}
                  accessibilityRole="button"
                  accessibilityLabel="Attach image"
                  accessibilityHint="Opens your photo library to attach an image"
                >
                  {media.isUploading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <ImageIcon size={24} color={colors.primary} strokeWidth={2} />}
                </TouchableOpacity>

                <View style={[styles.inputPill, { backgroundColor: colors.surface }, cardBorder]}>
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.subtext}
                    value={messageText}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={5000}
                    accessibilityLabel="Message input"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.micBtn,
                    media.isRecording && [styles.micBtnRecording, { backgroundColor: colors.error }],
                  ]}
                  onPress={() => (media.isRecording ? media.stopAndSendRecording() : media.startRecording())}
                  accessibilityRole="button"
                  accessibilityLabel={media.isRecording ? "Stop and send voice note" : "Record voice note"}
                >
                  {media.isRecording
                    ? <Square size={16} color={colors.white} fill={colors.white} />
                    : <Mic size={20} color={colors.white} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendCircle, { backgroundColor: colors.primary }, !messageText.trim() && styles.sendCircleDisabled]}
                  onPress={handleSend}
                  disabled={!messageText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  accessibilityHint="Sends the typed message"
                >
                  <Send size={19} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      <AltTextModal
        visible={!!media.pendingImageUri}
        imageUri={media.pendingImageUri}
        onCancel={media.cancelPendingImage}
        onSend={media.sendPendingImage}
      />

      {/* Message long-press actions */}
      <ActionSheet
        visible={!!messageMenu}
        title="Message"
        options={messageMenuOptions}
        onClose={() => setMessageMenu(null)}
      />

      {/* DM header ⋮ menu */}
      <ActionSheet
        visible={headerMenuOpen}
        title={recipientName}
        options={[
          { label: "Report user", icon: Flag, onPress: () => setReportReasonOpen(true) },
          { label: "Block user", icon: Ban, destructive: true, onPress: askBlock },
        ]}
        onClose={() => setHeaderMenuOpen(false)}
      />

      {/* Report reason picker with description & custom category */}
      <ReportModal
        visible={reportReasonOpen}
        title="Report reason"
        subtitle={reportTargetMessageId ? "Why are you reporting this message?" : "Why are you reporting this user?"}
        onClose={() => {
          setReportReasonOpen(false);
          setReportTargetMessageId(null);
        }}
        onSubmit={submitReport}
      />

      {/* Confirm / info dialog */}
      <ConfirmDialog
        visible={!!confirmState}
        title={confirmState?.title || ""}
        message={confirmState?.message}
        icon={confirmState?.icon}
        confirmLabel={confirmState?.confirmLabel}
        destructive={confirmState?.destructive}
        hideCancel={confirmState?.hideCancel}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
      {/* Full-screen Media Viewer */}
      {mediaViewer && (
        <MediaViewer
          visible={!!mediaViewer}
          src={mediaViewer.src}
          alt={mediaViewer.alt}
          isVideo={mediaViewer.isVideo}
          onClose={closeMediaViewer}
        />
      )}
    </ScreenWrapper>
  );
};

const SwipeableMessageRow = React.memo(({ children, onReply, colors }: any) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [0, 50],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={{ justifyContent: 'center', alignItems: 'center', width: 60 }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <CornerUpLeft color={colors.primary} size={24} />
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={() => {
        onReply();
        swipeableRef.current?.close();
      }}
      friction={2}
      leftThreshold={40}
    >
      {children}
    </Swipeable>
  );
});

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3EAFF",
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    // paddingTop is now dynamic via insets (set inline)
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  backText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatarContainer: {
    position: "relative",
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarEmoji: {
    fontSize: 20,
  },
  headerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionIcon: {
    fontSize: 18,
    color: "#fff",
  },

  // ── Messages ────────────────────────────────────────────
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 8,
  },

  // Date separator
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  dateText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: "hidden",
  },

  // Message bubbles
  messageBubbleContainer: {
    marginBottom: 6,
  },
  myBubbleContainer: {
    alignItems: "flex-end",
  },
  theirBubbleContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 16,
    minWidth: 80,
  },
  mediaBubble: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: "hidden",
    minWidth: 0,
  },
  mediaBubbleInner: {
    position: "relative",
  },
  // Timestamp row used when a media message has a caption — normal flow
  // under the text instead of an absolute pill overlapping it.
  mediaCaptionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  mediaTimeOverlay: {
    position: "absolute",
    bottom: 6,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mediaTimeText: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: "#FFFFFF",
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  textBubbleContainer: {
    flexDirection: "column",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    alignSelf: "flex-end",
    marginTop: 2,
    marginLeft: 14,
    gap: 3,
  },
  messageTime: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.2,
  },
  statusIcon: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },
  statusRead: {
    color: "#A5F3FC",
  },

  // ── Typing Indicator ────────────────────────────────────
  typingContainer: {
    alignItems: "flex-start",
    marginTop: 4,
  },
  typingBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typingDot1: { opacity: 0.4 },
  typingDot2: { opacity: 0.7 },
  typingDot3: { opacity: 1 },

  // ── Composer ────────────────────────────────────────────
  composer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  composerCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 30,
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 7,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 10,
    marginBottom: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  recordingCancel: {
    fontSize: 13,
    fontWeight: "600",
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    maxHeight: 110,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnRecording: {
    // backgroundColor now themed inline (colors.error) so it stays a
    // clear "recording/alert" red in both normal and high-contrast modes.
  },
  sendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendCircleDisabled: {
    opacity: 0.45,
  },
});
